import os
from rdflib import Graph, RDF, RDFS, OWL
from rdflib.namespace import VOID
import curies
from config import ENDPOINT_SPARQL, VOID_PATH

MATERIALIZED_PATH = "fpeo_materialized.ttl"

abox_graph = Graph()

# Carrega estritamente o grafo unificado e consistente gerado pelo HermiT
if os.path.exists(MATERIALIZED_PATH):
    print(f"[ABox] Carregando grafo unificado e materializado: {MATERIALIZED_PATH}")
    abox_graph.parse(MATERIALIZED_PATH, format="turtle")
    print(f"[ABox] Grafo carregado com sucesso: {len(abox_graph)} triplas ativas.")
else:
    raise FileNotFoundError(
        f"[ERRO CRÍTICO] '{MATERIALIZED_PATH}' não foi encontrado! "
        "Execute 'python3 materialize_abox.py' antes de rodar o benchmark."
    )

# Prefixas canônicos oficiais da FPEO
CANONICAL_BINDINGS = {
    "abox": "http://usp.ai/ontologies/fpeo-collect-equipments-abox#",
    "core": "http://usp.ai/ontologies/fpeo-equipments-core#",
    "static": "http://usp.ai/ontologies/fpeo-static-equipments#",
    "dynamical": "http://usp.ai/ontologies/fpeo-dynamical-equipments#",
    "electrical": "http://usp.ai/ontologies/fpeo-electrical-equipments#",
    "sensors": "http://usp.ai/ontologies/fpeo-sensors-equipments#",
    "valve": "http://usp.ai/ontologies/fpeo-valves-security#",
    "renewable": "http://usp.ai/ontologies/fpeo-renewable-equipments#",
    "prop": "http://usp.ai/ontologies/fpeo-properties-equipments#",
    "rules": "http://usp.ai/ontologies/fpeo-rules-equipments#",
    "o3po": "https://www.inf.ufrgs.br/ontologies/o3po#",
    "iof-core": "https://spec.industrialontologies.org/ontology/core/Core/",
}

for prefix, uri in CANONICAL_BINDINGS.items():
    abox_graph.bind(prefix, uri, override=True)

ns_bindings = dict(abox_graph.namespaces())
converter = curies.Converter.from_prefix_map(ns_bindings)

# 2. Carregamento do VoID sincronizado
g_void = Graph()
g_void.parse(VOID_PATH, format="turtle")

void_dict = {}
for cp in g_void.objects(None, VOID.classPartition):
    cls = str(g_void.value(cp, VOID["class"]))
    void_dict.setdefault(cls, {})
    for pp in g_void.objects(cp, VOID.propertyPartition):
        prop = str(g_void.value(pp, VOID.property))
        void_dict[cls].setdefault(prop, [])

endpoints_void_dict = {
    ENDPOINT_SPARQL: void_dict
}

def expand_uri(curie_or_uri: str) -> str:
    """Expande um CURIE ou URI entre colchetes angulares para a URI completa."""
    if not curie_or_uri:
        return ""
    curie_or_uri = str(curie_or_uri).strip()
    if curie_or_uri.startswith("<") and curie_or_uri.endswith(">"):
        return curie_or_uri[1:-1]
    if ":" in curie_or_uri and not curie_or_uri.startswith("http"):
        p, local = curie_or_uri.split(":", 1)
        if p in ns_bindings:
            return f"{ns_bindings[p]}{local}"
    return curie_or_uri

def compress_uri(uri: str) -> str:
    compressed = converter.compress(uri)
    if compressed:
        return compressed
    for prefix, namespace in ns_bindings.items():
        if uri.startswith(namespace):
            return f"{prefix}:{uri[len(namespace):]}"
    return uri.split("#")[-1].split("/")[-1]

# 3. Predicados disponíveis para o prompt
all_predicates = set()
for predicate in abox_graph.predicates():
    predicate_str = str(predicate)
    if not predicate_str.startswith(str(OWL)) and not predicate_str.startswith(str(RDF)):
        all_predicates.add(compress_uri(predicate_str))

predicates_context = ", ".join(sorted(all_predicates))
prefixes_context = "\n".join([
    f"PREFIX {p}: <{uri}>" if p else f"PREFIX : <{uri}>"
    for p, uri in ns_bindings.items()
])
