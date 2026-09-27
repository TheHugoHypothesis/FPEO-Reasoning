import logging
from typing import List, Dict, Any, Set, Tuple, Optional
from dataclasses import dataclass
import rdflib
from rdflib.namespace import RDF, RDFS, OWL

from config import STD_NAMESPACES, IGNORE_PREDICATES
from ontology_mapper import SemanticMapping
from reasoner import HermitReasonerService

logger = logging.getLogger("fpeo.graph_explorer")

@dataclass
class ExploredTriple:
    subject_uri: str
    subject_label: str
    predicate_uri: str
    predicate_label: str
    object_uri: str
    object_label: str
    is_seed: bool = False
    hop: int = 1

@dataclass
class ExplorationResult:
    seed_nodes: List[Dict[str, Any]]
    explored_triples: List[ExploredTriple]
    relevant_predicates: List[str]
    subgraph_text: str
    discovered_instances: List[Dict[str, Any]]

class GraphRAGExplorerService:
    """Performs multi-hop ontology-guided neighborhood exploration over RDF Knowledge Graphs."""

    @staticmethod
    def get_node_label(node: rdflib.term.Identifier, graph: rdflib.Graph) -> str:
        for obj in graph.objects(node, RDFS.label):
            if str(obj).strip():
                return str(obj).strip()
        return HermitReasonerService.get_local_name(str(node))

    def _resolve_seed_nodes(self, mapping: SemanticMapping, graph: rdflib.Graph) -> Tuple[List[Dict[str, Any]], Set[str]]:
        seed_nodes: List[Dict[str, Any]] = []
        seen_seeds: Set[str] = set()

        for ent in mapping.context_entities:
            uri_ref = rdflib.URIRef(ent.uri)
            if ent.uri not in seen_seeds:
                seen_seeds.add(ent.uri)
                types = [
                    str(t) for t in graph.objects(uri_ref, RDF.type)
                    if str(t) != str(OWL.NamedIndividual) and not str(t).startswith(STD_NAMESPACES)
                ]
                seed_nodes.append({
                    "uri": ent.uri,
                    "local_name": ent.local_name,
                    "label": ent.label,
                    "types": [HermitReasonerService.get_local_name(t) for t in types],
                    "kind": "context_entity",
                })

        for cls_concept in mapping.target_classes:
            class_ref = rdflib.URIRef(cls_concept.uri)
            for instance in graph.subjects(RDF.type, class_ref):
                inst_str = str(instance)
                if inst_str not in seen_seeds and not inst_str.startswith(STD_NAMESPACES):
                    seen_seeds.add(inst_str)
                    lbl = self.get_node_label(instance, graph)
                    seed_nodes.append({
                        "uri": inst_str,
                        "local_name": HermitReasonerService.get_local_name(inst_str),
                        "label": lbl,
                        "types": [cls_concept.local_name],
                        "kind": "class_instance",
                    })

            for sub_class in graph.subjects(RDFS.subClassOf, class_ref):
                for instance in graph.subjects(RDF.type, sub_class):
                    inst_str = str(instance)
                    if inst_str not in seen_seeds and not inst_str.startswith(STD_NAMESPACES):
                        seen_seeds.add(inst_str)
                        lbl = self.get_node_label(instance, graph)
                        seed_nodes.append({
                            "uri": inst_str,
                            "local_name": HermitReasonerService.get_local_name(inst_str),
                            "label": lbl,
                            "types": [HermitReasonerService.get_local_name(str(sub_class))],
                            "kind": "class_instance",
                        })

        return seed_nodes, seen_seeds

    def explore_neighborhood(
        self,
        mapping: SemanticMapping,
        graph: rdflib.Graph,
        max_seeds: int = 15,
        max_hops: int = 2,
    ) -> ExplorationResult:
        seed_nodes, seen_seeds = self._resolve_seed_nodes(mapping, graph)

        explored_triples: List[ExploredTriple] = []
        seen_triples: Set[Tuple[str, str, str]] = set()
        relevant_predicates: Set[str] = set()

        current_frontier = [rdflib.URIRef(s["uri"]) for s in seed_nodes[:max_seeds]]

        for hop in range(1, max_hops + 1):
            next_frontier: Set[rdflib.URIRef] = set()

            for node in current_frontier:
                node_str = str(node)
                node_label = self.get_node_label(node, graph)

                for p, o in graph.predicate_objects(subject=node):
                    p_str = str(p)
                    o_str = str(o)
                    if p_str in IGNORE_PREDICATES or o_str.startswith(STD_NAMESPACES):
                        continue

                    triple_key = (node_str, p_str, o_str)
                    if triple_key not in seen_triples:
                        seen_triples.add(triple_key)
                        pred_lbl = HermitReasonerService.get_local_name(p_str)
                        obj_lbl = self.get_node_label(o, graph) if isinstance(o, rdflib.URIRef) else str(o)
                        relevant_predicates.add(pred_lbl)

                        explored_triples.append(ExploredTriple(
                            subject_uri=node_str,
                            subject_label=node_label,
                            predicate_uri=p_str,
                            predicate_label=pred_lbl,
                            object_uri=o_str,
                            object_label=obj_lbl,
                            is_seed=(node_str in seen_seeds),
                            hop=hop,
                        ))

                        if isinstance(o, rdflib.URIRef) and not o_str.startswith(STD_NAMESPACES) and hop < max_hops:
                            next_frontier.add(o)

                for s, p in graph.subject_predicates(object=node):
                    s_str = str(s)
                    p_str = str(p)
                    if p_str in IGNORE_PREDICATES or s_str.startswith(STD_NAMESPACES):
                        continue

                    triple_key = (s_str, p_str, node_str)
                    if triple_key not in seen_triples:
                        seen_triples.add(triple_key)
                        pred_lbl = HermitReasonerService.get_local_name(p_str)
                        subj_lbl = self.get_node_label(s, graph)
                        relevant_predicates.add(pred_lbl)

                        explored_triples.append(ExploredTriple(
                            subject_uri=s_str,
                            subject_label=subj_lbl,
                            predicate_uri=p_str,
                            predicate_label=pred_lbl,
                            object_uri=node_str,
                            object_label=node_label,
                            is_seed=False,
                            hop=hop,
                        ))

                        if isinstance(s, rdflib.URIRef) and not s_str.startswith(STD_NAMESPACES) and hop < max_hops:
                            next_frontier.add(s)

            current_frontier = list(next_frontier)[:30]

        context_lines = [
            "=== SUBGRAPH EVIDENCE (MULTI-HOP ONTOLOGY EXPLORATION) ===",
            f"Question: '{mapping.raw_question}'",
            "\n1. SEED ENTITIES IDENTIFIED:",
        ]

        for s_info in seed_nodes[:15]:
            types_str = ", ".join(s_info["types"]) if s_info["types"] else "Entity"
            context_lines.append(f"  * <{s_info['uri']}> ({s_info['label']}) [Type: {types_str}]")

        context_lines.append("\n2. MULTI-HOP CONNECTIONS AND RELATIONS EXPLORED:")
        for t in sorted(explored_triples, key=lambda x: (x.hop, x.subject_label, x.predicate_label))[:45]:
            context_lines.append(f"  [Hop {t.hop}] ({t.subject_label}) --[{t.predicate_label}]--> ({t.object_label})")

        subgraph_text = "\n".join(context_lines)

        return ExplorationResult(
            seed_nodes=seed_nodes,
            explored_triples=explored_triples,
            relevant_predicates=sorted(list(relevant_predicates)),
            subgraph_text=subgraph_text,
            discovered_instances=seed_nodes,
        )

    # Alias for executor pattern
    execute = explore_neighborhood

graph_explorer_service = GraphRAGExplorerService()
