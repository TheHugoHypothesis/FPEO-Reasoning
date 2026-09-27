import os
from rdflib import Graph, RDF, RDFS, OWL, URIRef
from rdflib.namespace import VOID

def build_void_from_materialized(input_ttl="fpeo_materialized.ttl", output_path="fpeo_void.ttl"):
    if not os.path.exists(input_ttl):
        raise FileNotFoundError(f"Arquivo '{input_ttl}' não encontrado. Execute o 'materialize_abox.py' primeiro.")

    print(f"1. Carregando grafo materializado ({input_ttl}) no RDFLib...")
    g = Graph()
    g.parse(input_ttl, format="turtle")
    print(f"   -> Grafo carregado com {len(g)} triplas.")

    # 2. Mapear hierarquia de subclasses para herança de predicados
    subclass_map = {}
    for sub, sup in g.subject_objects(RDFS.subClassOf):
        if isinstance(sub, URIRef) and isinstance(sup, URIRef):
            subclass_map.setdefault(sup, set()).add(sub)

    def get_all_subclasses(cls):
        subs = set()
        to_visit = [cls]
        while to_visit:
            curr = to_visit.pop()
            for child in subclass_map.get(curr, []):
                if child not in subs:
                    subs.add(child)
                    to_visit.append(child)
        return subs

    # 3. Extrair pares (Classe, Propriedade) da ABox e TBox
    class_props = {}

    ignored_predicates = {
        RDF.type, RDFS.subClassOf, RDFS.comment, RDFS.label,
        RDFS.isDefinedBy, OWL.disjointWith, OWL.equivalentClass
    }

    # ABox e inferências: instâncias reais e seus predicados
    for s, p, o in g:
        if p in ignored_predicates or str(p).startswith(str(OWL)):
            continue
        for cls in g.objects(s, RDF.type):
            if isinstance(cls, URIRef) and not str(cls).startswith(str(OWL)):
                class_props.setdefault(cls, set()).add(p)

    # TBox: domínios declarados
    for prop, domain in g.subject_objects(RDFS.domain):
        if isinstance(domain, URIRef) and isinstance(prop, URIRef):
            class_props.setdefault(domain, set()).add(prop)
            for sub_cls in get_all_subclasses(domain):
                class_props.setdefault(sub_cls, set()).add(prop)

    # 4. Construir o grafo VoID
    void_g = Graph()
    void_g.bind("void", VOID)
    void_g.bind("rdfs", RDFS)

    dataset_uri = URIRef("http://usp.ai/ontologies/fpeo-dataset")
    void_g.add((dataset_uri, RDF.type, VOID.Dataset))

    print(f"2. Gerando partições para {len(class_props)} classes...")
    for cls, props in class_props.items():
        class_partition = URIRef(f"{cls}_partition")
        void_g.add((dataset_uri, VOID.classPartition, class_partition))
        void_g.add((class_partition, VOID["class"], cls))

        for p in props:
            p_local = p.split("#")[-1].split("/")[-1]
            prop_partition = URIRef(f"{cls}_{p_local}_prop")
            void_g.add((class_partition, VOID.propertyPartition, prop_partition))
            void_g.add((prop_partition, VOID.property, p))

    void_g.serialize(output_path, format="turtle")
    print(f"[OK] VoID sincronizado e salvo com sucesso em: {output_path}")

if __name__ == "__main__":
    build_void_from_materialized()
