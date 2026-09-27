import os
import glob
import time
import logging
from reasoner_service import reasoner_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fpeo.materialize")

OUTPUT_FILE = "fpeo_materialized.ttl"

# Prefixas canônicos para garantir serialização limpa no Turtle final
CANONICAL_NAMESPACES = {
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
    "bfo": "http://purl.obolibrary.org/obo/",
    "uo": "http://purl.obolibrary.org/obo/"
}


def run_materialization():
    print("=" * 80)
    print("FPEO MATERIALIZATION ENGINE (HERMIT OWL DL)")
    print("=" * 80)
    t0 = time.time()

    # 1. Varre e carrega todos os .ttl locais (exceto VoID e arquivos gerados previamente)
    all_ttls = [
        f for f in glob.glob("*.ttl")
        if "void" not in f.lower()
        and f != OUTPUT_FILE
        and "old" not in f.lower()
        and "abox2" not in f.lower()
    ]

    if not all_ttls:
        logger.error("Nenhum arquivo de ontologia (.ttl) encontrado no diretório atual.")
        return

    print(f"\n[1/4] Carregando {len(all_ttls)} módulos ontológicos:")
    payloads = []
    for fpath in sorted(all_ttls):
        print(f"      • {fpath}")
        with open(fpath, "r", encoding="utf-8") as f:
            payloads.append(f.read())

    # 2. Executa o raciocinador HermiT via reasoner_service
    print("\n[2/4] Executando HermiT OWL DL Reasoner via Java Virtual Machine...")
    inferred_graph, audit = reasoner_service.materialize_inferred_graph(payloads)

    # 3. Diagnóstico de Consistência
    is_consistent = audit.get("isConsistent", False)
    asserted_count = audit.get("assertedTriples", 0)
    inferred_count = audit.get("inferredTriples", 0)
    delta_inferred = inferred_count - asserted_count

    print(f"\n[3/4] Resultado da Análise de Consistência:")
    print(f"      • Status Lógico:         {'VÁLIDO / CONSISTENTE' if is_consistent else 'INCONSISTENTE (ERRO)'}")
    print(f"      • Triplas Assertadas:    {asserted_count}")
    print(f"      • Triplas Inferidas:     {inferred_count} (+{delta_inferred} deduções adicionadas)")

    if not is_consistent:
        print("\n[!] O HermiT detectou inconsistências lógicas no conjunto!")
        for idx, just in enumerate(audit.get("justifications", []), 1):
            print(f"\n--- Justificativa Mínima #{idx} ---")
            print(f"Axiomas TBox Conflitantes: {just.get('tboxAxioms')}")
            print(f"Triplas ABox Conflitantes: {just.get('aboxTriples')}")
            print(f"Entidades Envolvidas:     {just.get('involvedEquipmentUris')}")
        print("\nInterrompendo gravação do arquivo devido a inconsistências.")
        return

    # 4. Injeta prefixos canônicos e exporta o arquivo .ttl
    print(f"\n[4/4] Formatando namespaces e serializando em '{OUTPUT_FILE}'...")
    for prefix, uri in CANONICAL_NAMESPACES.items():
        inferred_graph.bind(prefix, uri, override=True)

    inferred_graph.serialize(destination=OUTPUT_FILE, format="turtle")

    elapsed = round(time.time() - t0, 2)
    print(f"\n[OK] Grafo materializado exportado com sucesso em {elapsed}s.")
    print(f"     Arquivo gerado: {os.path.abspath(OUTPUT_FILE)}")
    print("=" * 80)


if __name__ == "__main__":
    run_materialization()
