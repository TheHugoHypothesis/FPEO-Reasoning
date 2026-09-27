import json
import time
import re
from datetime import datetime
from rdflib.plugins.sparql.parser import parseQuery

from config import (
    client, MODEL_NAME, TEMPERATURE, MAX_TOKENS, MAX_RETRIES,
    MAX_TOOL_CALLS_PER_ATTEMPT, ENDPOINT_SPARQL
)
from ontology import (
    abox_graph, converter, endpoints_void_dict, prefixes_context,
    predicates_context, ns_bindings
)
from entity_linker import dynamic_entity_linking
from tools import TOOLS_SPEC, TOOL_REGISTRY
from sparql_parser import (
    extract_sparql, looks_like_sparql, extract_model_response,
    enforce_canonical_prefixes
)

# Validador VoID (SPARQL-LLM)
import httpx
_orig_httpx_get = httpx.Client.get
def _mock_uniprot_get(self, url, *args, **kwargs):
    if "uniprot" in str(url):
        return httpx.Response(200, json={"results": {"bindings": []}})
    return _orig_httpx_get(self, url, *args, **kwargs)

httpx.Client.get = _mock_uniprot_get
try:
    from sparql_llm import validate_sparql_with_void
finally:
    httpx.Client.get = _orig_httpx_get

from agent import verify_execution_result, prune_message_history


# ==============================================================================
# 1. FUNÇÕES DE CÁLCULO DE MÉTRICAS CIENTÍFICAS
# ==============================================================================
def normalize_entity_value(val: str) -> str:
    s = str(val).strip()
    s = re.sub(r"\^\^<http://www.w3.org/2001/XMLSchema#[^>]+>", "", s)
    s = re.sub(r"\^\^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+", "", s)
    s = s.replace('"', '').replace("'", "")

    if "#" in s:
        s = s.split("#")[-1]
    elif "/" in s and not s.replace(".", "", 1).isdigit():
        s = s.split("/")[-1]

    try:
        f = float(s)
        return f"{f:.4f}".rstrip("0").rstrip(".")
    except ValueError:
        return s.lower()


def prune_message_history(messages: list) -> list:
    """
    Poda o histórico garantindo que mensagens de 'tool' nunca fiquem órfãs
    do 'assistant' que as chamou, evitando exceções no template Jinja do llama-server.
    """
    if len(messages) <= 12:
        return messages

    system_and_user = messages[:2]
    tail = messages[-8:]

    # Remove qualquer mensagem 'tool' que tenha ficado no início do corte
    while tail and getattr(tail[0], "role", None) == "tool":
        tail.pop(0)
    while tail and isinstance(tail[0], dict) and tail[0].get("role") == "tool":
        tail.pop(0)

    return system_and_user + tail

def canonicalize_result_set(data: list, target_dim: int = None) -> set:
    if not data or not isinstance(data, list):
        return set()
    canonical_set = set()
    for row in data:
        if isinstance(row, (list, tuple)):
            # Se o padrão-ouro espera 1 coluna e o modelo trouxe URI + Label, avalia a primeira coluna
            if target_dim == 1 and len(row) > 1:
                canonical_set.add((normalize_entity_value(row[0]),))
            else:
                norm_tuple = tuple(normalize_entity_value(x) for x in row)
                canonical_set.add(norm_tuple)
        else:
            canonical_set.add((normalize_entity_value(row),))
    return canonical_set


def compute_scientific_metrics(pred_data: list, gold_data: list) -> tuple[float, float, float, float]:
    gold_set = canonicalize_result_set(gold_data)
    target_dim = len(next(iter(gold_set))) if gold_set else None
    pred_set = canonicalize_result_set(pred_data, target_dim=target_dim)

    em = 1.0 if pred_set == gold_set else 0.0

    if len(gold_set) == 0 and len(pred_set) == 0:
        return 1.0, 1.0, 1.0, 1.0

    if len(gold_set) == 0 or len(pred_set) == 0:
        return 0.0, 0.0, 0.0, 0.0

    tp = len(pred_set.intersection(gold_set))
    precision = tp / len(pred_set)
    recall = tp / len(gold_set)
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return precision, recall, f1, em


# ==============================================================================
# 2. MOTOR DO AGENTE INSTRUMENTADO COM TELEMETRIA
# ==============================================================================

def execute_agent_with_telemetry(question: str) -> dict:
    telemetry = {
        "success": False,
        "attempts_needed": 0,
        "pass_at_1": False,
        "syntax_valid": False,
        "tool_calls_count": 0,
        "tools_called": [],
        "void_hallucinations_count": 0,
        "critic_rejections_count": 0,
        "generated_sparql": "",
        "predicted_results": [],
        "latency_seconds": 0.0,
        "error": None,
        "execution_trace": []
    }

    t0 = time.time()
    linked_entities = dynamic_entity_linking(question, abox_graph)

    entity_ctx = ""
    if linked_entities:
        entity_ctx = "Grounded Entities in Knowledge Graph:\n" + "\n".join(
            [f"- Term '{t}' matches: {c}" for t, c in linked_entities.items()]
        )

    system_instructions = f"""You are a formal Text-to-SPARQL translation engine.
Your task is ONLY to translate the natural-language question into one exact SPARQL 1.1 query.

TOOLS GUIDELINE:
- Use `search_entities` or `inspect_entity_facts` to explore facts about ontology.
- When ready, output the SPARQL query without reasoning or explanation.

PROJECTION PARSIMONY:
- Project ONLY the exact variable requested by the question.

ENTITY NODES VS LITERAL LABELS RULE:
- Always project the ENTITY VARIABLE / CURIE itself (e.g., SELECT ?module, SELECT ?equipment).
- NEVER project `rdfs:label`, names, or textual descriptions instead of the entity node, unless the prompt explicitly asks for "the label" or "the name" of the entity.

AVAILABLE METADATA:
Prefixes:
{prefixes_context}
Predicates:
{predicates_context}
Grounded Context:
{entity_ctx}
"""

    base_messages = [
        {"role": "system", "content": system_instructions},
        {"role": "user", "content": f"Generate exactly one complete SPARQL query for:\n{question}"}
    ]

    for attempt in range(MAX_RETRIES):
        telemetry["attempts_needed"] = attempt + 1
        print(f"      [Tentativa {attempt+1}/{MAX_RETRIES}] Gerando raciocínio...", flush=True)

        attempt_record = {
            "attempt": attempt + 1,
            "tool_interactions": [],
            "sparql_proposed": None,
            "syntax_valid": False,
            "void_issues": [],
            "retrieved_data": [],
            "critic_verdict": None,
            "critic_feedback": None
        }

        sparql_emitted = False
        content = ""

        for tool_step in range(MAX_TOOL_CALLS_PER_ATTEMPT):
            base_messages = prune_message_history(base_messages)

            # Se for o último passo permitido de ferramenta, força o fechamento para geração de texto
            is_last_tool_step = (tool_step == MAX_TOOL_CALLS_PER_ATTEMPT - 1)
            active_tools = None if is_last_tool_step else TOOLS_SPEC
            tool_choice_mode = "none" if is_last_tool_step else "auto"

            try:
                response = client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=base_messages,
                    temperature=TEMPERATURE,
                    max_tokens=MAX_TOKENS,
                    tools=active_tools,
                    tool_choice=tool_choice_mode
                )
            except Exception as e:
                telemetry["error"] = f"LLM API Failure: {e}"
                print(f"      [Erro LLM]: {e}", flush=True)
                break

            message = response.choices[0].message

            # Fluxo de chamada de ferramenta
            if message.tool_calls and not is_last_tool_step:
                base_messages.append(message)
                for tc in message.tool_calls:
                    fn_name = tc.function.name
                    fn_args = json.loads(tc.function.arguments or "{}")

                    telemetry["tool_calls_count"] += 1
                    telemetry["tools_called"].append(fn_name)
                    print(f"      -> [Tool Call #{telemetry['tool_calls_count']}]: {fn_name}({fn_args})", flush=True)

                    if fn_name in TOOL_REGISTRY:
                        tool_res = TOOL_REGISTRY[fn_name](**fn_args)
                    else:
                        tool_res = f"Unknown tool: {fn_name}"

                    attempt_record["tool_interactions"].append({
                        "tool": fn_name,
                        "args": fn_args,
                        "result": tool_res
                    })

                    base_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": str(tool_res)
                    })
                continue

            # Extração de resposta textual
            extracted_content, _, _ = extract_model_response(response)
            if extracted_content.strip():
                content = extracted_content
                sparql_emitted = True
                break

        # Trava anti-paralisia: se esgotou o laço chamando ferramentas, obriga a emitir a query final
        if not sparql_emitted:
            print("      -> [Aviso]: Limite de chamadas de ferramentas atingido. Forçando emissão de SPARQL...", flush=True)
            base_messages.append({
                "role": "user",
                "content": "Tool call budget exhausted. You must now synthesize and output ONLY the final SPARQL 1.1 query based on gathered facts."
            })
            try:
                forced_response = client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=base_messages,
                    temperature=TEMPERATURE,
                    max_tokens=MAX_TOKENS
                )
                content, _, _ = extract_model_response(forced_response)
            except Exception as e:
                telemetry["error"] = f"LLM Forced Turn API Failure: {e}"
                print(f"      [Erro LLM Turno Forçado]: {e}", flush=True)
                telemetry["execution_trace"].append(attempt_record)
                break

        if not content.strip():
            telemetry["execution_trace"].append(attempt_record)
            continue

        sparql_raw = sanitize_sparql_text(extract_sparql(content))
        sparql_query = enforce_canonical_prefixes(sparql_raw, ns_bindings)
        attempt_record["sparql_proposed"] = sparql_query
        telemetry["generated_sparql"] = sparql_query

        # Exibição do SPARQL no terminal
        print("      -> [SPARQL Proposto]:", flush=True)
        for line in sparql_query.strip().splitlines():
            print(f"         {line}", flush=True)

        # Validação Sintática
        try:
            parseQuery(sparql_query)
            attempt_record["syntax_valid"] = True
            telemetry["syntax_valid"] = True
        except Exception as pe:
            attempt_record["syntax_valid"] = False
            telemetry["syntax_valid"] = False
            print(f"      -> [Falha Sintaxe SPARQL]: {pe}", flush=True)

        if not looks_like_sparql(sparql_query):
            telemetry["execution_trace"].append(attempt_record)
            if attempt < MAX_RETRIES - 1:
                base_messages.append({"role": "assistant", "content": content})
                base_messages.append({
                    "role": "user",
                    "content": "The output does not match valid SPARQL syntax. Return ONLY a complete SPARQL 1.1 query."
                })
            continue

        # Validação de Esquema com VoID
        issues = validate_sparql_with_void(
            query=sparql_query,
            endpoint_url=ENDPOINT_SPARQL,
            prefix_converter=converter,
            endpoints_void_dict=endpoints_void_dict
        )

        if issues:
            telemetry["void_hallucinations_count"] += 1
            attempt_record["void_issues"] = [str(i) for i in issues]
            telemetry["execution_trace"].append(attempt_record)
            print(f"      -> [Rejeição VoID]: {issues}", flush=True)
            if attempt < MAX_RETRIES - 1:
                base_messages.append({"role": "assistant", "content": content})
                base_messages.append({
                    "role": "user",
                    "content": f"Schema error detected by VoID:\n" + "\n".join(str(i) for i in issues)
                })
            continue

        # Execução na ABox Materializada
        try:
            res = abox_graph.query(sparql_query)
            data = [[str(x).split("#")[-1] for x in row] for row in res]
            attempt_record["retrieved_data"] = data
            telemetry["predicted_results"] = data
            print(f"      -> [Dados Retornados]: {data}", flush=True)

            # Validação pelo Crítico Semântico
            is_valid, critic_feedback = verify_execution_result(question, sparql_query, data)
            attempt_record["critic_verdict"] = "ACCEPTED" if is_valid else "REJECTED"
            attempt_record["critic_feedback"] = critic_feedback

            if not is_valid:
                telemetry["critic_rejections_count"] += 1
                telemetry["execution_trace"].append(attempt_record)
                print(f"      -> [REJEITADO PELO CRÍTICO]: {critic_feedback}", flush=True)

                if attempt < MAX_RETRIES - 1:
                    # Reseta o histórico preservando apenas a pergunta original e o feedback do crítico
                    # Isso elimina mensagens 'tool' órfãs entre tentativas
                    base_messages = [
                        {"role": "system", "content": system_instructions},
                        {"role": "user", "content": f"Generate exactly one complete SPARQL query for:\n{question}"},
                        {"role": "assistant", "content": sparql_query},
                        {
                            "role": "user",
                            "content": (
                                f"The previous SPARQL query was REJECTED by semantic validation:\n"
                                f"Feedback: {critic_feedback}\n\n"
                                f"Investigate the knowledge graph schema again or fix the query to answer: {question}"
                            )
                        }
                    ]
                continue

            # Sucesso
            print("      -> [APROVADO PELO CRÍTICO]", flush=True)
            telemetry["execution_trace"].append(attempt_record)
            telemetry["success"] = True
            telemetry["pass_at_1"] = (attempt == 0)
            telemetry["latency_seconds"] = round(time.time() - t0, 2)
            return telemetry

        except Exception as e:
            telemetry["error"] = f"RDFLib Execution error: {e}"
            attempt_record["critic_feedback"] = f"Execution error: {e}"
            telemetry["execution_trace"].append(attempt_record)
            print(f"      -> [Erro Execução RDFLib]: {e}", flush=True)

            if attempt < MAX_RETRIES - 1:
                base_messages = [
                    {"role": "system", "content": system_instructions},
                    {"role": "user", "content": f"Generate exactly one complete SPARQL query for:\n{question}"},
                    {"role": "assistant", "content": sparql_query},
                    {
                        "role": "user",
                        "content": f"The query failed to execute in RDFLib: {e}. Fix predicate names, namespaces or variables."
                    }
                ]
            continue

    telemetry["latency_seconds"] = round(time.time() - t0, 2)
    return telemetry

def sanitize_sparql_text(raw_text: str) -> str:
    """
    Remove tokens especiais de controle e finalização emitidos por LLMs
    (ex: <|return|>, <|im_end|>, <|eot_id|>, </s>) e limpa blocos de código markdown.
    """
    if not raw_text:
        return ""

    # Remove tokens de controle estilo <|token_name|>
    text = re.sub(r"<\|[a-zA-Z0-9_\-\|]+\|>", "", raw_text)

    # Remove outros tokens comuns de parada (ex: </s>, [END])
    text = re.sub(r"</s>|\[END\]", "", text)

    return text.strip()

# ==============================================================================
# 3. PIPELINE DE EXECUÇÃO, CONSOLIDAÇÃO E EXPORTAÇÃO
# ==============================================================================
def run_scientific_benchmark(ground_truth_path="ground_truth.json", output_json="benchmark_evaluation_report.json"):
    with open(ground_truth_path, "r", encoding="utf-8") as f:
        ground_truth_data = json.load(f)

    total_cqs = len(ground_truth_data)
    print("=" * 80)
    print(f"INICIANDO BENCHMARK CIENTÍFICO SABiOx -- {total_cqs} QUESTÕES DE COMPETÊNCIA")
    print(f"Modelo: {MODEL_NAME} | Endpoint: {ENDPOINT_SPARQL}")
    print("=" * 80)

    detailed_evaluations = []
    t_start_total = time.time()

    for idx, item in enumerate(ground_truth_data, 1):
        rf_id = item["rf_id"]
        subdomain = item["subdomain"]
        nlq = item["question"]
        gold_answers = item["expected_results"]
        sparql_gold = item.get("sparql_gold", "")

        print(f"\n[{idx:02d}/{total_cqs}] {rf_id} [{subdomain}] -> {nlq}")
        telemetry = execute_agent_with_telemetry(nlq)

        # Cálculo de Métricas Formais
        p, r, f1, em = compute_scientific_metrics(telemetry["predicted_results"], gold_answers)

        result_entry = {
            "id": idx,
            "rf_id": rf_id,
            "subdomain": subdomain,
            "question": nlq,
            "sparql_gold": sparql_gold,
            "sparql_generated": telemetry["generated_sparql"],
            "expected_results": gold_answers,
            "predicted_results": telemetry["predicted_results"],
            "metrics": {
                "exact_match": em,
                "precision": round(p, 4),
                "recall": round(r, 4),
                "f1_score": round(f1, 4),
                "syntax_valid": telemetry["syntax_valid"],
                "pass_at_1": telemetry["pass_at_1"]
            },
            "autonomic_telemetry": {
                "attempts_needed": telemetry["attempts_needed"],
                "latency_seconds": telemetry["latency_seconds"],
                "tool_calls_count": telemetry["tool_calls_count"],
                "tools_called": telemetry["tools_called"],
                "void_hallucinations_detected": telemetry["void_hallucinations_count"],
                "critic_rejections_count": telemetry["critic_rejections_count"],
                "pipeline_success": telemetry["success"]
            },
            "execution_trace": telemetry["execution_trace"]  # Histórico detalhado de todas as tentativas
        }
        detailed_evaluations.append(result_entry)

        status_flag = "EM=1.0" if em == 1.0 else f"F1={f1:.2f} (Divergência)"
        print(f"    └─ Veredito: {status_flag} | Latência: {telemetry['latency_seconds']}s | "
              f"Tools: {telemetry['tool_calls_count']} | VoID Rejects: {telemetry['void_hallucinations_count']} | "
              f"Critic Rejects: {telemetry['critic_rejections_count']}")

        if em < 1.0:
            sparql_inline = " ".join(telemetry['generated_sparql'].split())
            print(f"       ├─ SPARQL Gerado: {sparql_inline[:120]}..." if len(sparql_inline) > 120 else f"       ├─ SPARQL Gerado: {sparql_inline}")
            print(f"       ├─ Predito (Modelo): {telemetry['predicted_results']}")
            print(f"       └─ Esperado (Gold):  {gold_answers}")

    total_time_benchmark = round(time.time() - t_start_total, 2)

    subdomains = sorted(list(set(d["subdomain"] for d in detailed_evaluations)))
    subdomain_summary = {}

    for sub in subdomains:
        sub_items = [d for d in detailed_evaluations if d["subdomain"] == sub]
        subdomain_summary[sub] = {
            "total_questions": len(sub_items),
            "exact_match_accuracy": round(sum(d["metrics"]["exact_match"] for d in sub_items) / len(sub_items), 4),
            "macro_precision": round(sum(d["metrics"]["precision"] for d in sub_items) / len(sub_items), 4),
            "macro_recall": round(sum(d["metrics"]["recall"] for d in sub_items) / len(sub_items), 4),
            "macro_f1": round(sum(d["metrics"]["f1_score"] for d in sub_items) / len(sub_items), 4),
            "pass_at_1_rate": round(sum(1 for d in sub_items if d["metrics"]["pass_at_1"]) / len(sub_items), 4),
            "total_tool_calls": sum(d["autonomic_telemetry"]["tool_calls_count"] for d in sub_items),
            "total_void_hallucinations": sum(d["autonomic_telemetry"]["void_hallucinations_detected"] for d in sub_items),
            "total_critic_rejections": sum(d["autonomic_telemetry"]["critic_rejections_count"] for d in sub_items)
        }

    global_report = {
        "benchmark_metadata": {
            "timestamp": datetime.now().isoformat(),
            "model_name": MODEL_NAME,
            "temperature": TEMPERATURE,
            "total_questions": total_cqs,
            "total_runtime_seconds": total_time_benchmark,
            "average_latency_per_query_seconds": round(total_time_benchmark / total_cqs, 2)
        },
        "global_performance_metrics": {
            "exact_match_accuracy": round(sum(d["metrics"]["exact_match"] for d in detailed_evaluations) / total_cqs, 4),
            "macro_precision": round(sum(d["metrics"]["precision"] for d in detailed_evaluations) / total_cqs, 4),
            "macro_recall": round(sum(d["metrics"]["recall"] for d in detailed_evaluations) / total_cqs, 4),
            "macro_f1": round(sum(d["metrics"]["f1_score"] for d in detailed_evaluations) / total_cqs, 4),
            "pass_at_1_accuracy": round(sum(1 for d in detailed_evaluations if d["metrics"]["pass_at_1"]) / total_cqs, 4),
            "syntax_validity_rate": round(sum(1 for d in detailed_evaluations if d["metrics"]["syntax_valid"]) / total_cqs, 4)
        },
        "autonomic_agent_metrics": {
            "total_tool_calls": sum(d["autonomic_telemetry"]["tool_calls_count"] for d in detailed_evaluations),
            "average_tool_calls_per_query": round(sum(d["autonomic_telemetry"]["tool_calls_count"] for d in detailed_evaluations) / total_cqs, 2),
            "total_void_hallucinations_prevented": sum(d["autonomic_telemetry"]["void_hallucinations_detected"] for d in detailed_evaluations),
            "total_semantic_critic_rejections": sum(d["autonomic_telemetry"]["critic_rejections_count"] for d in detailed_evaluations),
            "tool_usage_distribution": {
                "search_entities": sum(d["autonomic_telemetry"]["tools_called"].count("search_entities") for d in detailed_evaluations),
                "inspect_entity_facts": sum(d["autonomic_telemetry"]["tools_called"].count("inspect_entity_facts") for d in detailed_evaluations)
            }
        },
        "subdomain_performance_breakdown": subdomain_summary,
        "detailed_query_evaluations": detailed_evaluations
    }

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(global_report, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 80)
    print("CONSOLIDAÇÃO FINAL DOS RESULTADOS (PUBLICÁVEL)")
    print("=" * 80)
    print(f"Exact Match (EM):             {global_report['global_performance_metrics']['exact_match_accuracy'] * 100:.2f}%")
    print(f"Macro F1-Score:               {global_report['global_performance_metrics']['macro_f1'] * 100:.2f}%")
    print(f"Taxa Pass@1:                  {global_report['global_performance_metrics']['pass_at_1_accuracy'] * 100:.2f}%")
    print(f"Alucinações Barradas (VoID):  {global_report['autonomic_agent_metrics']['total_void_hallucinations_prevented']}")
    print(f"Rejeições do Crítico:         {global_report['autonomic_agent_metrics']['total_semantic_critic_rejections']}")
    print(f"Total Chamadas de Ferramentas:{global_report['autonomic_agent_metrics']['total_tool_calls']}")
    print(f"Relatório exportado em:       {output_json}")
    print("=" * 80)


if __name__ == "__main__":
    OUTPUT_REPORT_PATH = "benchmark_evaluation_report_gemma_12b.json"
    run_scientific_benchmark(output_json=OUTPUT_REPORT_PATH)
