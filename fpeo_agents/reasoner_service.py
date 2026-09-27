import os
import re
import tempfile
import hashlib
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from datetime import datetime
import rdflib
import jpype
import jpype.imports

try:
    from config import HERMIT_JAR, OWLAPI_JAR, ONTOLOGY_DIR, BASE_TBOX_FILES, STD_NAMESPACES
except ImportError:
    HERMIT_JAR = os.getenv("HERMIT_JAR", "lib/HermiT.jar")
    OWLAPI_JAR = os.getenv("OWLAPI_JAR", "lib/owlapi-osgidistribution-4.5.25.jar")
    ONTOLOGY_DIR = os.getenv("ONTOLOGY_DIR", ".")
    BASE_TBOX_FILES = [
        "fpeo-equipments-core.ttl",
        "fpeo-static-equipments.ttl",
        "fpeo-dynamical-equipments.ttl",
        "fpeo-electrical-equipments.ttl",
        "fpeo-sensors-equipments.ttl",
        "fpeo-valves-security.ttl",
        "fpeo-renewable-equipments.ttl",
        "fpeo-properties-equipments.ttl",
        "fpeo-rules-equipments.ttl",
        "fpeo-crosswalk-equipments.ttl",
        "o3po.ttl"
    ]
    STD_NAMESPACES = (
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "http://www.w3.org/2000/01/rdf-schema#",
        "http://www.w3.org/2002/07/owl#",
        "http://www.w3.org/2001/XMLSchema#"
    )

logger = logging.getLogger("fpeo.reasoner")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


class HermitReasonerService:
    """
    Gerencia o ciclo de vida da JVM via JPype, executa verificação de consistência OWL DL,
    isola conjuntos mínimos de justificativa de inconsistência (Explanation Sets) e
    materializa grafos inferidos via geradores da OWL API e HermiT.
    """

    def __init__(
        self,
        hermit_jar: str = HERMIT_JAR,
        owlapi_jar: str = OWLAPI_JAR,
        ontology_dir: str = ONTOLOGY_DIR,
        base_tbox_files: Optional[List[str]] = None
    ):
        self.hermit_jar = hermit_jar
        self.owlapi_jar = owlapi_jar
        self.ontology_dir = ontology_dir
        self.base_tbox_files = base_tbox_files or BASE_TBOX_FILES

        self._base_tbox_graph: Optional[rdflib.Graph] = None
        self._enriched_graphs_cache: Dict[str, rdflib.Graph] = {}
        self._inferred_graphs_cache: Dict[str, rdflib.Graph] = {}
        self._audit_cache: Dict[str, Dict[str, Any]] = {}

    def ensure_jvm(self) -> None:
        """Inicializa a JVM com os JARs do HermiT e OWLAPI, caso ainda não esteja ativa."""
        if not jpype.isJVMStarted():
            if not os.path.exists(self.hermit_jar):
                raise FileNotFoundError(f"[REASONER] JAR do HermiT não encontrado em: {self.hermit_jar}")
            if not os.path.exists(self.owlapi_jar):
                raise FileNotFoundError(f"[REASONER] JAR da OWLAPI não encontrado em: {self.owlapi_jar}")

            logger.info("[REASONER] Inicializando JVM com classpath do HermiT e OWLAPI...")
            jpype.startJVM(classpath=[self.hermit_jar, self.owlapi_jar], convertStrings=True)

    @staticmethod
    def get_local_name(uri_str: str) -> str:
        """Extrai o fragmento final de uma URI após # ou /."""
        return uri_str.split("#")[-1].split("/")[-1]

    @classmethod
    def format_owl_axiom(cls, axiom_str: str) -> str:
        """Simplifica URIs longas nos axiomas OWL para nomes legíveis nos diagnósticos."""
        def shorten_match(match):
            uri = match.group(0).strip("<>")
            return cls.get_local_name(uri)
        return re.sub(r"<http://[^>]+>", shorten_match, axiom_str)

    def compute_payload_hash(self, ttl_contents: Optional[List[str]]) -> str:
        """Calcula hash determinístico SHA-256 para controle de cache de inferências."""
        if not ttl_contents:
            return "EMPTY_PAYLOAD"
        normalized = "###___PAYLOAD_DELIMITER___###".join(
            sorted(c.strip() for c in ttl_contents if c and c.strip())
        )
        if not normalized:
            return "EMPTY_PAYLOAD"
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def get_base_tbox_graph(self) -> rdflib.Graph:
        """Carrega e armazena em cache os arquivos imutáveis da TBox em memória."""
        if self._base_tbox_graph is not None:
            return self._base_tbox_graph

        logger.info("[REASONER] Pré-carregando módulos base da TBox...")
        graph = rdflib.Graph()
        for fname in self.base_tbox_files:
            fpath = os.path.join(self.ontology_dir, fname)
            if os.path.exists(fpath):
                try:
                    graph.parse(fpath, format="turtle")
                except Exception as exc:
                    logger.warning(f"[REASONER] Aviso de carregamento no módulo ({fname}): {exc}")

        self._base_tbox_graph = graph
        logger.info(f"[REASONER] TBox base cacheada com {len(self._base_tbox_graph)} triplas.")
        return self._base_tbox_graph

    def get_ontology_graph(self, extra_ttl_contents: Optional[List[str]] = None) -> rdflib.Graph:
        """Retorna grafo RDF combinando a TBox e payloads dinâmicos da ABox."""
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
                    logger.warning(f"[REASONER] Aviso ao parsear payload TTL extra: {exc}")

        self._enriched_graphs_cache[payload_hash] = graph
        return graph

    def analyze_consistency(self, ttl_contents: List[str]) -> Dict[str, Any]:
        """
        Executa verificação formal de consistência OWL DL pelo HermiT,
        isolamento de conjuntos conflitantes e materialização de axiomas deduzidos.
        """
        payload_hash = self.compute_payload_hash(ttl_contents)

        if payload_hash in self._audit_cache:
            logger.info(f"[REASONER] Cache hit: Reutilizando auditoria HermiT para hash {payload_hash[:12]}")
            cached = dict(self._audit_cache[payload_hash])
            cached["fromCache"] = True
            cached["timestamp"] = datetime.now().strftime("%H:%M:%S")
            return cached

        logger.info(f"[REASONER] Cache miss: Executando HermiT para hash {payload_hash[:12]}")
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
                    logger.warning(f"[REASONER] Aviso no payload TTL: {exc}")

        # Remove owl:imports explícitos para carregar arquivo autônomo na OWL API
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
                    f"[REASONER] Grafo Inferido materializado com sucesso: {inferred_triples_count} triplas "
                    f"(+{len(inferred_graph) - len(graph)} fatos deduzidos)."
                )
            else:
                # Isolação de conjunto mínimo de justificativa (Explanation Set)
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
                    "title": "Inconsistência Semântica Detectada pelo HermiT DL Reasoner",
                    "tboxAxioms": formatted_tbox,
                    "aboxTriples": formatted_abox,
                    "involvedEquipmentUris": involved_uris,
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

    def materialize_inferred_graph(
        self, ttl_contents: Optional[List[str]] = None
    ) -> Tuple[rdflib.Graph, Dict[str, Any]]:
        """
        Executa inferência OWL DL e retorna uma tupla com o grafo RDF materializado
        e o dicionário de auditoria do raciocínio.
        """
        payload_hash = self.compute_payload_hash(ttl_contents)

        if payload_hash in self._inferred_graphs_cache and payload_hash in self._audit_cache:
            logger.info(f"[REASONER] Cache hit: Grafo Inferido recuperado para hash {payload_hash[:12]}")
            cached_audit = dict(self._audit_cache[payload_hash])
            cached_audit["fromCache"] = True
            return self._inferred_graphs_cache[payload_hash], cached_audit

        audit_result = self.analyze_consistency(ttl_contents or [])
        inferred_graph = self._inferred_graphs_cache.get(payload_hash)
        if inferred_graph is None:
            inferred_graph = self.get_ontology_graph(ttl_contents)

        return inferred_graph, audit_result

    def execute_sparql(self, query: str, graph: Optional[rdflib.Graph] = None) -> List[Dict[str, str]]:
        """Executa consulta SPARQL diretamente sobre o grafo provido ou sobre o grafo base."""
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
            logger.error(f"[REASONER] Erro na execução da consulta SPARQL: {exc}")
            raise exc

        return results


# Instância singleton exportada para reuso direto
reasoner_service = HermitReasonerService()
