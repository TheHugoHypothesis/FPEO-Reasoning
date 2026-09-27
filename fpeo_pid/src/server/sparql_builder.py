import re
import logging
from typing import List, Optional
from dataclasses import dataclass
import rdflib

from config import (
    SPARQL_PREFIXES,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_OLLAMA_MODEL,
    SPARQL_SYSTEM_PROMPT,
    SPARQL_PROMPT_TEMPLATE,
)
from ontology_mapper import SemanticMapping
from graph_explorer import ExplorationResult
from llm_provider import UnifiedLLMProvider, unified_llm_provider

logger = logging.getLogger("fpeo.sparql_builder")

@dataclass
class SPARQLSynthesis:
    query_string: str
    target_variables: List[str]
    intent_summary: str
    is_llm_generated: bool = True

class SPARQLSynthesisService:
    """Executor that synthesizes valid SPARQL 1.1 queries from semantic grounding and GraphRAG evidence."""

    def __init__(
        self,
        llm_provider: UnifiedLLMProvider = unified_llm_provider,
        prefixes: str = SPARQL_PREFIXES,
        prompt_template: str = SPARQL_PROMPT_TEMPLATE,
        system_instruction: str = SPARQL_SYSTEM_PROMPT,
    ):
        self.llm_provider = llm_provider
        self.prefixes = prefixes
        self.prompt_template = prompt_template
        self.system_instruction = system_instruction

    def _build_prompt(self, mapping: SemanticMapping, exploration: ExplorationResult) -> str:
        exact_class_uris = "\n".join(f"  <{c.uri}>  # {c.label}" for c in mapping.target_classes) or "  (none - omit class filter)"
        exact_context_uris = "\n".join(f"  <{e.uri}>  # {e.label}" for e in mapping.context_entities) or "  (none - no location filter)"
        exact_prop_uris = "\n".join(f"  <{p.uri}>  # {p.label}" for p in mapping.target_properties) or "  (none)"

        return self.prompt_template.format(
            question=mapping.raw_question,
            prefixes=self.prefixes,
            exact_class_uris=exact_class_uris,
            exact_context_uris=exact_context_uris,
            exact_prop_uris=exact_prop_uris,
            tbox_summary=mapping.tbox_summary,
            subgraph_evidence=exploration.subgraph_text,
        )

    @classmethod
    def _extract_sparql(cls, raw_text: str, prefixes: str) -> str:
        code_match = re.search(r"```(?:sparql)?\s*((?:PREFIX|SELECT)[\s\S]*?)\s*```", raw_text, re.IGNORECASE)
        if not code_match:
            select_match = re.search(r"((?:PREFIX\s+\w+:\s*<[^>]+>\s*)*\s*SELECT[\s\S]+)", raw_text, re.IGNORECASE)
            query_str = select_match.group(1).strip() if select_match else raw_text.strip()
        else:
            query_str = code_match.group(1).strip()

        if "PREFIX" not in query_str.upper():
            query_str = f"{prefixes}\n\n{query_str}"

        return query_str

    def _build_grounded_sparql(self, mapping: SemanticMapping, exploration: Optional[ExplorationResult] = None) -> str:
        class_uris = [c.uri for c in mapping.target_classes]
        context_uris = [e.uri for e in mapping.context_entities]

        where_clauses = []
        if class_uris:
            uris_str = " ".join(f"<{u}>" for u in class_uris)
            where_clauses.append(f"  ?item a ?type .\n  VALUES ?type {{ {uris_str} }}")
        else:
            where_clauses.append("  ?item a ?type .")

        where_clauses.append("  OPTIONAL { ?item rdfs:label ?label }")

        if context_uris:
            ctx_str = " ".join(f"<{u}>" for u in context_uris)
            where_clauses.append(
                f"  VALUES ?context {{ {ctx_str} }}\n"
                f"  {{ ?item ?rel ?context }} UNION {{ ?context ?rel ?item }} UNION {{ ?item ?rel1 ?mid . ?mid ?rel2 ?context }}"
            )

        where_body = "\n".join(where_clauses)
        return f"{self.prefixes}\n\nSELECT DISTINCT ?item ?type ?label\nWHERE {{\n{where_body}\n}}\nLIMIT 50"

    def execute(
        self,
        mapping: SemanticMapping,
        exploration: ExplorationResult,
        graph: rdflib.Graph,
        llm_provider: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        gemini_model: str = DEFAULT_GEMINI_MODEL,
        ollama_url: Optional[str] = None,
        ollama_model: str = DEFAULT_OLLAMA_MODEL,
    ) -> SPARQLSynthesis:
        resolved_provider = self.llm_provider.resolve_provider(llm_provider, gemini_api_key, ollama_url)

        if resolved_provider == "none":
            raise ValueError("O motor de inferência LLM está desabilitado nas configurações.")

        prompt = self._build_prompt(mapping, exploration)
        query_str = ""
        is_llm = True

        try:
            raw_text = self.llm_provider.generate_text(
                prompt=prompt,
                system_instruction=self.system_instruction,
                provider=resolved_provider,
                gemini_api_key=gemini_api_key,
                gemini_model=gemini_model,
                ollama_url=ollama_url,
                ollama_model=ollama_model,
                temperature=0.0,
            )
            query_str = self._extract_sparql(raw_text, self.prefixes)
            if "SELECT" not in query_str.upper():
                raise ValueError("LLM response did not contain a valid SELECT query.")
            graph.query(query_str)
        except Exception as exc:
            logger.warning(f"[SPARQL SYNTHESIZER] LLM SPARQL synthesis was incomplete ({exc}). Constructing grounded query from GraphRAG mapping...")
            query_str = self._build_grounded_sparql(mapping, exploration)
            graph.query(query_str)
            is_llm = False

        return SPARQLSynthesis(
            query_string=query_str,
            target_variables=["?item", "?type", "?label"],
            intent_summary="SPARQL 1.1 query synthesized from ontology schema and GraphRAG evidence",
            is_llm_generated=is_llm,
        )

sparql_synthesis_service = SPARQLSynthesisService()
