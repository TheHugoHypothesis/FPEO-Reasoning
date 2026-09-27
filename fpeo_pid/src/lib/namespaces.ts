export const NAMESPACES = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    skos: 'http://www.w3.org/2004/02/skos/core#',
    dc: 'http://purl.org/dc/elements/1.1/',
    obo: 'http://purl.obolibrary.org/obo/',
    uo: 'http://purl.obolibrary.org/obo/UO_',
    iao: 'http://purl.obolibrary.org/obo/IAO_',
    o3po: 'https://www.inf.ufrgs.br/ontologies/o3po#',
    iofCore: 'https://spec.industrialontologies.org/ontology/core/Core/',

    // FPEO Modules & Predicates
    core: 'http://usp.ai/ontologies/fpeo-equipments-core#',
    inFPSOModule: 'http://usp.ai/ontologies/fpeo-equipments-core#isLocatedInModule',
    containsEquipment: 'http://usp.ai/ontologies/fpeo-equipments-core#containsEquipment',
    static: 'http://usp.ai/ontologies/fpeo-static-equipments#',
    dynamical: 'http://usp.ai/ontologies/fpeo-dynamical-equipments#',
    electrical: 'http://usp.ai/ontologies/fpeo-electrical-equipments#',
    valve: 'http://usp.ai/ontologies/fpeo-valves-security#',
    renewable: 'http://usp.ai/ontologies/fpeo-renewable-equipments#',
    sensors: 'http://usp.ai/ontologies/fpeo-sensors-equipments#',
    crosswalk: 'http://usp.ai/ontologies/fpeo-crosswalk-equipments#',
    prop: 'http://usp.ai/ontologies/fpeo-properties-equipments#',
    rules: 'http://usp.ai/ontologies/fpeo-rules-equipments#',
    abox: 'http://usp.ai/ontologies/fpeo-collect-equipments-abox#',
    abox2: 'http://usp.ai/ontologies/fpeo-collect-equipments-abox2#'
} as const;

export function getShortUri(uri: string): string {
    for (const [prefix, ns] of Object.entries(NAMESPACES)) {
        if (uri.startsWith(ns)) {
            return `${prefix}:${uri.substring(ns.length)}`;
        }
    }
    const hashIdx = uri.lastIndexOf('#');
    if (hashIdx !== -1) return uri.substring(hashIdx + 1);
    const slashIdx = uri.lastIndexOf('/');
    if (slashIdx !== -1) return uri.substring(slashIdx + 1);
    return uri;
}
