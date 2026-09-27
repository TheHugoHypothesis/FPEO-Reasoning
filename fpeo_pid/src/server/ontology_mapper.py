import os
import re
import unicodedata
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from pydantic import BaseModel, Field
import rdflib
from rdflib.namespace import RDF, RDFS, OWL

from config import (
    STD_NAMESPACES,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_OLLAMA_MODEL,
    GROUNDING_SYSTEM_INSTRUCTION,
    GROUNDING_PROMPT_TEMPLATE,
)
from llm_provider import UnifiedLLMProvider, unified_llm_provider

logger = logging.getLogger("fpeo.ontology_mapper")

@dataclass
class SemanticConcept:
    uri: str
    local_name: str
    label: str
    kind: str
    confidence: float

@dataclass
class SemanticMapping:
    raw_question: str
    tokens: List[str]
    target_classes: List[SemanticConcept] = field(default_factory=list)
    target_properties: List[SemanticConcept] = field(default_factory=list)
    context_entities: List[SemanticConcept] = field(default_factory=list)
    tbox_summary: str = ""
    confidence_score: float = 1.0

class SemanticGroundingSchema(BaseModel):
    intent: str = Field(
        description="Concise query intent tag, e.g. 'list_equipment_by_type', 'list_equipment_in_module', 'inspect_specs', 'trace_connections'."
    )
    matched_class_uris: List[str] = Field(
        description="EXACT URIs of TBox classes representing equipment types."
    )
    matched_context_uris: List[str] = Field(
        description="EXACT URIs of named ABox individuals."
    )
    matched_property_uris: List[str] = Field(
        description="EXACT URIs of TBox object/data properties."
    )
    reasoning: str = Field(
        description="Explanation of the grounding decisions."
    )

class OntologySchemaExtractor:
    """Extracts classes, properties, and named individuals from an RDF knowledge graph with caching."""

    def __init__(self):
        self._schema_cache: Dict[int, Tuple[Dict, Dict, Dict]] = {}

    @staticmethod
    def get_local_name(uri_str: str) -> str:
        return uri_str.split("#")[-1].split("/")[-1]

    @staticmethod
    def strip_accents(text: str) -> str:
        return ''.join(c for c in unicodedata.normalize('NFKD', text) if unicodedata.category(c) != 'Mn')

    @classmethod
    def extract_tokens(cls, text: str) -> List[str]:
        return re.findall(r'[a-z0-9]+-?[a-z0-9]+|[a-z0-9]+', cls.strip_accents(text.lower()))

    @staticmethod
    def is_standard_uri(uri: str) -> bool:
        return any(uri.startswith(p) for p in STD_NAMESPACES)

    @staticmethod
    def get_label(graph: rdflib.Graph, uri: str, fallback: str) -> str:
        return next((str(o) for o in graph.objects(rdflib.URIRef(uri), RDFS.label)), fallback)

    @staticmethod
    def get_comment(graph: rdflib.Graph, uri: str) -> str:
        return next((str(o) for o in graph.objects(rdflib.URIRef(uri), RDFS.comment)), "")

    def extract_schema(self, graph: rdflib.Graph) -> Tuple[Dict[str, Dict], Dict[str, Dict], Dict[str, Dict]]:
        graph_key = id(graph)
        if graph_key in self._schema_cache:
            return self._schema_cache[graph_key]

        classes: Dict[str, Dict] = {}
        properties: Dict[str, Dict] = {}
        individuals: Dict[str, Dict] = {}

        for cls_type in [OWL.Class, RDFS.Class]:
            for s in graph.subjects(RDF.type, cls_type):
                uri = str(s)
                if self.is_standard_uri(uri) or not uri.startswith("http"):
                    continue
                lbl = self.get_label(graph, uri, self.get_local_name(uri))
                parents = [str(p) for p in graph.objects(s, RDFS.subClassOf) if not self.is_standard_uri(str(p))]
                comment = self.get_comment(graph, uri)
                classes[uri] = {
                    "uri": uri,
                    "local_name": self.get_local_name(uri),
                    "label": lbl,
                    "parents": parents,
                    "comment": comment
                }

        for prop_type in [OWL.ObjectProperty, OWL.DatatypeProperty, RDF.Property]:
            for s in graph.subjects(RDF.type, prop_type):
                uri = str(s)
                if self.is_standard_uri(uri):
                    continue
                lbl = self.get_label(graph, uri, self.get_local_name(uri))
                domain = [str(d) for d in graph.objects(s, RDFS.domain)]
                range_ = [str(r) for r in graph.objects(s, RDFS.range)]
                comment = self.get_comment(graph, uri)
                properties[uri] = {
                    "uri": uri,
                    "local_name": self.get_local_name(uri),
                    "label": lbl,
                    "domain": domain,
                    "range": range_,
                    "comment": comment
                }

        for s in set(graph.subjects(RDF.type, None)):
            if not isinstance(s, rdflib.URIRef):
                continue
            uri = str(s)
            if uri in classes or uri in properties or self.is_standard_uri(uri):
                continue
            local_name = self.get_local_name(uri)
            lbl = self.get_label(graph, uri, local_name)
            types = [
                str(t) for t in graph.objects(s, RDF.type)
                if str(t) != str(OWL.NamedIndividual) and not self.is_standard_uri(str(t))
            ]
            individuals[uri] = {
                "uri": uri,
                "local_name": local_name,
                "label": lbl,
                "types": types
            }

        self._schema_cache[graph_key] = (classes, properties, individuals)
        return classes, properties, individuals

    def build_class_tree(self, classes: Dict[str, Dict], question: str = "", max_lines: int = 40) -> str:
        q_tokens = [t.lower().rstrip("es").rstrip("s") for t in re.findall(r"\w+", question) if len(t) > 2]

        def get_score(uri: str, d: Dict) -> int:
            score = 0
            text = (d.get("local_name", "") + " " + d.get("label", "") + " " + d.get("comment", "")).lower()
            for tok in q_tokens:
                if tok in text:
                    score += 10
            return score

        # Top relevant classes based on question
        scored_uris = sorted(classes.keys(), key=lambda u: get_score(u, classes[u]), reverse=True)
        selected_set = set(scored_uris[:max_lines])

        # Ensure parent classes of top matches are included
        for u in list(selected_set):
            for p in classes.get(u, {}).get("parents", []):
                if p in classes:
                    selected_set.add(p)

        filtered_classes = {u: classes[u] for u in selected_set if u in classes}

        children: Dict[str, List[str]] = {u: [] for u in filtered_classes}
        roots: List[str] = []

        for uri, d in filtered_classes.items():
            own_parents = [p for p in d["parents"] if p in filtered_classes]
            if own_parents:
                for p in own_parents:
                    if uri not in children[p]:
                        children[p].append(uri)
            else:
                roots.append(uri)

        lines: List[str] = []
        visited: Set[str] = set()

        def render(uri: str, depth: int):
            if uri in visited or depth > 3:
                return
            visited.add(uri)
            d = filtered_classes.get(uri)
            if not d:
                return
            indent = "  " * depth
            lines.append(f"{indent}- <{uri}> ({d['local_name']})")
            for child in sorted(children.get(uri, []), key=lambda u: filtered_classes.get(u, {}).get('local_name', u)):
                render(child, depth + 1)

        for root in sorted(roots, key=lambda u: filtered_classes.get(u, {}).get('local_name', u)):
            render(root, 0)

        if not lines:
            for uri, d in list(classes.items())[:max_lines]:
                lines.append(f"- <{uri}> ({d['local_name']})")

        return "\n".join(lines[:max_lines])

class SemanticMapperService:
    """Executor that grounds natural language questions into formal OWL classes and entities."""

    def __init__(
        self,
        llm_provider: UnifiedLLMProvider = unified_llm_provider,
        extractor: Optional[OntologySchemaExtractor] = None,
        prompt_template: str = GROUNDING_PROMPT_TEMPLATE,
        system_instruction: str = GROUNDING_SYSTEM_INSTRUCTION,
    ):
        self.llm_provider = llm_provider
        self.extractor = extractor or OntologySchemaExtractor()
        self.prompt_template = prompt_template
        self.system_instruction = system_instruction

    def execute(
        self,
        question: str,
        graph: rdflib.Graph,
        active_fpso_hint: Optional[str] = None,
        active_module_hint: Optional[str] = None,
        llm_provider: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        gemini_model: str = DEFAULT_GEMINI_MODEL,
        ollama_url: Optional[str] = None,
        ollama_model: str = DEFAULT_OLLAMA_MODEL,
    ) -> SemanticMapping:
        classes_dict, props_dict, inds_dict = self.extractor.extract_schema(graph)
        resolved_provider = self.llm_provider.resolve_provider(llm_provider, gemini_api_key, ollama_url)

        if resolved_provider == "none":
            raise ValueError("O motor de inferência LLM está desabilitado nas configurações.")

        class_tree_str = self.extractor.build_class_tree(classes_dict, question=question)
        props_str = "\n".join(
            f"- <{u}> ({d['local_name']})"
            for u, d in list(props_dict.items())[:20]
        )

        q_lower = question.lower().replace("-", "")
        q_tokens = [t for t in q_lower.split() if len(t) > 2]

        def score_ind(u: str, d: Dict) -> int:
            score = 0
            name = (d["local_name"] + " " + d["label"] + " " + " ".join(d.get("types", []))).lower().replace("-", "")
            for tok in q_tokens:
                if tok in name:
                    score += 10
            return score

        sorted_inds = sorted(inds_dict.items(), key=lambda item: score_ind(item[0], item[1]), reverse=True)
        inds_str = "\n".join(f"- <{u}> ({d['local_name']})" for u, d in sorted_inds[:20])

        ui_context_lines = []
        if active_fpso_hint and active_fpso_hint != 'ALL':
            matches = [(u, d) for u, d in inds_dict.items() if active_fpso_hint in u or active_fpso_hint in d["local_name"]]
            if matches:
                u, d = matches[0]
                ui_context_lines.append(f"  * Active Workspace Scope: <{u}> \"{d['label']}\"")
        if active_module_hint and active_module_hint != 'ALL':
            matches = [(u, d) for u, d in inds_dict.items() if active_module_hint in u or active_module_hint in d["local_name"]]
            if matches:
                u, d = matches[0]
                ui_context_lines.append(f"  * Active Module Scope: <{u}> \"{d['label']}\"")
        ui_context_str = ("\n[WORKSPACE SCOPE CONTEXT]\n" + "\n".join(ui_context_lines)) if ui_context_lines else ""

        grounding_prompt = self.prompt_template.format(
            ui_context=ui_context_str,
            question=question,
            class_tree=class_tree_str,
            properties=props_str,
            individuals=inds_str,
        )

        # 1. Deterministic candidates from graph matching question terms and UI hints
        q_tokens = [t.lower().rstrip("es").rstrip("s") for t in re.findall(r"\w+", question) if len(t) > 2]
        
        det_classes: List[SemanticConcept] = []
        for u, d in classes_dict.items():
            text = (d.get("local_name", "") + " " + d.get("label", "")).lower()
            if any(tok in text for tok in q_tokens):
                det_classes.append(SemanticConcept(
                    uri=u,
                    local_name=d["local_name"],
                    label=d["label"],
                    kind="class",
                    confidence=0.95,
                ))

        det_context: List[SemanticConcept] = []
        q_lower = question.lower().replace("-", "")
        for u, d in inds_dict.items():
            name = (d["local_name"] + " " + d["label"]).lower().replace("-", "")
            if any(tok in name for tok in q_lower.split() if len(tok) > 2):
                det_context.append(SemanticConcept(
                    uri=u,
                    local_name=d["local_name"],
                    label=d["label"],
                    kind="individual",
                    confidence=0.95,
                ))

        # Explicit UI hints
        if active_fpso_hint and active_fpso_hint != 'ALL':
            for u, d in inds_dict.items():
                if active_fpso_hint in u or active_fpso_hint in d["local_name"]:
                    if not any(c.uri == u for c in det_context):
                        det_context.append(SemanticConcept(
                            uri=u,
                            local_name=d["local_name"],
                            label=d["label"],
                            kind="individual",
                            confidence=1.0,
                        ))

        # 2. Invoke LLM for structured grounding
        llm_grounded_classes: List[SemanticConcept] = []
        llm_grounded_context: List[SemanticConcept] = []
        llm_grounded_props: List[SemanticConcept] = []
        intent_tag = "list_equipment_by_type"
        reasoning_text = "Grounded from ontology knowledge graph"

        try:
            result = self.llm_provider.generate_structured(
                prompt=grounding_prompt,
                response_schema=SemanticGroundingSchema,
                system_instruction=self.system_instruction,
                provider=resolved_provider,
                gemini_api_key=gemini_api_key,
                gemini_model=gemini_model,
                ollama_url=ollama_url,
                ollama_model=ollama_model,
            )
            intent_tag = result.intent or intent_tag
            reasoning_text = result.reasoning or reasoning_text

            for uri in result.matched_class_uris:
                if uri in classes_dict:
                    llm_grounded_classes.append(SemanticConcept(
                        uri=uri,
                        local_name=classes_dict[uri]["local_name"],
                        label=classes_dict[uri]["label"],
                        kind="class",
                        confidence=1.0,
                    ))

            for uri in result.matched_context_uris:
                if uri in inds_dict:
                    llm_grounded_context.append(SemanticConcept(
                        uri=uri,
                        local_name=inds_dict[uri]["local_name"],
                        label=inds_dict[uri]["label"],
                        kind="individual",
                        confidence=1.0,
                    ))

            for uri in result.matched_property_uris:
                if uri in props_dict:
                    llm_grounded_props.append(SemanticConcept(
                        uri=uri,
                        local_name=props_dict[uri]["local_name"],
                        label=props_dict[uri]["label"],
                        kind="property",
                        confidence=1.0,
                    ))
        except Exception as llm_err:
            logger.warning(f"[SEMANTIC MAPPER] LLM structured grounding failed, falling back to graph grounding: {llm_err}")

        # 3. Merge: Guarantee that grounded classes & context are NEVER empty if graph matches exist
        target_classes = llm_grounded_classes if llm_grounded_classes else det_classes
        context_entities = llm_grounded_context if llm_grounded_context else det_context
        target_properties = llm_grounded_props

        # Expand equivalent classes
        seen_cls: Set[str] = {c.uri for c in target_classes}
        expanded = list(target_classes)
        for c in list(target_classes):
            ref = rdflib.URIRef(c.uri)
            for rel in list(graph.objects(ref, OWL.equivalentClass)) + list(graph.subjects(OWL.equivalentClass, ref)):
                rel_str = str(rel)
                if rel_str not in seen_cls and not self.extractor.is_standard_uri(rel_str) and rel_str in classes_dict:
                    seen_cls.add(rel_str)
                    expanded.append(SemanticConcept(
                        uri=rel_str,
                        local_name=classes_dict[rel_str]["local_name"],
                        label=classes_dict[rel_str]["label"],
                        kind="class",
                        confidence=0.95,
                    ))
        target_classes = expanded

        summary_lines = [f"Intent: {intent_tag}", "", "Matched Classes:"]
        for c in target_classes:
            summary_lines.append(f"  <{c.uri}> ({c.label})")
        summary_lines.append("\nMatched Context Entities:")
        for e in context_entities:
            summary_lines.append(f"  <{e.uri}> ({e.label})")
        summary_lines.append("\nMatched Properties:")
        for p in target_properties:
            d = props_dict.get(p.uri, {})
            summary_lines.append(f"  <{p.uri}> ({p.label})" + (f" - {d.get('comment','')[:60]}" if d.get('comment') else ""))
        summary_lines.append(f"\nReasoning: {reasoning_text}")

        return SemanticMapping(
            raw_question=question,
            tokens=self.extractor.extract_tokens(question),
            target_classes=target_classes,
            target_properties=target_properties,
            context_entities=context_entities,
            tbox_summary="\n".join(summary_lines),
            confidence_score=1.0,
        )

semantic_mapper_service = SemanticMapperService()
