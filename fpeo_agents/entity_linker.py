import re
from rdflib import Graph
from ontology import compress_uri

def dynamic_entity_linking(question: str, graph: Graph) -> dict[str, str]:
    tokens = re.findall(r"\b[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)+\b", question)

    for word in question.split():
        w_clean = re.sub(r"[^\w-]", "", word)
        if w_clean.isupper() and len(w_clean) >= 2 and w_clean not in tokens:
            tokens.append(w_clean)

    found_entities = {}

    for token in set(tokens):
        query = f"""
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?realEntity
        WHERE
        {{
            {{
                ?info ?p "{token}" .
                ?info ?identifiesPred ?realEntity .
                FILTER(CONTAINS(LCASE(STR(?identifiesPred)), "identif"))
            }}
            UNION
            {{
                ?realEntity rdfs:label ?label .
                FILTER(
                    LCASE(STR(?label)) = LCASE("{token}")
                    || STRBEFORE(LCASE(STR(?label)), " ") = LCASE("{token}")
                )
            }}
            UNION
            {{
                FILTER(
                    STRENDS(STR(?realEntity), "#{token}")
                    || STRENDS(STR(?realEntity), "_{token}")
                )
            }}
        }}
        LIMIT 1
        """

        try:
            rows = list(graph.query(query))
        except Exception:
            rows = []

        if rows:
            found_entities[token] = compress_uri(str(rows[0][0]))
            continue

        fallback_query = f"""
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT DISTINCT ?entity
        WHERE
        {{
            ?entity rdfs:label ?label .
            FILTER(CONTAINS(LCASE(STR(?label)), LCASE("{token}")))
        }}
        LIMIT 1
        """

        try:
            fb_rows = list(graph.query(fallback_query))
        except Exception:
            fb_rows = []

        if fb_rows:
            found_entities[token] = compress_uri(str(fb_rows[0][0]))

    return found_entities
