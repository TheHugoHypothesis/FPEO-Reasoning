import json
import re
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


import json

def verify_execution_result(question: str, sparql_query: str, data: list) -> tuple[bool, str]:
    """
    Validador semântico com protocolo formal de decisão (LLM-as-a-Judge).
    Não contém heurísticas de linguagem natural, palavras-chave arbitrárias ou viés de domínio.
    """
    # 1. Checagem booleana determinística de dados vazios
    if not data or data == [[]]:
        return False, "Query executed successfully but returned ZERO results []."

    preview_data = data[:10] if isinstance(data, list) else data

    # 2. Protocolo de Delimitador Canônico (Standard Evaluation Protocol)
    prompt = f"""You are a formal evaluator for Knowledge Graph SPARQL execution.
Assess whether the retrieved data properly answers the question.

Question: {question}
SPARQL:
{sparql_query}
Data: {preview_data}

Rules:
1. Conclude with exactly [[ACCEPTED]] if the retrieved individuals directly satisfy the question.
2. Conclude with exactly [[REJECTED]] if:
   - The source equipment is returned as its own target/destination.
   - The returned entities belong to an incorrect domain or category.
   - The logic of the query is inverted.

Format:
Reasoning: <one concise sentence explaining your evaluation>
Decision: [[ACCEPTED]] or [[REJECTED]]
"""

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=1024,
            stop=["<end_of_turn>", "<eos>", "</s>"],  # Força parada imediata no Gemma
            tools=tools if tools else None,
            tool_choice="auto" if tools else None
        )

        content, reasoning, reasoning_content = extract_model_response(response)
        full_text = (content.strip() or (reasoning_content or "").strip() or (reasoning or "").strip())

        # 3. Extração Estrita dos Marcadores Formais
        has_accepted = "[[ACCEPTED]]" in full_text
        has_rejected = "[[REJECTED]]" in full_text

        # 4. Decisão Binária Semântica
        if has_accepted and not has_rejected:
            return True, ""

        # Extrai a linha de raciocínio para dar feedback ao agente
        reason = ""
        reason_match = re.search(r'Reasoning:\s*(.*?)(?:Decision:|$)', full_text, re.IGNORECASE | re.DOTALL)
        if reason_match:
            reason = reason_match.group(1).strip()
        else:
            # Pega as sentenças que não contenham o token de decisão
            clean_lines = [l.strip() for l in full_text.splitlines() if "[[" not in l and l.strip()]
            reason = clean_lines[0] if clean_lines else "The result does not satisfy question constraints."

        return False, reason

    except Exception:
        # Falha de infraestrutura de rede externa (timeout/conexão)
        return True, ""

def prune_message_history(messages: list) -> list:
    """
    Mantém o system prompt, a pergunta original e as últimas 4 mensagens
    para evitar saturação de contexto e loops de repetição.
    """
    if len(messages) > 8:
        return messages[:2] + messages[-6:]
    return messages


def ask_fpeo_agent(question: str, max_retries: int = MAX_RETRIES):
    print("\n" + "=" * 70)
    print(f"NLQ: {question}")
    print("=" * 70)

    linked_entities = dynamic_entity_linking(question, abox_graph)

    if linked_entities:
        entity_context = "Grounded Entities found in the Knowledge Graph for this input:\n"
        for term, curie in linked_entities.items():
            entity_context += f"- Term '{term}' matches individual: {curie}\n"
    else:
        entity_context = "No pre-grounded individuals detected. Match codes against literal values if present.\n"

    system_instructions = f"""You are a formal Text-to-SPARQL translation engine.

Your task is ONLY to translate the user's natural-language question into one exact SPARQL 1.1 query.

TOOLS GUIDELINE:
- If a port, code, or entity mentioned is unclear, use `search_entities` or `inspect_entity_facts` to explore how it is connected in the Knowledge Graph.
- When ready, output the SPARQL query.

IMPORTANT OUTPUT RULES:
1. Return exactly ONE complete SPARQL query.
2. Do NOT explain your answer.
3. Do NOT output reasoning.
4. Do NOT output analysis.
5. Do NOT output prose before or after the query.
6. Do NOT output Markdown code fences in your final SPARQL turn.
7. The response must be a complete query, never a partial query.
8. Use ONLY predicates from the ontology metadata below.
9. If an entity was resolved in Grounded Context, refer directly to its CURIE.
10. PARSIMONY: Translate strictly what was asked.
11. Never append arbitrary type restrictions such as ?x a Class unless they are required to answer the question.
12. Use the provided prefixes exactly when possible.
13. Do not invent predicates.
14. Do not invent individuals.

ONTOLOGY METADATA
=================
Available Prefixes:
{prefixes_context}

Available Predicates in this Knowledge Graph:
{predicates_context}

Grounded Context:
{entity_context}

SPECIFICATION DISAMBIGUATION RULE:
When querying a specific parameter or property of an entity (e.g., power, pressure, flow):
- Bind ?spec directly to the specific individual identified via tools (e.g., abox:Spec_DesignFlow_P01), OR
- Restrict ?spec with its exact class (e.g., ?spec a prop:RatedPowerSpecification).
- Never leave ?spec unconstrained if the question targets a single specific attribute.
"""

    base_messages = [
        {"role": "system", "content": system_instructions},
        {"role": "user", "content": f"Generate exactly one complete SPARQL query for this question:\n{question}"}
    ]

    for attempt in range(max_retries):
        print(f"\n[Attempt {attempt + 1}/{max_retries}]")

        for tool_step in range(MAX_TOOL_CALLS_PER_ATTEMPT):
            # Aplica poda de histórico para manter o contexto enxuto
            base_messages = prune_message_history(base_messages)

            try:
                response = client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=base_messages,
                    temperature=TEMPERATURE,
                    max_tokens=MAX_TOKENS,
                    tools=TOOLS_SPEC,
                    tool_choice="auto"
                )
            except Exception as e:
                print(f"[!] Erro de chamada no attempt {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    base_messages.append({
                        "role": "user",
                        "content": "The previous generation failed. Return exactly one complete SPARQL 1.1 query."
                    })
                break

            message = response.choices[0].message

            # 1. Fluxo de Tool Calling
            if message.tool_calls:
                base_messages.append(message)
                for tool_call in message.tool_calls:
                    fn_name = tool_call.function.name
                    fn_args = json.loads(tool_call.function.arguments or "{}")
                    print(f"--> [Tool Call]: {fn_name}({fn_args})")

                    if fn_name in TOOL_REGISTRY:
                        tool_res = TOOL_REGISTRY[fn_name](**fn_args)
                    else:
                        tool_res = f"Unknown tool: {fn_name}"

                    print(f"    [Tool Output]:\n{tool_res}\n")

                    base_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": str(tool_res)
                    })
                continue  # Continua no loop de ferramentas

            # 2. Fluxo de Geração de Query
            content, reasoning, reasoning_content = extract_model_response(response)
            if reasoning or reasoning_content:
                r_text = reasoning or reasoning_content
                print(f"[GPT-OSS] Reasoning recebido: {len(r_text)} caracteres")

            if not content.strip():
                print("[!] message.content veio vazio.")
                break

            sparql_query = enforce_canonical_prefixes(extract_sparql(content), ns_bindings)
            print(f"SPARQL Gerado:\n{sparql_query}\n")

            if not looks_like_sparql(sparql_query):
                print("--> [SPARQL Check]: Resposta não parece uma query SPARQL completa.")
                if attempt < max_retries - 1:
                    base_messages.append({"role": "assistant", "content": content})
                    base_messages.append({
                        "role": "user",
                        "content": (
                            "The previous response was invalid or incomplete.\n\n"
                            "Return ONLY one COMPLETE SPARQL 1.1 query.\n"
                            "Do not explain anything.\nDo not output reasoning.\n"
                            "Do not output Markdown.\nDo not return a partial query."
                        )
                    })
                break

            # 3. Validação Semântica com VoID
            issues = validate_sparql_with_void(
                query=sparql_query,
                endpoint_url=ENDPOINT_SPARQL,
                prefix_converter=converter,
                endpoints_void_dict=endpoints_void_dict
            )

            if issues:
                print(f"--> [VoID Check]: Alucinação: {issues}")
                if attempt < max_retries - 1:
                    base_messages.append({"role": "assistant", "content": content})
                    base_messages.append({
                        "role": "user",
                        "content": (
                            "The generated SPARQL query failed semantic/schema validation.\n\n"
                            f"Validation errors:\n" + "\n".join(str(i) for i in issues) + "\n\n"
                            "Rewrite the query completely.\nUse ONLY predicates listed in the ontology metadata.\n"
                            "Return ONLY the complete SPARQL query.\nDo not explain anything."
                        )
                    })
                break

            print("--> [VoID Check]: VÁLIDA")

            # 4. Execução na ABox e Verificação com o Crítico
            try:
                res = abox_graph.query(sparql_query)
                if res.type == "ASK":
                    data = bool(res)
                else:
                    data = [[str(x).split("#")[-1] for x in row] for row in res]

                # Caso 4A: Retorno Vazio
                if not data:
                    print("--> [ABox Execution]: Executada, mas retornou 0 resultados.")
                    if attempt < max_retries - 1:
                        base_messages.append({"role": "assistant", "content": content})
                        base_messages.append({
                            "role": "user",
                            "content": (
                                "The SPARQL query returned ZERO results.\n"
                                f"Question: {question}\n"
                                f"Failed Query:\n{sparql_query}\n"
                                "Check predicate directions (subject vs object) and inspect entity connections again."
                            )
                        })
                    break

                # Caso 4B: Avaliação pelo Crítico Semântico
                print(f"--> [ABox Raw Data]: {data}")
                is_valid, critic_feedback = verify_execution_result(question, sparql_query, data)

                if not is_valid:
                    print(f"--> [Semantic Validation REJECTED]: {critic_feedback}")
                    if attempt < max_retries - 1:
                        base_messages.append({"role": "assistant", "content": content})
                        base_messages.append({
                            "role": "user",
                            "content": (
                                f"The SPARQL query executed, but the result was REJECTED by semantic validation:\n"
                                f"{critic_feedback}\n\n"
                                f"Refine the SPARQL query to constrain the variables specifically for '{question}'."
                            )
                        })
                    break

                print(f"--> [ABox Execution]: Sucesso Validado! Retorno: {data}")
                return data

            except Exception as e:
                print(f"--> [ABox Execution]: Erro: {e}")
                if attempt < max_retries - 1:
                    base_messages.append({"role": "assistant", "content": content})
                    base_messages.append({
                        "role": "user",
                        "content": (
                            f"The generated SPARQL query could not be executed.\n\nExecution error:\n{e}\n\n"
                            "Rewrite the query as a complete SPARQL 1.1 query.\nReturn ONLY the query."
                        )
                    })
                break

    print("[!] Número máximo de tentativas atingido.")
    return None
