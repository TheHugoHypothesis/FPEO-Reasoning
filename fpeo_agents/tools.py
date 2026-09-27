import json
from rdflib import URIRef, OWL
from ontology import abox_graph, compress_uri, expand_uri

def search_entities(keyword: str) -> str:
    """Busca indivíduos no grafo por nome, tag ou palavra-chave."""
    keyword_clean = keyword.strip().lower()
    query = f"""
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?entity ?type ?label WHERE {{
        {{
            ?entity ?p "{keyword}" .
            OPTIONAL {{ ?entity a ?type . }}
            OPTIONAL {{ ?entity rdfs:label ?label . }}
        }} UNION {{
            ?entity rdfs:label ?label .
            FILTER(CONTAINS(LCASE(STR(?label)), "{keyword_clean}"))
            OPTIONAL {{ ?entity a ?type . }}
        }} UNION {{
            FILTER(CONTAINS(LCASE(STR(?entity)), "{keyword_clean}"))
            OPTIONAL {{ ?entity a ?type . }}
            OPTIONAL {{ ?entity rdfs:label ?label . }}
        }}
    }} LIMIT 5
    """
    try:
        results = list(abox_graph.query(query))
        if not results:
            return f"Nenhuma entidade encontrada para: '{keyword}'."

        output = [f"Resultados para '{keyword}':"]
        for row in results:
            ent = compress_uri(str(row[0]))
            tp = compress_uri(str(row[1])) if row[1] else "Sem classe explícita"
            lbl = str(row[2]) if row[2] else "Sem rdfs:label"
            output.append(f"- URI: {ent} | Tipo: {tp} | Label: {lbl}")
        return "\n".join(output)
    except Exception as e:
        return f"Erro ao buscar entidade: {e}"

def inspect_entity_facts(entity_curie: str) -> str:
    """
    Retorna os fatos imediatos (1-hop / Star-Neighborhood) de um indivíduo
    para descobrir suas conexões e propriedades reais na ABox.
    """
    full_uri = expand_uri(entity_curie.strip())
    uri_ref = URIRef(full_uri)

    outgoing = []
    for p, o in abox_graph.predicate_objects(subject=uri_ref):
        if str(p).startswith(str(OWL)):
            continue
        p_comp = compress_uri(str(p))
        o_comp = compress_uri(str(o)) if isinstance(o, URIRef) else f'"{str(o)}"'
        outgoing.append(f"  - {p_comp} -> {o_comp}")

    incoming = []
    for s, p in abox_graph.subject_predicates(object=uri_ref):
        if str(p).startswith(str(OWL)):
            continue
        s_comp = compress_uri(str(s))
        p_comp = compress_uri(str(p))
        incoming.append(f"  - {s_comp} {p_comp} -> [THIS]")

    if not outgoing and not incoming:
        return f"O indivíduo '{entity_curie}' não possui propriedades conectadas na ABox."

    res = [f"Fatos para a entidade [{entity_curie}]:"]
    if outgoing:
        res.append("Propriedades de Saída:")
        res.extend(outgoing[:15])
    if incoming:
        res.append("Propriedades de Entrada:")
        res.extend(incoming[:15])

    return "\n".join(res)

TOOLS_SPEC = [
    {
        "type": "function",
        "function": {
            "name": "search_entities",
            "description": "Busca indivíduos na ontologia por código, tag ou nome (ex: 'K-01').",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Termo ou código a pesquisar."
                    }
                },
                "required": ["keyword"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "inspect_entity_facts",
            "description": "Retorna o subgrafo estelar de uma entidade específica para inspecionar seus predicados na ABox.",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_curie": {
                        "type": "string",
                        "description": "A CURIE ou URI da entidade (ex: 'default1:F01_Port_In', 'default1:Module_M01')."
                    }
                },
                "required": ["entity_curie"]
            }
        }
    }
]

TOOL_REGISTRY = {
    "search_entities": search_entities,
    "inspect_entity_facts": inspect_entity_facts
}
