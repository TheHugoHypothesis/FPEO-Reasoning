import os
from typing import Tuple, List, Set

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ONTOLOGY_DIR = os.path.join(BASE_DIR, "ontologies")

HERMIT_JAR = "/home/elliot/.local/lib/python3.14/site-packages/owlready2/hermit/HermiT.jar"
OWLAPI_JAR = "/home/elliot/.local/lib/python3.14/site-packages/owlready2/pellet/owlapi-distribution-3.4.3-bin.jar"

DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"
DEFAULT_OLLAMA_URL = "http://localhost:11434"
DEFAULT_OLLAMA_MODEL = "llama3:latest"

STD_NAMESPACES: Tuple[str, ...] = (
    "http://www.w3.org/2002/07/owl#",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "http://www.w3.org/2000/01/rdf-schema#",
    "http://www.w3.org/2001/XMLSchema#",
)

IGNORE_PREDICATES: Set[str] = {
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    "http://www.w3.org/2002/07/owl#sameAs",
    "http://www.w3.org/2002/07/owl#differentFrom",
    "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
}

BASE_TBOX_FILES: List[str] = [
    "o3po.ttl",
    "fpeo-equipments-core.ttl",
    "fpeo-static-equipments.ttl",
    "fpeo-dynamical-equipments.ttl",
    "fpeo-electrical-equipments.ttl",
    "fpeo-valves-security.ttl",
    "fpeo-renewable-equipments.ttl",
    "fpeo-sensors-equipments.ttl",
    "fpeo-crosswalk-equipments.ttl",
    "fpeo-properties-equipments.ttl",
    "fpeo-rules-equipments.ttl",
]

SPARQL_PREFIXES = """PREFIX core: <http://usp.ai/ontologies/fpeo-equipments-core#>
PREFIX static: <http://usp.ai/ontologies/fpeo-static-equipments#>
PREFIX dynamical: <http://usp.ai/ontologies/fpeo-dynamical-equipments#>
PREFIX electrical: <http://usp.ai/ontologies/fpeo-electrical-equipments#>
PREFIX valve: <http://usp.ai/ontologies/fpeo-valves-security#>
PREFIX sensors: <http://usp.ai/ontologies/fpeo-sensors-equipments#>
PREFIX crosswalk: <http://usp.ai/ontologies/fpeo-crosswalk-equipments#>
PREFIX prop: <http://usp.ai/ontologies/fpeo-properties-equipments#>
PREFIX rules: <http://usp.ai/ontologies/fpeo-rules-equipments#>
PREFIX abox: <http://usp.ai/ontologies/fpeo-collect-equipments-abox#>
PREFIX o3po: <https://www.inf.ufrgs.br/ontologies/o3po#>
PREFIX iofCore: <https://spec.industrialontologies.org/ontology/core/Core/>
PREFIX obo: <http://purl.obolibrary.org/obo/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>"""

# ==============================================================================
# PROMPT TEMPLATES & SYSTEM INSTRUCTIONS
# ==============================================================================

GROUNDING_SYSTEM_INSTRUCTION = (
    "You are a Semantic Web expert. Ground user questions to exact OWL ontology URIs. Never invent URIs."
)

GROUNDING_PROMPT_TEMPLATE = """You are an ontology grounding expert for FPSO process facilities.
Map the user's natural language question into exact OWL class URIs and individual URIs.

User Question: "{question}"{ui_context}

Available Classes:
{class_tree}

Available Properties:
{properties}

Available Individuals:
{individuals}

Respond ONLY with a valid JSON block in this exact format:
```json
{{
  "intent": "list_equipment_by_type",
  "matched_class_uris": ["<exact_class_uri>"],
  "matched_context_uris": ["<exact_context_uri>"],
  "matched_property_uris": [],
  "reasoning": "Explanation"
}}
```"""

SPARQL_SYSTEM_PROMPT = """You are a SPARQL 1.1 synthesis engine for an OWL ontology of FPSO topside process facilities.
Generate a valid SPARQL 1.1 SELECT query that answers the user question using ONLY the exact URIs provided.
Output ONLY the SPARQL inside a ```sparql ... ``` block - nothing else."""

SPARQL_PROMPT_TEMPLATE = """[USER QUESTION]
"{question}"

[AVAILABLE SPARQL PREFIXES]
{prefixes}

[TARGET CLASS URIs - Use these verbatim]
{exact_class_uris}

[CONTEXT ENTITY URIs - Scope boundaries]
{exact_context_uris}

[RELEVANT PROPERTY URIs]
{exact_prop_uris}

[TBOX SCHEMA SUMMARY]
{tbox_summary}

[GRAPHRAG MULTI-HOP SUBGRAPH EVIDENCE]
{subgraph_evidence}

Generate SPARQL 1.1 (SELECT DISTINCT, LIMIT 50) using ONLY the exact URIs listed above:"""

QA_SYSTEM_PROMPT = """Você é um Engenheiro Sênior especialista em plantas de processo FPSO e ontologias industriais OWL.
Sua função é formular a resposta final ao usuário EXCLUSIVAMENTE a partir dos registros retornados pela consulta SPARQL executada no grafo de conhecimento.

DIRETRIZES:
1. Baseie-se unicamente na tabela de [RESULTADOS DA CONSULTA SPARQL].
2. Se a consulta SPARQL não retornou registros (0 resultados / lista vazia), declare explicitamente que nenhum registro correspondente foi encontrado no grafo ontológico. Nunca invente dados fora do resultado SPARQL.
3. Se houver resultados, descreva com precisão técnica os itens retornados (nomes, tags, tipos, módulos e navios).
4. Responda em português do Brasil (pt-BR) de forma objetiva e profissional."""

QA_PROMPT_TEMPLATE = """[PERGUNTA DO USUÁRIO]
"{question}"

[CONSULTA SPARQL 1.1 EXECUTADA NO GRAFO]
```sparql
{sparql_query}
```

[RESULTADOS DA CONSULTA SPARQL (FONTE ÚNICA DA VERDADE)]
{results_text}

Gere a resposta final fundamentada EXCLUSIVAMENTE nos dados acima."""

AUDIT_SYSTEM_PROMPT = """Você é um especialista em Ontologias OWL DL e Raciocínio Automático (HermiT Reasoner).
Explique a inconsistência detectada de forma técnica e didática em português do Brasil, indicando a causa raiz e como corrigi-la."""

AUDIT_PROMPT_TEMPLATE = """Inconsistências detectadas pelo HermiT Reasoner:
{justifications}

Elabore um diagnóstico detalhado em português explicando cada inconsistência."""
