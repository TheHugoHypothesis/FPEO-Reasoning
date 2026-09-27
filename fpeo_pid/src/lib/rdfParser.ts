import { Parser, Store, DataFactory } from 'n3';
import { NAMESPACES, getShortUri } from './namespaces';
import {
    Equipment,
    EquipmentCategory,
    EquipmentPort,
    PortType,
    PortConnection,
    OntologyGraph,
    EquipmentTriple,
    EquipmentComponent,
    EquipmentSpecification,
    EquipmentDesign,
    OntologyClass,
    FpsoVessel,
    FpsoModule,
} from './types';

const { namedNode } = DataFactory;

function isComponentPredicate(predUri: string): boolean {
    return predUri.includes('hasComponent');
}

function isPortClass(typeUri: string): boolean {
    return (
        typeUri.endsWith('EquipmentPort') ||
        typeUri.endsWith('InletPort') ||
        typeUri.endsWith('OutletPort') ||
        typeUri.endsWith('ElectricalPort') ||
        typeUri.endsWith('SignalPort')
    );
}

function resolvePortType(typeUris: string[]): PortType {
    for (const uri of typeUris) {
        if (uri.endsWith('InletPort')) return 'InletPort';
        if (uri.endsWith('OutletPort')) return 'OutletPort';
        if (uri.endsWith('ElectricalPort')) return 'ElectricalPort';
        if (uri.endsWith('SignalPort')) return 'SignalPort';
    }
    return 'InletPort';
}

export function resolveEquipmentCategory(classUris: string[]): EquipmentCategory {
    for (const classUri of classUris) {
        const localName = classUri.split('#').pop() || classUri.split('/').pop() || '';

        if (localName.includes('Compressor') || localName.includes('VRU')) return 'CompressorEquipment';
        if (localName.includes('Pump')) return 'PumpEquipment';
        if (localName.includes('Turbine') || localName.includes('Generator')) return 'GasTurbineEquipment';
        if (localName.includes('Separator') || localName.includes('Drum') || localName.includes('Vessel') || localName.includes('Receiver') || localName.includes('Deaerator')) return 'PressureVesselEquipment';
        if (localName.includes('Heater') || localName.includes('Cooler') || localName.includes('Exchanger') || localName.includes('Coil') || localName.includes('WHRU')) return 'HeatExchangeEquipment';
        if (localName.includes('Filter') || localName.includes('Strainer') || localName.includes('Hydrocyclone') || localName.includes('Flotation') || localName.includes('Membrane') || localName.includes('Osmosis')) return 'SeparationAndFilterEquipment';
        if (localName.includes('Tank') || localName.includes('Header') || localName.includes('Tower') || localName.includes('Tip')) return 'StorageAndPipingHeaderEquipment';
        if (localName.includes('Valve') || localName.includes('Disc') || localName.includes('Choke') || localName.includes('IRCD')) return 'ValveAndSecurityEquipment';
        if (localName.includes('Switchgear') || localName.includes('Transformer') || localName.includes('MCC') || localName.includes('Motor') || localName.includes('Busbar') || localName.includes('Cable') || localName.includes('Electrochlorinator')) return 'ElectricalEquipment';
        if (localName.includes('Solar') || localName.includes('Renewable')) return 'RenewableEquipment';
    }
    return 'GenericEquipment';
}

import { resolveUoUnit, ALL_UO_UNITS } from './uoUnits';

function resolveUnitShortAndLabel(unitUri: string): { label: string; short: string } {
    return resolveUoUnit(unitUri);
}

export async function parseTurtleContent(ttlContents: string[], filenames: string[]): Promise<OntologyGraph> {
    const store = new Store();
    const parser = new Parser();

    for (const content of ttlContents) {
        try {
            const quads = parser.parse(content);
            store.addQuads(quads);
        } catch (e) {
            console.warn('Error parsing Turtle content:', e);
        }
    }

    const rdfType = namedNode(`${NAMESPACES.rdf}type`);
    const rdfsLabel = namedNode(`${NAMESPACES.rdfs}label`);
    const rdfsComment = namedNode(`${NAMESPACES.rdfs}comment`);
    const owlNamedIndividual = namedNode(`${NAMESPACES.owl}NamedIndividual`);
    const hasPortNode = namedNode(`${NAMESPACES.core}hasPort`);
    const isPortOfNode = namedNode(`${NAMESPACES.core}isPortOf`);
    const portConnectedToNode = namedNode(`${NAMESPACES.core}portConnectedTo`);

    // IOF-Core & UO Predicates
    const iofDescribesNode = namedNode(`${NAMESPACES.iofCore}describes`);
    const iofPrescribesNode = namedNode(`${NAMESPACES.iofCore}prescribes`);
    const iofIdentifiesNode = namedNode(`${NAMESPACES.iofCore}identifies`);
    const iofHasPartNode = namedNode(`${NAMESPACES.iofCore}hasContinuantPartAtAllTimes`);
    const iofSimpleValueNode = namedNode(`${NAMESPACES.iofCore}hasSimpleExpressionValue`);
    const iaoUnitNode = namedNode(`${NAMESPACES.obo}IAO_0000039`);
    const customUnitNode = namedNode(`${NAMESPACES.prop}hasUnitOfMeasure`);

    // FPSO & Module Predicates
    const isLocatedInModuleNode = namedNode(`${NAMESPACES.core}isLocatedInModule`);
    const containsEquipmentNode = namedNode(`${NAMESPACES.core}containsEquipment`);
    const legacyInFPSOModuleNode = namedNode(`${NAMESPACES.core}inFPSOModule`);
    const hasComponentNode = namedNode(`${NAMESPACES.o3po}hasComponent`);

    const individualSubjectUris = new Set<string>();
    const explicitInds = store.getSubjects(rdfType, owlNamedIndividual, null);
    explicitInds.forEach(node => individualSubjectUris.add(node.value));

    const allTypeQuads = store.getQuads(null, rdfType, null, null);
    for (const quad of allTypeQuads) {
        const s = quad.subject.value;
        const o = quad.object.value;
        if (
            !o.startsWith(NAMESPACES.owl) &&
            !o.startsWith(NAMESPACES.rdf) &&
            !o.startsWith(NAMESPACES.rdfs)
        ) {
            individualSubjectUris.add(s);
        }
    }

    const portUris = new Set<string>();
    const fpsoUris = new Set<string>();
    const moduleUris = new Set<string>();
    const docUris = new Set<string>();
    const specUris = new Set<string>();
    const valExprUris = new Set<string>();
    const tagUris = new Set<string>();
    const equipmentUris = new Set<string>();

    for (const uri of individualSubjectUris) {
        const types = store.getObjects(namedNode(uri), rdfType, null).map(o => o.value);

        if (types.some(t => t.endsWith('FPSOModule') || t.includes('#FPSOModule') || t.includes('/FPSOModule') || t.endsWith(':FPSOModule'))) {
            moduleUris.add(uri);
        } else if (types.some(t => t.endsWith('#FPSO') || t.endsWith('/FPSO') || t.endsWith(':FPSO') || t === 'https://www.inf.ufrgs.br/ontologies/o3po#FPSO')) {
            fpsoUris.add(uri);
        } else if (types.some(t => t.includes('DesignDocument') || t.includes('Datasheet'))) {
            docUris.add(uri);
        } else if (types.some(t => t.includes('DesignSpecification') || t.includes('Specification'))) {
            specUris.add(uri);
        } else if (types.some(t => t.includes('ValueExpression'))) {
            valExprUris.add(uri);
        } else if (types.some(t => t.includes('TagIdentifier') || t.includes('Identifier'))) {
            tagUris.add(uri);
        } else {
            const isPort = types.some(t => isPortClass(t)) ||
                store.getSubjects(hasPortNode, namedNode(uri), null).length > 0 ||
                store.getObjects(namedNode(uri), isPortOfNode, null).length > 0;

            if (isPort) {
                portUris.add(uri);
            } else {
                equipmentUris.add(uri);
            }
        }
    }

    // 1. Parse FPSO Vessels directly from RDF
    const fpsos: FpsoVessel[] = [];
    for (const fpsoUri of fpsoUris) {
        const fpsoNode = namedNode(fpsoUri);
        const labels = store.getObjects(fpsoNode, rdfsLabel, null);
        const comments = store.getObjects(fpsoNode, rdfsComment, null);
        const title = labels.length > 0 ? labels[0].value : getShortUri(fpsoUri);
        const description = comments.length > 0 ? comments[0].value : undefined;
        const code = getShortUri(fpsoUri).replace(/^abox:/, '').replace(/^core:/, '').replace(/^FPSO_/, 'P-');

        fpsos.push({
            id: getShortUri(fpsoUri).replace(/^abox:/, '').replace(/^core:/, ''),
            uri: fpsoUri,
            classUri: `${NAMESPACES.o3po}FPSO`,
            code,
            title,
            description,
            isDefault: true,
        });
    }

    // 2. Parse FPSO Modules directly from RDF
    const parsedModules: FpsoModule[] = [];
    const locatedInRoNode = namedNode('http://purl.obolibrary.org/obo/RO_0001025');
    const isLocatedInFpsoNode = namedNode(`${NAMESPACES.core}isLocatedInFPSO`);
    const hasFpsoModuleNode = namedNode(`${NAMESPACES.core}hasFPSOModule`);

    for (const modUri of moduleUris) {
        const modNode = namedNode(modUri);
        const labels = store.getObjects(modNode, rdfsLabel, null);
        const comments = store.getObjects(modNode, rdfsComment, null);
        const title = labels.length > 0 ? labels[0].value : getShortUri(modUri);
        const description = comments.length > 0 ? comments[0].value : undefined;
        
        const rawModId = getShortUri(modUri).replace(/^abox:/, '').replace(/^core:/, '');
        let code = rawModId;
        if (rawModId.startsWith('Module_M')) {
            code = `M-${rawModId.replace(/^Module_M/, '')}`; // Module_M01 -> M-01
        } else if (rawModId.startsWith('Module_')) {
            code = rawModId.replace(/^Module_/, '');
        } else if (/^M\d+$/.test(rawModId)) {
            code = `M-${rawModId.substring(1)}`;
        }

        // Look for FPSO parent: obo:RO_0001025, core:isLocatedInFPSO, core:hasFPSOModule, or o3po:hasComponent
        const fpsoLocations = [
            ...store.getObjects(modNode, locatedInRoNode, null),
            ...store.getObjects(modNode, isLocatedInFpsoNode, null),
            ...store.getSubjects(hasFpsoModuleNode, modNode, null),
            ...store.getSubjects(hasComponentNode, modNode, null),
            ...store.getObjects(modNode, hasComponentNode, null),
        ];

        let fpsoId: string | undefined = undefined;
        let fpsoCode: string | undefined = undefined;
        if (fpsoLocations.length > 0) {
            const rawParent = getShortUri(fpsoLocations[0].value).replace(/^abox:/, '').replace(/^core:/, '');
            fpsoId = rawParent;
            if (rawParent.startsWith('FPSO_P')) {
                fpsoCode = `P-${rawParent.replace(/^FPSO_P/, '')}`;
            } else if (rawParent.startsWith('FPSO_')) {
                fpsoCode = rawParent.replace(/^FPSO_/, '');
            } else if (/^P\d+$/.test(rawParent)) {
                fpsoCode = `P-${rawParent.substring(1)}`;
            } else {
                fpsoCode = rawParent;
            }
        }

        parsedModules.push({
            id: rawModId,
            uri: modUri,
            classUri: `${NAMESPACES.core}FPSOModule`,
            code,
            title,
            description,
            fpsoId,
            fpsoCode,
            isDefault: true,
        });
    }

    // 3. Map Equipments & Ports
    const equipments: Equipment[] = [];
    const portToEquipmentMap = new Map<string, string>();

    for (const eqUri of equipmentUris) {
        const portsOfEq = store.getObjects(namedNode(eqUri), hasPortNode, null).map(o => o.value);
        portsOfEq.forEach(pUri => portToEquipmentMap.set(pUri, eqUri));
    }

    for (const pUri of portUris) {
        if (!portToEquipmentMap.has(pUri)) {
            const eqObjs = store.getObjects(namedNode(pUri), isPortOfNode, null);
            if (eqObjs.length > 0) {
                portToEquipmentMap.set(pUri, eqObjs[0].value);
            }
        }
    }

    for (const eqUri of equipmentUris) {
        const eqNode = namedNode(eqUri);
        const labels = store.getObjects(eqNode, rdfsLabel, null);
        const label = labels.length > 0 ? labels[0].value : getShortUri(eqUri);

        const types = store.getObjects(eqNode, rdfType, null)
            .map(o => o.value)
            .filter(t => t !== `${NAMESPACES.owl}NamedIndividual`);

        const classUri = types[0] || `${NAMESPACES.core}TopsideEquipment`;
        const classLabel = getShortUri(classUri);
        const category = resolveEquipmentCategory(types);

        const triples: EquipmentTriple[] = store.getQuads(eqNode, null, null, null).map(q => ({
            subject: getShortUri(q.subject.value),
            predicate: getShortUri(q.predicate.value),
            object: getShortUri(q.object.value),
        }));

        // Ports
        const eqPorts: EquipmentPort[] = [];
        for (const [pUri, belongingEqUri] of portToEquipmentMap.entries()) {
            if (belongingEqUri === eqUri) {
                const pNode = namedNode(pUri);
                const pTypes = store.getObjects(pNode, rdfType, null).map(o => o.value);
                const pType = resolvePortType(pTypes);
                const pLabels = store.getObjects(pNode, rdfsLabel, null);
                const pLabel = pLabels.length > 0 ? pLabels[0].value : getShortUri(pUri);
                const connectedObjs = store.getObjects(pNode, portConnectedToNode, null);
                const connectedToPortUri = connectedObjs.length > 0 ? connectedObjs[0].value : undefined;

                eqPorts.push({
                    uri: pUri,
                    shortUri: getShortUri(pUri),
                    type: pType,
                    label: pLabel,
                    equipmentUri: eqUri,
                    connectedToPortUri,
                });
            }
        }

        // Internal Components (o3po:hasComponent)
        const components: EquipmentComponent[] = [];
        const addedCompUris = new Set<string>();

        const eqQuads = store.getQuads(eqNode, null, null, null);
        for (const q of eqQuads) {
            if (isComponentPredicate(q.predicate.value)) {
                const compUri = q.object.value;
                if (!addedCompUris.has(compUri)) {
                    addedCompUris.add(compUri);
                    const compNode = namedNode(compUri);
                    const compLabels = store.getObjects(compNode, rdfsLabel, null);
                    const compLabel = compLabels.length > 0 ? compLabels[0].value : getShortUri(compUri);
                    const compTypes = store.getObjects(compNode, rdfType, null)
                        .map(o => o.value)
                        .filter(t => t !== `${NAMESPACES.owl}NamedIndividual`);
                    const compTypeUri = compTypes[0] || '';

                    components.push({
                        uri: compUri,
                        shortUri: getShortUri(compUri),
                        label: compLabel,
                        predicate: getShortUri(q.predicate.value),
                        typeUri: compTypeUri,
                        typeLabel: compTypeUri ? getShortUri(compTypeUri) : '',
                        source: 'instance',
                    });
                }
            }
        }

        // Module Location from RDF
        const moduleObjs = [
            ...store.getObjects(eqNode, isLocatedInModuleNode, null),
            ...store.getObjects(eqNode, legacyInFPSOModuleNode, null),
            ...store.getSubjects(containsEquipmentNode, eqNode, null),
        ];
        const moduleUri = moduleObjs.length > 0 ? moduleObjs[0].value : undefined;
        let moduleCode: string | undefined = undefined;
        if (moduleUri) {
            const rawMod = getShortUri(moduleUri).replace(/^core:/, '').replace(/^abox:/, '');
            if (rawMod.startsWith('Module_M')) {
                moduleCode = `M-${rawMod.replace(/^Module_M/, '')}`;
            } else if (rawMod.startsWith('Module_')) {
                moduleCode = rawMod.replace(/^Module_/, '');
            } else if (/^M\d+$/.test(rawMod)) {
                moduleCode = `M-${rawMod.substring(1)}`;
            } else {
                moduleCode = rawMod;
            }
        }

        // Extract Design Document, Specifications & Data Properties directly from RDF
        const docSubjects = store.getSubjects(iofDescribesNode, eqNode, null);
        let docUri = docSubjects.length > 0 ? docSubjects[0].value : undefined;
        let docLabel = docUri ? (store.getObjects(namedNode(docUri), rdfsLabel, null)[0]?.value || getShortUri(docUri)) : undefined;

        // Tag Identifier
        let tagIdentifier = label;
        const tagSubjects = store.getSubjects(iofIdentifiesNode, eqNode, null);
        if (tagSubjects.length > 0) {
            const tagValObjs = store.getObjects(tagSubjects[0], iofSimpleValueNode, null);
            if (tagValObjs.length > 0) {
                tagIdentifier = tagValObjs[0].value;
            }
        }

        // Specifications prescribing this equipment
        const specSubjects = new Set<string>();
        const directSpecs = store.getSubjects(iofPrescribesNode, eqNode, null);
        directSpecs.forEach(s => specSubjects.add(s.value));

        if (docUri) {
            const docParts = store.getObjects(namedNode(docUri), iofHasPartNode, null);
            for (const part of docParts) {
                const partUri = part.value;
                const pTypes = store.getObjects(part, rdfType, null).map(o => o.value);
                if (pTypes.some(t => t.includes('Specification'))) {
                    specSubjects.add(partUri);
                }
            }
        }

        const specifications: EquipmentSpecification[] = [];
        for (const sUri of specSubjects) {
            const sNode = namedNode(sUri);
            const sLabels = store.getObjects(sNode, rdfsLabel, null);
            const specLabel = sLabels.length > 0 ? sLabels[0].value : getShortUri(sUri);
            const sTypes = store.getObjects(sNode, rdfType, null)
                .map(o => o.value)
                .filter(t => t !== `${NAMESPACES.owl}NamedIndividual`);
            const specTypeUri = sTypes[0] || `${NAMESPACES.prop}DesignSpecification`;

            // Find Value Expression
            const valExprParts = store.getObjects(sNode, iofHasPartNode, null);
            let valExprUri = valExprParts.length > 0 ? valExprParts[0].value : `${sUri}_val`;
            let valExprValue: number | string = 0;
            let unitUri = `${NAMESPACES.obo}UO_0000000`;

            if (valExprParts.length > 0) {
                const vNode = valExprParts[0];
                const rawValues = store.getObjects(vNode, iofSimpleValueNode, null);
                if (rawValues.length > 0) {
                    const parsedNum = parseFloat(rawValues[0].value);
                    valExprValue = isNaN(parsedNum) ? rawValues[0].value : parsedNum;
                }

                const rawUnits = [
                    ...store.getObjects(vNode, iaoUnitNode, null),
                    ...store.getObjects(vNode, customUnitNode, null),
                ];
                if (rawUnits.length > 0) {
                    unitUri = rawUnits[0].value;
                }
            }

            const { label: unitLabel, short: unitShort } = resolveUnitShortAndLabel(unitUri);

            specifications.push({
                id: getShortUri(sUri),
                uri: sUri,
                specTypeUri,
                specTypeLabel: specLabel,
                valueExpressionUri: valExprUri,
                value: valExprValue,
                unitUri,
                unitLabel,
                unitShort,
            });
        }

        const design: EquipmentDesign = {
            documentUri: docUri || `${NAMESPACES.abox}Doc_Datasheet_${getShortUri(eqUri).replace(/^abox:/, '')}`,
            documentLabel: docLabel || `Datasheet Técnico - ${label}`,
            tagIdentifier,
            specifications,
        };

        const matchedMod = parsedModules.find(
            m => m.code === moduleCode || m.id === moduleCode || (moduleUri && m.uri === moduleUri)
        );
        const eqFpsoId = matchedMod?.fpsoId;
        const eqFpsoCode = matchedMod?.fpsoCode;

        equipments.push({
            uri: eqUri,
            shortUri: getShortUri(eqUri),
            label,
            classUri,
            classLabel,
            category,
            ports: eqPorts,
            triples,
            components,
            design,
            moduleUri,
            moduleCode,
            fpsoId: eqFpsoId,
            fpsoCode: eqFpsoCode,
        });
    }

    // 4. Extract Connections
    const connections: PortConnection[] = [];
    const connectionSet = new Set<string>();

    const portQuads = store.getQuads(null, portConnectedToNode, null, null);
    for (const quad of portQuads) {
        const srcPortUri = quad.subject.value;
        const tgtPortUri = quad.object.value;
        const srcEqUri = portToEquipmentMap.get(srcPortUri);
        const tgtEqUri = portToEquipmentMap.get(tgtPortUri);

        if (srcEqUri && tgtEqUri && srcEqUri !== tgtEqUri) {
            const connId = `${srcPortUri}->${tgtPortUri}`;
            const revConnId = `${tgtPortUri}->${srcPortUri}`;

            if (!connectionSet.has(connId) && !connectionSet.has(revConnId)) {
                connectionSet.add(connId);
                connections.push({
                    id: connId,
                    sourceEquipmentUri: srcEqUri,
                    sourcePortUri: srcPortUri,
                    targetEquipmentUri: tgtEqUri,
                    targetPortUri: tgtPortUri,
                    connectionType: 'portConnectedTo',
                });
            }
        }
    }

    const indirectConfigs = [
        { pred: `${NAMESPACES.core}feedsFluidToEquipment`, type: 'feedsFluidToEquipment' as const, sPort: '_out', tPort: '_in', prefix: 'feeds' },
        { pred: `${NAMESPACES.core}powersEquipment`, type: 'powersEquipment' as const, sPort: '_elec', tPort: '_elec', prefix: 'powers' },
    ];

    for (const cfg of indirectConfigs) {
        const quads = store.getQuads(null, namedNode(cfg.pred), null, null);
        for (const quad of quads) {
            const srcEq = quad.subject.value;
            const tgtEq = quad.object.value;
            const connId = `${cfg.prefix}:${srcEq}->${tgtEq}`;
            if (!connectionSet.has(connId)) {
                connectionSet.add(connId);
                connections.push({
                    id: connId,
                    sourceEquipmentUri: srcEq,
                    sourcePortUri: `${srcEq}${cfg.sPort}`,
                    targetEquipmentUri: tgtEq,
                    targetPortUri: `${tgtEq}${cfg.tPort}`,
                    connectionType: cfg.type,
                });
            }
        }
    }

    // 5. Extract Available OWL Classes dynamically
    const owlClassNode = namedNode(`${NAMESPACES.owl}Class`);
    const classSubjects = store.getSubjects(rdfType, owlClassNode, null);
    const availableClasses: OntologyClass[] = [];
    const classUriSet = new Set<string>();

    for (const cNode of classSubjects) {
        const cUri = cNode.value;
        if (
            cUri.startsWith('_:') ||
            cUri.startsWith(NAMESPACES.owl) ||
            cUri.startsWith(NAMESPACES.rdf) ||
            cUri.startsWith(NAMESPACES.rdfs)
        ) {
            continue;
        }
        if (!classUriSet.has(cUri)) {
            classUriSet.add(cUri);
            const cLabels = store.getObjects(cNode, rdfsLabel, null);
            const cLabel = cLabels.length > 0 ? cLabels[0].value : getShortUri(cUri);
            const category = resolveEquipmentCategory([cUri]);

            availableClasses.push({
                uri: cUri,
                shortUri: getShortUri(cUri),
                label: cLabel,
                category,
                defaultPorts: [
                    { type: 'InletPort', label: 'IN_01' },
                    { type: 'OutletPort', label: 'OUT_01' },
                ],
            });
        }
    }

    return {
        equipments,
        connections,
        availableClasses,
        fpsos: fpsos.length > 0 ? fpsos : undefined,
        modules: parsedModules.length > 0 ? parsedModules : undefined,
        uoUnits: ALL_UO_UNITS,
        rawTriplesCount: store.size,
        filesLoaded: filenames,
    };
}

export function generateTurtleFromGraph(graph: OntologyGraph): string {
    let ttl = `@prefix : <http://usp.ai/ontologies/fpeo-collect-equipments-abox#> .\n`;
    ttl += `@prefix owl: <http://www.w3.org/2002/07/owl#> .\n`;
    ttl += `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n`;
    ttl += `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n`;
    ttl += `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n`;
    ttl += `@prefix obo: <http://purl.obolibrary.org/obo/> .\n`;
    ttl += `@prefix uo: <http://purl.obolibrary.org/obo/> .\n`;
    ttl += `@prefix iof-core: <https://spec.industrialontologies.org/ontology/core/Core/> .\n`;
    ttl += `@prefix core: <http://usp.ai/ontologies/fpeo-equipments-core#> .\n`;
    ttl += `@prefix static: <http://usp.ai/ontologies/fpeo-static-equipments#> .\n`;
    ttl += `@prefix dynamical: <http://usp.ai/ontologies/fpeo-dynamical-equipments#> .\n`;
    ttl += `@prefix electrical: <http://usp.ai/ontologies/fpeo-electrical-equipments#> .\n`;
    ttl += `@prefix valve: <http://usp.ai/ontologies/fpeo-valves-security#> .\n`;
    ttl += `@prefix sensors: <http://usp.ai/ontologies/fpeo-sensors-equipments#> .\n`;
    ttl += `@prefix renewable: <http://usp.ai/ontologies/fpeo-renewable-equipments#> .\n`;
    ttl += `@prefix prop: <http://usp.ai/ontologies/fpeo-properties-equipments#> .\n`;
    ttl += `@prefix o3po: <https://www.inf.ufrgs.br/ontologies/o3po#> .\n\n`;

    // 1. Serialize FPSO Vessels
    if (graph.fpsos && graph.fpsos.length > 0) {
        ttl += `#################################################################\n`;
        ttl += `# 1. INSTÂNCIAS DE FPSO (o3po:FPSO)\n`;
        ttl += `#################################################################\n\n`;

        for (const fpso of graph.fpsos) {
            const fpsoShort = getShortUri(fpso.uri).replace(/^abox:/, '').replace(/^core:/, '');
            ttl += `### ${fpso.title} (${fpso.code})\n`;
            ttl += `:${fpsoShort} rdf:type owl:NamedIndividual , o3po:FPSO ;\n`;
            ttl += `    rdfs:label "${fpso.title}"@en ;\n`;
            if (fpso.description) {
                ttl += `    rdfs:comment "${fpso.description}"@pt ;\n`;
            }
            ttl = ttl.replace(/;\n$/, ' .\n\n');
        }
    }

    // 2. Serialize FPSO Modules
    if (graph.modules && graph.modules.length > 0) {
        ttl += `#################################################################\n`;
        ttl += `# 2. MÓDULOS TOPSIDE (core:FPSOModule)\n`;
        ttl += `#################################################################\n\n`;

        for (const mod of graph.modules) {
            const modShort = getShortUri(mod.uri).replace(/^abox:/, '').replace(/^core:/, '');
            ttl += `### ${mod.title} (${mod.code})\n`;
            ttl += `:${modShort} rdf:type owl:NamedIndividual , core:FPSOModule ;\n`;
            ttl += `    rdfs:label "${mod.title}"@en ;\n`;
            if (mod.description) {
                ttl += `    rdfs:comment "${mod.description}"@pt ;\n`;
            }
            if (mod.fpsoId) {
                const fpsoRef = mod.fpsoId.startsWith('http') ? `<${mod.fpsoId}>` : `:${mod.fpsoId.replace(/^abox:/, '').replace(/^core:/, '')}`;
                ttl += `    obo:RO_0001025 ${fpsoRef} ;\n`;
                ttl += `    core:isLocatedInFPSO ${fpsoRef} ;\n`;
            }
            ttl = ttl.replace(/;\n$/, ' .\n\n');
        }
    }

    // 3. Serialize Equipments, Ports, Components, and Design Specifications
    ttl += `#################################################################\n`;
    ttl += `# 3. EQUIPAMENTOS TOPSIDE E ESPECIFICAÇÕES DE DESIGN (IOF-CORE / UO)\n`;
    ttl += `#################################################################\n\n`;

    for (const eq of graph.equipments) {
        const eqShort = eq.shortUri.replace(/^abox:/, '').replace(/^core:/, '');
        const portsList = eq.ports.map(p => `:${getShortUri(p.uri).replace(/^abox:/, '')}`).join(' , ');
        const compsList = eq.components.map(c => `:${getShortUri(c.uri).replace(/^abox:/, '')}`).join(' , ');

        ttl += `### ${eq.label} [${eq.category}]\n`;
        ttl += `:${eqShort} rdf:type owl:NamedIndividual , <${eq.classUri}> ;\n`;
        ttl += `    rdfs:label "${eq.label}"@en ;\n`;
        if (portsList) ttl += `    core:hasPort ${portsList} ;\n`;
        if (compsList) ttl += `    o3po:hasComponent ${compsList} ;\n`;
        if (eq.moduleUri) {
            const moduleRef = eq.moduleUri.startsWith('http') ? `<${eq.moduleUri}>` : `:${getShortUri(eq.moduleUri).replace(/^core:/, '').replace(/^abox:/, '')}`;
            ttl += `    core:isLocatedInModule ${moduleRef} ;\n`;
        }
        ttl = ttl.replace(/;\n$/, ' .\n\n');

        // Ports
        for (const port of eq.ports) {
            const portShort = getShortUri(port.uri).replace(/^abox:/, '');
            ttl += `:${portShort} rdf:type owl:NamedIndividual , core:${port.type} ;\n`;
            ttl += `    rdfs:label "${port.label || port.shortUri}" ;\n`;
            ttl += `    core:isPortOf :${eqShort} ;\n`;
            if (port.connectedToPortUri) {
                const tgtShort = getShortUri(port.connectedToPortUri).replace(/^abox:/, '');
                ttl += `    core:portConnectedTo :${tgtShort} ;\n`;
            }
            ttl = ttl.replace(/;\n$/, ' .\n\n');
        }

        // Internal Components
        for (const comp of eq.components) {
            if (comp.source === 'instance') {
                const compShort = getShortUri(comp.uri).replace(/^abox:/, '');
                const compType = comp.typeUri && comp.typeUri.startsWith('http') ? `<${comp.typeUri}>` : 'iof-core:MaterialArtifact';
                ttl += `:${compShort} rdf:type owl:NamedIndividual , ${compType} ;\n`;
                ttl += `    rdfs:label "${comp.label}"@en .\n\n`;
            }
        }

        // Design Specifications & Value Expressions
        if (eq.design && eq.design.specifications.length > 0) {
            const docName = `Doc_Datasheet_${eqShort}`;
            const tagName = `Tag_${eqShort}`;
            const specNames: string[] = [];

            ttl += `### Documento de Engenharia & Especificações para ${eq.label}\n`;
            ttl += `:${tagName} rdf:type owl:NamedIndividual , prop:EquipmentTagIdentifier ;\n`;
            ttl += `    iof-core:identifies :${eqShort} ;\n`;
            ttl += `    iof-core:hasSimpleExpressionValue "${eq.design.tagIdentifier || eq.label}" .\n\n`;

            for (let idx = 0; idx < eq.design.specifications.length; idx++) {
                const spec = eq.design.specifications[idx];
                const specName = `Spec_${spec.id || 'spec'}_${idx}_${eqShort}`;
                const valName = `Val_${spec.id || 'val'}_${idx}_${eqShort}`;
                specNames.push(`:${specName}`);

                const specClass = spec.specTypeUri.startsWith('http') ? `<${spec.specTypeUri}>` : `prop:${spec.specTypeUri}`;
                const valClass = spec.valueExpressionUri.startsWith('http') ? `<${spec.valueExpressionUri}>` : `prop:${spec.valueExpressionUri}`;
                const unitRef = spec.unitUri.startsWith('http') ? `<${spec.unitUri}>` : `obo:${spec.unitUri}`;

                ttl += `:${specName} rdf:type owl:NamedIndividual , ${specClass} ;\n`;
                ttl += `    rdfs:label "${spec.specTypeLabel}"@en ;\n`;
                ttl += `    iof-core:prescribes :${eqShort} ;\n`;
                ttl += `    iof-core:hasContinuantPartAtAllTimes :${valName} .\n\n`;

                ttl += `:${valName} rdf:type owl:NamedIndividual , ${valClass} ;\n`;
                ttl += `    obo:IAO_0000039 ${unitRef} ;\n`;
                ttl += `    iof-core:hasSimpleExpressionValue "${spec.value}"^^xsd:double .\n\n`;
            }

            ttl += `:${docName} rdf:type owl:NamedIndividual , prop:EquipmentDesignDocument ;\n`;
            ttl += `    rdfs:label "${eq.design.documentLabel || 'Technical Datasheet'}"@en ;\n`;
            ttl += `    iof-core:describes :${eqShort} ;\n`;
            ttl += `    iof-core:hasContinuantPartAtAllTimes :${tagName}${specNames.length > 0 ? ' , ' + specNames.join(' , ') : ''} .\n\n`;
        }
    }

    return ttl;
}
