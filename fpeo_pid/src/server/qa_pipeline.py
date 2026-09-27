import time
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from reasoner import HermitReasonerService, reasoner_service
from ontology_mapper import SemanticMapperService, semantic_mapper_service
from graph_explorer import GraphRAGExplorerService, graph_explorer_service
from sparql_builder import SPARQLSynthesisService, sparql_synthesis_service
from llm_explainer import LLMExplainerService, llm_explainer_service
from config import DEFAULT_GEMINI_MODEL, DEFAULT_OLLAMA_MODEL

logger = logging.getLogger("fpeo.pipeline")

class GraphRAGPipeline:
    """Orchestrates the end-to-end Ontology-Driven GraphRAG pipeline from NL question to grounded answer."""

    def __init__(
        self,
        reasoner: HermitReasonerService = reasoner_service,
        mapper: SemanticMapperService = semantic_mapper_service,
        explorer: GraphRAGExplorerService = graph_explorer_service,
        synthesizer: SPARQLSynthesisService = sparql_synthesis_service,
        explainer: LLMExplainerService = llm_explainer_service,
    ):
        self.reasoner = reasoner
        self.mapper = mapper
        self.explorer = explorer
        self.synthesizer = synthesizer
        self.explainer = explainer
        self._qa_cache: Dict[str, Dict[str, Any]] = {}

    def _compute_qa_cache_key(
        self,
        question: str,
        ttl_contents: Optional[List[str]],
        active_fpso_id: Optional[str],
        active_module_id: Optional[str],
        llm_provider: Optional[str],
    ) -> str:
        payload_hash = self.reasoner.compute_payload_hash(ttl_contents)
        q_norm = question.strip().lower()
        fpso_norm = active_fpso_id or "ALL"
        mod_norm = active_module_id or "ALL"
        prov_norm = llm_provider or "auto"
        return f"{payload_hash}___{q_norm}___{fpso_norm}___{mod_norm}___{prov_norm}"

    def execute_qa(
        self,
        question: str,
        active_fpso_id: Optional[str] = None,
        active_module_id: Optional[str] = None,
        ttl_contents: Optional[List[str]] = None,
        llm_provider: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        gemini_model: str = DEFAULT_GEMINI_MODEL,
        ollama_url: Optional[str] = None,
        ollama_model: str = DEFAULT_OLLAMA_MODEL,
    ) -> Dict[str, Any]:
        if not question or not question.strip():
            raise ValueError("Natural language question must not be empty.")

        if llm_provider == "none":
            raise ValueError("O motor de inferência LLM está desabilitado nas configurações. Selecione um provedor de LLM (Google Gemini ou Ollama) nas Configurações para utilizar o assistente GraphRAG.")

        cache_key = self._compute_qa_cache_key(question, ttl_contents, active_fpso_id, active_module_id, llm_provider)
        if cache_key in self._qa_cache:
            logger.info(f"[PIPELINE] Cache hit for question: '{question}'")
            cached_output = dict(self._qa_cache[cache_key])
            cached_output["timestamp"] = datetime.now().strftime("%H:%M:%S")
            return cached_output

        logger.info(f"[PIPELINE] Starting GraphRAG processing for question: '{question}' (Provider: {llm_provider or 'auto'})")
        t_global_start = time.time()

        # Step 1: HermiT DL Reasoning and Inferred Graph Materialization
        t0 = time.time()
        logger.info("[PIPELINE] [1/6] Executing HermiT OWL DL Reasoner and materializing inferred graph...")
        graph, audit_result = self.reasoner.materialize_inferred_graph(ttl_contents)
        logger.info(
            f"[PIPELINE] [1/6] Inferred graph ready in {(time.time() - t0)*1000:.2f}ms "
            f"(Consistent: {audit_result['isConsistent']} | Triples: {len(graph)} | fromCache: {audit_result.get('fromCache', False)})"
        )

        if not audit_result["isConsistent"]:
            logger.warning(
                f"[PIPELINE] Inconsistency present in scenario ({len(audit_result.get('justifications', []))} justifications). "
                "Proceeding with asserted facts."
            )

        # Step 2: Semantic Mapping (NLP -> OWL Concepts)
        t1 = time.time()
        logger.info("[PIPELINE] [2/6] Mapping natural language question to OWL concepts...")
        mapping = self.mapper.execute(
            question=question,
            graph=graph,
            active_fpso_hint=active_fpso_id,
            active_module_hint=active_module_id,
            llm_provider=llm_provider,
            gemini_api_key=gemini_api_key,
            gemini_model=gemini_model,
            ollama_url=ollama_url,
            ollama_model=ollama_model,
        )
        logger.info(
            f"[PIPELINE] [2/6] Semantic mapping finished in {(time.time() - t1):.2f}s "
            f"(Classes: {len(mapping.target_classes)}, Properties: {len(mapping.target_properties)}, Entities: {len(mapping.context_entities)})"
        )

        # Step 3: Multi-Hop GraphRAG Subgraph Exploration
        t2 = time.time()
        logger.info("[PIPELINE] [3/6] Exploring multi-hop subgraph neighborhood in NetworkX...")
        exploration = self.explorer.execute(mapping=mapping, graph=graph)
        logger.info(
            f"[PIPELINE] [3/6] Subgraph explored in {(time.time() - t2)*1000:.2f}ms "
            f"({len(exploration.explored_triples)} connected evidence triples)"
        )

        # Step 4: Deterministic / LLM-Driven SPARQL 1.1 Query Synthesis
        t3 = time.time()
        logger.info("[PIPELINE] [4/6] Synthesizing SPARQL 1.1 query...")
        sparql_synthesis = self.synthesizer.execute(
            mapping=mapping,
            exploration=exploration,
            graph=graph,
            llm_provider=llm_provider,
            gemini_api_key=gemini_api_key,
            gemini_model=gemini_model,
            ollama_url=ollama_url,
            ollama_model=ollama_model,
        )
        logger.info(f"[PIPELINE] [4/6] SPARQL query synthesized in {(time.time() - t3):.2f}s")

        # Step 5: SPARQL Query Execution
        t4 = time.time()
        logger.info("[PIPELINE] [5/6] Executing SPARQL query against RDF knowledge graph...")
        sparql_results = self.reasoner.execute_query(query=sparql_synthesis.query_string, graph=graph)
        logger.info(
            f"[PIPELINE] [5/6] SPARQL executed in {(time.time() - t4)*1000:.2f}ms "
            f"({len(sparql_results)} records returned)"
        )

        # Step 6: Grounded Engineering Answer Generation
        t5 = time.time()
        logger.info("[PIPELINE] [6/6] Formulating grounded natural language response...")
        llm_response = self.explainer.execute_qa(
            question=question,
            sparql_query=sparql_synthesis.query_string,
            sparql_results=sparql_results,
            llm_provider=llm_provider,
            gemini_api_key=gemini_api_key,
            gemini_model=gemini_model,
            ollama_url=ollama_url,
            ollama_model=ollama_model,
        )
        logger.info(f"[PIPELINE] [6/6] Response formulated in {(time.time() - t5):.2f}s")

        t_total = time.time() - t_global_start
        logger.info(f"[PIPELINE] Pipeline finished successfully in {t_total:.2f}s total")

        mapping_dict = {
            "target_classes": [{"uri": c.uri, "label": c.label, "local_name": c.local_name} for c in mapping.target_classes],
            "target_properties": [{"uri": p.uri, "label": p.label, "local_name": p.local_name} for p in mapping.target_properties],
            "context_entities": [{"uri": e.uri, "label": e.label, "local_name": e.local_name} for e in mapping.context_entities],
        }

        exploration_dict = {
            "seed_nodes": exploration.seed_nodes,
            "explored_triples": [
                {
                    "subject": t.subject_label,
                    "predicate": t.predicate_label,
                    "object": t.object_label,
                }
                for t in exploration.explored_triples
            ],
            "relevant_predicates": exploration.relevant_predicates,
            "subgraph_text": exploration.subgraph_text,
            "discovered_instances": exploration.discovered_instances,
        }

        qa_output = {
            "question": question,
            "semantic_mapping": mapping_dict,
            "exploration": exploration_dict,
            "sparql_query": sparql_synthesis.query_string,
            "sparql_intent": sparql_synthesis.intent_summary,
            "sparql_results": sparql_results,
            "llm_response": llm_response,
            "llm_provider": llm_provider or "auto",
            "hermit_consistency": {
                "isConsistent": audit_result["isConsistent"],
                "justificationsCount": len(audit_result.get("justifications", [])),
                "inferredTriples": len(graph),
                "fromCache": audit_result.get("fromCache", False),
            },
            "provenance": ["fpeo-collect-equipments-abox.ttl", "fpeo-equipments-core.ttl", "fpeo-dynamical-equipments.ttl"],
            "timestamp": datetime.now().strftime("%H:%M:%S"),
        }

        self._qa_cache[cache_key] = qa_output
        return qa_output

qa_pipeline_instance = GraphRAGPipeline()
