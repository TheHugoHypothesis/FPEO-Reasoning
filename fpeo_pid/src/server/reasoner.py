import os
import re
import tempfile
import hashlib
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from datetime import datetime
import rdflib
import networkx as nx
import jpype
import jpype.imports

from config import HERMIT_JAR, OWLAPI_JAR, ONTOLOGY_DIR, BASE_TBOX_FILES, STD_NAMESPACES

logger = logging.getLogger("fpeo.reasoner")

class HermitReasonerService:
    """Manages JVM lifecycle, OWL DL consistency checking, justification isolation, and inferred graph materialization."""

    def __init__(self, hermit_jar: str = HERMIT_JAR, owlapi_jar: str = OWLAPI_JAR, ontology_dir: str = ONTOLOGY_DIR):
        self.hermit_jar = hermit_jar
        self.owlapi_jar = owlapi_jar
        self.ontology_dir = ontology_dir

        self._base_tbox_graph: Optional[rdflib.Graph] = None
        self._enriched_graphs_cache: Dict[str, rdflib.Graph] = {}
        self._inferred_graphs_cache: Dict[str, rdflib.Graph] = {}
        self._audit_cache: Dict[str, Dict[str, Any]] = {}

    def ensure_jvm(self) -> None:
        """Initializes the Java Virtual Machine with HermiT and OWLAPI classpaths if not already started."""
        if not jpype.isJVMStarted():
            logger.info("[REASONER] Initializing JVM with HermiT and OWLAPI JARs...")
            jpype.startJVM(classpath=[self.hermit_jar, self.owlapi_jar], convertStrings=True)

    @staticmethod
    def get_local_name(uri_str: str) -> str:
        return uri_str.split("#")[-1].split("/")[-1]

    @classmethod
    def format_owl_axiom(cls, axiom_str: str) -> str:
        """Shortens full HTTP URIs in OWL axioms to local names for readable diagnostics."""
        def shorten_match(match):
            uri = match.group(0).strip("<>")
            return cls.get_local_name(uri)
        return re.sub(r"<http://[^>]+>", shorten_match, axiom_str)

    def compute_payload_hash(self, ttl_contents: Optional[List[str]]) -> str:
        """Computes a deterministic SHA-256 hash for the given list of TTL string payloads."""
        if not ttl_contents:
            return "EMPTY_PAYLOAD"
        normalized = "###___PAYLOAD_DELIMITER___###".join(sorted(c.strip() for c in ttl_contents if c and c.strip()))
        if not normalized:
            return "EMPTY_PAYLOAD"
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def get_base_tbox_graph(self) -> rdflib.Graph:
        """Loads and caches the immutable 11 base TBox ontologies into memory once."""
        if self._base_tbox_graph is not None:
            return self._base_tbox_graph

        logger.info("[REASONER] Pre-loading base TBox ontologies into memory cache...")
        graph = rdflib.Graph()
        for fname in BASE_TBOX_FILES:
            fpath = os.path.join(self.ontology_dir, fname)
            if os.path.exists(fpath):
                try:
                    graph.parse(fpath, format="turtle")
                except Exception as exc:
                    logger.warning(f"[REASONER] Base ontology load warning ({fname}): {exc}")

        self._base_tbox_graph = graph
        logger.info(f"[REASONER] Base TBox cached with {len(self._base_tbox_graph)} triples.")
        return self._base_tbox_graph

    def get_ontology_graph(self, extra_ttl_contents: Optional[List[str]] = None) -> rdflib.Graph:
        """Returns an RDF graph combining the base TBox and any supplied ABox payloads, with SHA-256 caching."""
        if not extra_ttl_contents or not any(c.strip() for c in extra_ttl_contents):
            return self.get_base_tbox_graph()

        payload_hash = self.compute_payload_hash(extra_ttl_contents)
        if payload_hash in self._enriched_graphs_cache:
            return self._enriched_graphs_cache[payload_hash]

        base_tbox = self.get_base_tbox_graph()
        graph = rdflib.Graph()
        for triple in base_tbox:
            graph.add(triple)

        for content in extra_ttl_contents:
            if content and content.strip():
                try:
                    graph.parse(data=content, format="turtle")
                except Exception as exc:
                    logger.warning(f"[REASONER] Extra TTL parse warning: {exc}")

        self._enriched_graphs_cache[payload_hash] = graph
        return graph

    def analyze_consistency(self, ttl_contents: List[str]) -> Dict[str, Any]:
        """
        Executes OWL DL Consistency Checking, Minimal Inconsistency Justification Extraction,
        and Inferred Axiom Materialization using HermiT.
        """
        payload_hash = self.compute_payload_hash(ttl_contents)

        if payload_hash in self._audit_cache:
            logger.info(f"[REASONER] Cache hit: Reusing HermiT analysis for hash {payload_hash[:12]}")
            cached = dict(self._audit_cache[payload_hash])
            cached["fromCache"] = True
            cached["timestamp"] = datetime.now().strftime("%H:%M:%S")
            return cached

        logger.info(f"[REASONER] Cache miss: Executing HermiT DL Reasoner for hash {payload_hash[:12]}")
        self.ensure_jvm()

        from org.semanticweb.owlapi.apibinding import OWLManager
        from org.semanticweb.HermiT import Reasoner
        from org.semanticweb.owlapi.util import (
            InferredOntologyGenerator,
            InferredSubClassAxiomGenerator,
            InferredClassAssertionAxiomGenerator,
            InferredPropertyAssertionGenerator,
            InferredInverseObjectPropertiesAxiomGenerator,
            InferredEquivalentClassAxiomGenerator,
        )
        from org.semanticweb.owlapi.io import RDFXMLOntologyFormat, StringDocumentTarget
        from java.util import ArrayList, HashSet
        from java.io import File

        base_tbox = self.get_base_tbox_graph()
        graph = rdflib.Graph()
        for triple in base_tbox:
            graph.add(triple)

        for content in ttl_contents:
            if content and content.strip():
                try:
                    graph.parse(data=content, format="turtle")
                except Exception as exc:
                    logger.warning(f"[REASONER] TTL payload parse warning: {exc}")

        flat_graph = rdflib.Graph()
        for s, p, o in graph:
            if p != rdflib.OWL.imports:
                flat_graph.add((s, p, o))

        with tempfile.NamedTemporaryFile(suffix=".xml", mode="w", delete=False) as f_temp:
            f_temp.write(flat_graph.serialize(format="xml"))
            temp_xml_path = f_temp.name

        try:
            manager = OWLManager.createOWLOntologyManager()
            ontology = manager.loadOntologyFromOntologyDocument(File(temp_xml_path))
            factory = Reasoner.ReasonerFactory()
            reasoner = factory.createReasoner(ontology)
            is_consistent = bool(reasoner.isConsistent())

            justifications: List[Dict[str, Any]] = []
            inferred_triples_count = 0

            if is_consistent:
                inferred_ontology = manager.createOntology()
                generators = [
                    InferredClassAssertionAxiomGenerator(),
                    InferredSubClassAxiomGenerator(),
                    InferredPropertyAssertionGenerator(),
                    InferredInverseObjectPropertiesAxiomGenerator(),
                    InferredEquivalentClassAxiomGenerator(),
                ]
                gen_list = ArrayList()
                for gen in generators:
                    gen_list.add(gen)

                iog = InferredOntologyGenerator(reasoner, gen_list)
                iog.fillOntology(manager, inferred_ontology)

                target = StringDocumentTarget()
                manager.saveOntology(inferred_ontology, RDFXMLOntologyFormat(), target)
                inferred_xml = str(target.toString())

                inferred_graph = rdflib.Graph()
                for tr in graph:
                    inferred_graph.add(tr)
                inferred_graph.parse(data=inferred_xml, format="xml")

                inferred_triples_count = len(inferred_graph)
                self._inferred_graphs_cache[payload_hash] = inferred_graph
                logger.info(
                    f"[REASONER] Inferred Knowledge Graph materialized: {inferred_triples_count} triples "
                    f"(+{len(inferred_graph) - len(graph)} inferred facts)."
                )
            else:
                all_axioms = list(ontology.getAxioms())
                candidate_axioms = [
                    ax for ax in all_axioms
                    if any(kw in str(ax) for kw in ["ClassAssertion", "Disjoint", "ObjectPropertyAssertion", "SubClassOf"])
                ]

                minimal_axioms: Set[Any] = set(candidate_axioms)

                for ax in candidate_axioms:
                    test_set = minimal_axioms - {ax}
                    if not test_set:
                        continue
                    temp_mgr = OWLManager.createOWLOntologyManager()
                    test_ont = temp_mgr.createOntology(HashSet(list(test_set)))
                    r = factory.createReasoner(test_ont)
                    try:
                        still_inconsistent = not r.isConsistent()
                    except Exception:
                        still_inconsistent = True
                    r.dispose()

                    if still_inconsistent:
                        minimal_axioms.remove(ax)

                scenario_entities: Set[str] = set()
                for ax in minimal_axioms:
                    ax_str = str(ax)
                    if any(kw in ax_str for kw in ["ClassAssertion", "ObjectPropertyAssertion"]):
                        for u in re.findall(r"<http://[^>]+>", ax_str):
                            scenario_entities.add(self.get_local_name(u.strip("<>")))

                raw_tbox: List[str] = []
                for ax in minimal_axioms:
                    ax_str = str(ax)
                    if any(kw in ax_str for kw in ["DisjointClasses", "DisjointObjectProperties"]):
                        raw_tbox.append(self.format_owl_axiom(ax_str))
                    elif any(kw in ax_str for kw in ["SubClassOf", "EquivalentClasses"]):
                        if any(ent in ax_str for ent in scenario_entities if len(ent) > 3):
                            raw_tbox.append(self.format_owl_axiom(ax_str))

                formatted_tbox = list(dict.fromkeys(raw_tbox))

                raw_abox: List[str] = []
                for ax in minimal_axioms:
                    ax_raw = str(ax)
                    if any(kw in ax_raw for kw in ["ClassAssertion", "ObjectPropertyAssertion", "DataPropertyAssertion"]):
                        if any(kw in ax_raw for kw in ["abox", "scenario", "K_", "V_", "Port", "#"]):
                            raw_abox.append(self.format_owl_axiom(ax_raw))

                formatted_abox = list(dict.fromkeys(raw_abox))

                involved_uris: List[str] = []
                for ax in minimal_axioms:
                    for u in re.findall(r"<http://[^>]+>", str(ax)):
                        clean_u = u.strip("<>")
                        if clean_u not in involved_uris and not clean_u.startswith(STD_NAMESPACES):
                            involved_uris.append(clean_u)

                justifications.append({
                    "id": "hermit_minimal_justification_01",
                    "title": "Semantic Inconsistency Detected by HermiT DL Reasoner",
                    "tboxAxioms": formatted_tbox,
                    "aboxTriples": formatted_abox,
                    "involvedEquipmentUris": involved_uris,
                    "graphRagContextText": "",
                    "severity": "error",
                })

                self._inferred_graphs_cache[payload_hash] = graph

            reasoner.dispose()

            result = {
                "isConsistent": is_consistent,
                "status": "valid" if is_consistent else "inconsistent",
                "justifications": justifications,
                "assertedTriples": len(graph),
                "inferredTriples": inferred_triples_count or len(graph),
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "fromCache": False,
            }

            self._audit_cache[payload_hash] = result
            return result

        finally:
            if os.path.exists(temp_xml_path):
                os.remove(temp_xml_path)

    def materialize_inferred_graph(self, ttl_contents: Optional[List[str]] = None) -> Tuple[rdflib.Graph, Dict[str, Any]]:
        """
        Executes HermiT OWL DL reasoning and returns the materialized Inferred Knowledge Graph.
        Returns cached instances in sub-millisecond time for identical payloads.
        """
        payload_hash = self.compute_payload_hash(ttl_contents)

        if payload_hash in self._inferred_graphs_cache and payload_hash in self._audit_cache:
            logger.info(f"[REASONER] Cache hit: Inferred Graph for hash {payload_hash[:12]}")
            cached_audit = dict(self._audit_cache[payload_hash])
            cached_audit["fromCache"] = True
            return self._inferred_graphs_cache[payload_hash], cached_audit

        audit_result = self.analyze_consistency(ttl_contents or [])
        inferred_graph = self._inferred_graphs_cache.get(payload_hash)
        if inferred_graph is None:
            inferred_graph = self.get_ontology_graph(ttl_contents)

        return inferred_graph, audit_result

    def execute_sparql(self, query: str, graph: Optional[rdflib.Graph] = None) -> List[Dict[str, str]]:
        """Executes a SPARQL query on the provided or default ontology graph."""
        target_graph = graph if graph is not None else self.get_ontology_graph()
        results: List[Dict[str, str]] = []

        try:
            qres = target_graph.query(query)
            for row in qres:
                row_dict: Dict[str, str] = {}
                if hasattr(row, 'asdict'):
                    for k, v in row.asdict().items():
                        row_dict[str(k)] = str(v)
                else:
                    for idx, var in enumerate(qres.vars):
                        val = row[idx]
                        if val is not None:
                            row_dict[str(var)] = str(val)
                results.append(row_dict)
        except Exception as exc:
            logger.error(f"[REASONER] SPARQL execution error: {exc}")
            raise exc

        return results

    # Aliases for executor pattern
    execute_audit = analyze_consistency
    execute_materialize = materialize_inferred_graph
    execute_query = execute_sparql

reasoner_service = HermitReasonerService()


