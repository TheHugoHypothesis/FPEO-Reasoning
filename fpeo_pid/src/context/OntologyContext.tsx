'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  OntologyGraph,
  Equipment,
  AuditResult,
  AppSettings,
  CreateEquipmentPayload,
  CreatePortPayload,
  EquipmentPort,
  EquipmentComponent,
  EquipmentSpecification,
  EquipmentDesign,
  PortConnection,
  FpsoModule,
  FpsoVessel,
  UoUnit,
} from '@/lib/types';
import { parseTurtleContent, generateTurtleFromGraph } from '@/lib/rdfParser';
import { runSemanticAudit } from '@/lib/auditClient';
import { getShortUri, NAMESPACES } from '@/lib/namespaces';
import { ALL_UO_UNITS } from '@/lib/uoUnits';

const DEFAULT_SETTINGS: AppSettings = {
  llmProvider: 'gemini',
  geminiApiKey: '',
  geminiModel: 'gemini-3.6-flash',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'gemma4:12b-it-qat',
  backendUrl: 'http://localhost:8000',
  autoAuditOnLoad: false,
  themeMode: 'dark',
  hasCompletedOnboarding: false,
};

interface OntologyContextType {
  graph: OntologyGraph | null;
  activeGraph: OntologyGraph | null;
  rawFiles: { name: string; content: string }[];
  fpsos: FpsoVessel[];
  activeFpsoId: string;
  setActiveFpsoId: (id: string) => void;
  createFpso: (code: string, title: string, fieldLocation?: string, initialSpecs?: EquipmentSpecification[]) => void;
  modules: FpsoModule[];
  activeModuleId: string;
  setActiveModuleId: (id: string) => void;
  createModule: (code: string, title: string, description?: string, fpsoId?: string, initialSpecs?: EquipmentSpecification[]) => void;
  deleteModule: (id: string) => void;
  changeEquipmentModule: (equipmentUri: string, targetModuleUri: string) => void;
  drilldownEquipment: Equipment | null;
  setDrilldownEquipment: (equipment: Equipment | null) => void;
  selectedEquipment: Equipment | null;
  uoUnits: UoUnit[];
  auditResult: AuditResult | null;
  isAuditing: boolean;
  isPreloading: boolean;
  settings: AppSettings;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  setGraphAndFiles: (graph: OntologyGraph, files: { name: string; content: string }[]) => void;
  setSelectedEquipment: (equipment: Equipment | null) => void;
  updateSettings: (newSettings: AppSettings) => void;
  executeAudit: () => Promise<void>;
  preloadScenario: (scenario: 'abox' | 'abox2') => Promise<void>;
  loadCustomScenario: (content: string, filename: string) => Promise<void>;
  addEquipmentNode: (payload: CreateEquipmentPayload) => void;
  addPortToEquipment: (payload: CreatePortPayload) => void;
  removePortFromEquipment: (equipmentUri: string, portUri: string) => void;
  addConnection: (
    sourceEquipmentUri: string,
    sourcePortUri: string,
    targetEquipmentUri: string,
    targetPortUri: string
  ) => void;
  addComponentToEquipment: (equipmentUri: string, componentLabel: string, componentClassUri?: string) => void;
  updateEquipmentDesign: (equipmentUri: string, updatedDesign: EquipmentDesign) => void;
  createEquipmentDesign: (
    equipmentUri: string,
    documentLabel: string,
    designStandard?: string,
    manufacturer?: string,
    tagIdentifier?: string
  ) => void;
  removeEquipmentDesign: (equipmentUri: string) => void;
  updateSpecificationValue: (equipmentUri: string, specId: string, newValue: number | string, newUnitUri?: string, newUnitShort?: string) => void;
  addSpecificationToEquipment: (equipmentUri: string, spec: EquipmentSpecification) => void;
  removeSpecificationFromEquipment: (equipmentUri: string, specId: string) => void;
}

const OntologyContext = createContext<OntologyContextType | undefined>(undefined);

export function OntologyProvider({ children }: { children: React.ReactNode }) {
  const [graph, setGraph] = useState<OntologyGraph | null>(null);
  const [rawFiles, setRawFiles] = useState<{ name: string; content: string }[]>([]);
  const [fpsos, setFpsos] = useState<FpsoVessel[]>([]);
  const [activeFpsoId, setActiveFpsoId] = useState<string>('ALL');
  const [modules, setModules] = useState<FpsoModule[]>([]);
  const [activeModuleId, setActiveModuleId] = useState<string>('ALL');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [drilldownEquipment, setDrilldownEquipment] = useState<Equipment | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isPreloading, setIsPreloading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fpeo_settings');
      const legacyGeminiKey = localStorage.getItem('fpeo_gemini_api_key');
      const legacyGeminiModel = localStorage.getItem('fpeo_gemini_model');
      const hasOnboarded = localStorage.getItem('fpeo_has_onboarded') === 'true';

      let base: AppSettings = { ...DEFAULT_SETTINGS };
      if (saved) {
        const parsed = JSON.parse(saved);
        base = { ...base, ...parsed };
      }
      if (legacyGeminiKey && !base.geminiApiKey) {
        base.geminiApiKey = legacyGeminiKey;
      }
      if (legacyGeminiModel && !base.geminiModel) {
        base.geminiModel = legacyGeminiModel;
      }
      if (hasOnboarded) {
        base.hasCompletedOnboarding = true;
      }
      setSettings(base);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }, []);

  useEffect(() => {
    const isDark = settings.themeMode === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark', 'theme-dark');
      document.documentElement.classList.remove('theme-light');
    } else {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('dark', 'theme-dark');
    }
  }, [settings.themeMode]);

  const syncGraphWithFiles = useCallback((updatedGraph: OntologyGraph) => {
    const generatedTtl = generateTurtleFromGraph(updatedGraph);
    setRawFiles(prev => {
      const remaining = prev.filter(f => !f.name.includes('abox'));
      return [...remaining, { name: 'fpeo-dynamic-abox.ttl', content: generatedTtl }];
    });
  }, []);

  const updateGraphState = useCallback((updatedGraph: OntologyGraph, targetEquipmentUri?: string) => {
    setGraph(updatedGraph);
    if (targetEquipmentUri && selectedEquipment?.uri === targetEquipmentUri) {
      const refreshed = updatedGraph.equipments.find(e => e.uri === targetEquipmentUri) || null;
      setSelectedEquipment(refreshed);
    }
    syncGraphWithFiles(updatedGraph);
  }, [selectedEquipment, syncGraphWithFiles]);

  const preloadDefaultOntologies = useCallback(async (aboxFileName?: string) => {
    setIsPreloading(true);
    try {
      const filesToLoad = [
        'o3po.ttl',
        'fpeo-equipments-core.ttl',
        'fpeo-static-equipments.ttl',
        'fpeo-dynamical-equipments.ttl',
        'fpeo-electrical-equipments.ttl',
        'fpeo-valves-security.ttl',
        'fpeo-renewable-equipments.ttl',
        'fpeo-sensors-equipments.ttl',
        'fpeo-crosswalk-equipments.ttl',
        'fpeo-properties-equipments.ttl',
        'fpeo-rules-equipments.ttl',
        ...(aboxFileName ? [aboxFileName] : ['fpeo-collect-equipments-abox.ttl']),
      ];

      const loadedRaw = await Promise.all(
        filesToLoad.map(async (filename) => {
          const res = await fetch(`/ontologies/${filename}`);
          if (!res.ok) throw new Error(`Failed to fetch /ontologies/${filename}`);
          return { name: filename, content: await res.text() };
        })
      );
      setRawFiles(loadedRaw);

      const parsedGraph = await parseTurtleContent(
        loadedRaw.map(f => f.content),
        loadedRaw.map(f => f.name)
      );

      setGraph(parsedGraph);
      setFpsos(parsedGraph.fpsos || []);
      setModules(parsedGraph.modules || []);
      setActiveModuleId('ALL');
    } catch (e) {
      console.error('Error preloading ontologies:', e);
    } finally {
      setIsPreloading(false);
    }
  }, []);

  const loadCustomScenario = useCallback(async (content: string, filename: string) => {
    setIsPreloading(true);
    try {
      const tboxFileNames = [
        'o3po.ttl',
        'fpeo-equipments-core.ttl',
        'fpeo-static-equipments.ttl',
        'fpeo-dynamical-equipments.ttl',
        'fpeo-electrical-equipments.ttl',
        'fpeo-valves-security.ttl',
        'fpeo-renewable-equipments.ttl',
        'fpeo-sensors-equipments.ttl',
        'fpeo-crosswalk-equipments.ttl',
        'fpeo-properties-equipments.ttl',
        'fpeo-rules-equipments.ttl',
      ];

      const loadedTbox = await Promise.all(
        tboxFileNames.map(async (f) => {
          const res = await fetch(`/ontologies/${f}`);
          if (!res.ok) throw new Error(`Failed to fetch /ontologies/${f}`);
          return { name: f, content: await res.text() };
        })
      );

      const allFiles = [...loadedTbox, { name: filename, content }];
      setRawFiles(allFiles);

      const parsedGraph = await parseTurtleContent(
        allFiles.map(f => f.content),
        allFiles.map(f => f.name)
      );

      setGraph(parsedGraph);
      setFpsos(parsedGraph.fpsos || []);
      setModules(parsedGraph.modules || []);
      setActiveModuleId('ALL');
      setAuditResult(null);
    } catch (e) {
      console.error('Error loading custom scenario:', e);
    } finally {
      setIsPreloading(false);
    }
  }, []);

  useEffect(() => {
    preloadDefaultOntologies();
  }, [preloadDefaultOntologies]);

  const setGraphAndFiles = (newGraph: OntologyGraph, files: { name: string; content: string }[]) => {
    setGraph(newGraph);
    setFpsos(newGraph.fpsos || []);
    setModules(newGraph.modules || []);
    setRawFiles(files);
    setAuditResult(null);
    setActiveModuleId('ALL');
  };

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('fpeo_settings', JSON.stringify(newSettings));
      if (newSettings.geminiApiKey) {
        localStorage.setItem('fpeo_gemini_api_key', newSettings.geminiApiKey);
      }
      if (newSettings.geminiModel) {
        localStorage.setItem('fpeo_gemini_model', newSettings.geminiModel);
      }
      if (newSettings.hasCompletedOnboarding) {
        localStorage.setItem('fpeo_has_onboarded', 'true');
      }
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  };

  const createFpso = (code: string, title: string, fieldLocation?: string, initialSpecs?: EquipmentSpecification[]) => {
    const cleanCode = code.toUpperCase().trim();
    const id = `FPSO_${cleanCode.replace(/[^A-Z0-9]/g, '')}`;
    const uri = `http://usp.ai/ontologies/fpeo-collect-equipments-abox#FPSO_${cleanCode}`;
    const newFpso: FpsoVessel = {
      id,
      uri,
      classUri: `${NAMESPACES.o3po}FPSO`,
      code: cleanCode,
      title: title.trim(),
      description: fieldLocation?.trim() ? `Localizado no ${fieldLocation.trim()}` : undefined,
      isDefault: false,
      specifications: initialSpecs || [],
    };
    const updatedFpsos = [...fpsos, newFpso];
    setFpsos(updatedFpsos);
    if (graph) {
      const updated = { ...graph, fpsos: updatedFpsos };
      updateGraphState(updated);
    }
    setActiveFpsoId(id);
  };

  const createModule = (code: string, title: string, description?: string, fpsoId?: string, initialSpecs?: EquipmentSpecification[]) => {
    const cleanCode = code.toUpperCase().trim();
    const modUri = `http://usp.ai/ontologies/fpeo-collect-equipments-abox#Module_${cleanCode.replace(/[^a-zA-Z0-9]/g, '')}`;
    const targetFpsoId = fpsoId || (activeFpsoId !== 'ALL' ? activeFpsoId : fpsos[0]?.id);
    const targetFpso = fpsos.find(f => f.id === targetFpsoId) || fpsos[0];

    const newModule: FpsoModule = {
      id: cleanCode,
      uri: modUri,
      classUri: `${NAMESPACES.core}FPSOModule`,
      code: cleanCode,
      title: title.trim(),
      description: description?.trim() || `Módulo de Processamento ${cleanCode}`,
      fpsoId: targetFpso?.id,
      fpsoCode: targetFpso?.code,
      isDefault: false,
      specifications: initialSpecs || [],
    };
    const updatedModules = [...modules, newModule];
    setModules(updatedModules);
    if (graph) {
      const updated = { ...graph, modules: updatedModules };
      updateGraphState(updated);
    }
    setActiveModuleId(cleanCode);
  };

  const deleteModule = (id: string) => {
    const remaining = modules.filter(m => m.id !== id && m.code !== id);
    setModules(remaining);
    if (activeModuleId === id && remaining.length > 0) {
      setActiveModuleId(remaining[0].id);
    }
    if (graph) {
      const updated = { ...graph, modules: remaining };
      updateGraphState(updated);
    }
  };

  const changeEquipmentModule = (equipmentUri: string, targetModuleUri: string) => {
    if (!graph) return;
    const isUnassigning = targetModuleUri === 'NONE' || targetModuleUri === '';
    const targetModule = isUnassigning
      ? null
      : modules.find(m => m.uri === targetModuleUri || m.id === targetModuleUri || m.code === targetModuleUri);

    const updatedEquipments = graph.equipments.map(eq => {
      if (eq.uri === equipmentUri) {
        const existingTriples = eq.triples.filter(
          t => t.predicate !== 'core:isLocatedInModule' && t.predicate !== 'core:inFPSOModule'
        );
        if (isUnassigning || !targetModule) {
          return { ...eq, moduleUri: undefined, moduleCode: undefined, triples: existingTriples };
        }
        return {
          ...eq,
          moduleUri: targetModule.uri,
          moduleCode: targetModule.code,
          triples: [
            ...existingTriples,
            { subject: eq.shortUri, predicate: 'core:isLocatedInModule', object: targetModule.code },
          ],
        };
      }
      return eq;
    });

    updateGraphState({ ...graph, equipments: updatedEquipments }, equipmentUri);
  };

  const updateEquipmentDesign = (equipmentUri: string, updatedDesign: EquipmentDesign) => {
    if (!graph) return;
    const updatedEquipments = graph.equipments.map(eq => {
      if (eq.uri === equipmentUri) {
        return { ...eq, design: updatedDesign };
      }
      return eq;
    });
    updateGraphState({ ...graph, equipments: updatedEquipments }, equipmentUri);
  };

  const createEquipmentDesign = (
    equipmentUri: string,
    documentLabel: string,
    designStandard?: string,
    manufacturer?: string,
    tagIdentifier?: string
  ) => {
    if (!graph) return;
    const targetEq = graph.equipments.find(e => e.uri === equipmentUri);
    if (!targetEq) return;

    const short = getShortUri(equipmentUri).replace(/^abox:/, '').replace(/^core:/, '');
    const newDesign: EquipmentDesign = {
      documentUri: `${NAMESPACES.abox}Doc_Datasheet_${short}`,
      documentLabel: documentLabel.trim() || `Datasheet Técnico - ${targetEq.label}`,
      tagIdentifier: tagIdentifier?.trim() || targetEq.label,
      designStandard: designStandard?.trim() || undefined,
      manufacturer: manufacturer?.trim() || undefined,
      specifications: [],
    };

    const updatedEquipments = graph.equipments.map(eq =>
      eq.uri === equipmentUri ? { ...eq, design: newDesign } : eq
    );
    updateGraphState({ ...graph, equipments: updatedEquipments }, equipmentUri);
  };

  const removeEquipmentDesign = (equipmentUri: string) => {
    if (!graph) return;
    const updatedEquipments = graph.equipments.map(eq =>
      eq.uri === equipmentUri ? { ...eq, design: undefined } : eq
    );
    updateGraphState({ ...graph, equipments: updatedEquipments }, equipmentUri);
  };

  const updateSpecificationValue = (
    equipmentUri: string,
    specId: string,
    newValue: number | string,
    newUnitUri?: string,
    newUnitShort?: string
  ) => {
    if (!graph) return;
    const updatedEquipments = graph.equipments.map(eq => {
      if (eq.uri === equipmentUri && eq.design) {
        const updatedSpecs = eq.design.specifications.map(s => {
          if (s.id === specId) {
            return {
              ...s,
              value: newValue,
              unitUri: newUnitUri || s.unitUri,
              unitShort: newUnitShort || s.unitShort,
            };
          }
          return s;
        });
        return {
          ...eq,
          design: { ...eq.design, specifications: updatedSpecs },
        };
      }
      return eq;
    });
    updateGraphState({ ...graph, equipments: updatedEquipments }, equipmentUri);
  };

  const addSpecificationToEquipment = (equipmentUri: string, spec: EquipmentSpecification) => {
    if (!graph) return;
    const updatedEquipments = graph.equipments.map(eq => {
      if (eq.uri === equipmentUri) {
        const currentDesign = eq.design || {
          documentUri: `${NAMESPACES.abox}Doc_Datasheet_${getShortUri(eq.uri).replace(/^abox:/, '')}`,
          documentLabel: `Datasheet Técnico - ${eq.label}`,
          tagIdentifier: eq.label,
          specifications: [],
        };
        return {
          ...eq,
          design: {
            ...currentDesign,
            specifications: [...currentDesign.specifications, spec],
          },
        };
      }
      return eq;
    });
    updateGraphState({ ...graph, equipments: updatedEquipments }, equipmentUri);
  };

  const removeSpecificationFromEquipment = (equipmentUri: string, specId: string) => {
    if (!graph) return;
    const updatedEquipments = graph.equipments.map(eq => {
      if (eq.uri === equipmentUri && eq.design) {
        return {
          ...eq,
          design: {
            ...eq.design,
            specifications: eq.design.specifications.filter(s => s.id !== specId),
          },
        };
      }
      return eq;
    });
    updateGraphState({ ...graph, equipments: updatedEquipments }, equipmentUri);
  };

  const executeAudit = async () => {
    if (!rawFiles || rawFiles.length === 0) return;
    setIsAuditing(true);
    try {
      const result = await runSemanticAudit(rawFiles.map(f => f.content), settings);
      setAuditResult(result);
    } catch (e) {
      console.error('Audit execution error:', e);
    } finally {
      setIsAuditing(false);
    }
  };

  const preloadScenario = async (scenario: 'abox' | 'abox2') => {
    const filename = scenario === 'abox2' ? 'fpeo-collect-equipments-abox2.ttl' : 'fpeo-collect-equipments-abox.ttl';
    await preloadDefaultOntologies(filename);
    setActiveModuleId('ALL');
    setAuditResult(null);
  };

  const addEquipmentNode = (payload: CreateEquipmentPayload) => {
    if (!graph) return;
    const cleanId = (payload.shortUri || payload.label).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    const eqUri = `http://usp.ai/ontologies/fpeo-collect-equipments-abox#${cleanId}_${Date.now()}`;
    const shortUri = `abox:${cleanId}_${Date.now()}`;
    const classLabel = getShortUri(payload.classUri);

    const createdPorts: EquipmentPort[] = payload.ports.map((p, idx) => {
      const pId = `${cleanId}_Port_${p.type}_${idx + 1}_${Date.now()}`;
      return {
        uri: `http://usp.ai/ontologies/fpeo-collect-equipments-abox#${pId}`,
        shortUri: `abox:${pId}`,
        type: p.type,
        label: p.label || `${p.type} ${idx + 1}`,
        equipmentUri: eqUri,
      };
    });

    const createdComponents: EquipmentComponent[] = (payload.components || []).map((c, idx) => {
      const cId = `Comp_${cleanId}_${idx + 1}_${Date.now()}`;
      return {
        uri: `http://usp.ai/ontologies/fpeo-collect-equipments-abox#${cId}`,
        shortUri: `abox:${cId}`,
        label: c.label,
        predicate: 'o3po:hasComponent',
        typeUri: c.classUri,
        typeLabel: c.classUri ? getShortUri(c.classUri) : undefined,
        source: 'instance',
      };
    });

    let targetModuleUri: string | undefined;
    let targetModuleCode: string | undefined;

    if (payload.moduleCode === 'NONE' || payload.moduleCode === '') {
      targetModuleUri = undefined;
      targetModuleCode = undefined;
    } else if (payload.moduleCode) {
      const matchedMod = modules.find(m => m.code === payload.moduleCode || m.id === payload.moduleCode);
      targetModuleCode = payload.moduleCode;
      targetModuleUri = matchedMod?.uri || `http://usp.ai/ontologies/fpeo-collect-equipments-abox#Module_${payload.moduleCode}`;
    } else {
      const activeMod = modules.find(m => m.id === activeModuleId || m.code === activeModuleId);
      if (activeMod && activeModuleId !== 'ALL') {
        targetModuleUri = activeMod.uri;
        targetModuleCode = activeMod.code;
      }
    }

    const category = payload.category || 'GenericEquipment';
    const initialSpecs: EquipmentSpecification[] = (payload.specifications || []).map((s, idx) => ({
      id: `spec-${idx}-${Date.now()}`,
      uri: s.specTypeUri,
      specTypeUri: s.specTypeUri,
      specTypeLabel: s.specTypeLabel,
      valueExpressionUri: `${NAMESPACES.prop}ValueExpression`,
      value: s.value,
      unitUri: s.unitUri,
      unitLabel: s.unitLabel,
      unitShort: s.unitShort,
    }));

    const design: EquipmentDesign = {
      documentUri: `${NAMESPACES.abox}Doc_Datasheet_${cleanId}`,
      documentLabel: `Datasheet de Engenharia - ${payload.label}`,
      tagIdentifier: payload.label,
      specifications: initialSpecs,
    };

    const newEquipment: Equipment = {
      uri: eqUri,
      shortUri,
      label: payload.label,
      classUri: payload.classUri,
      classLabel,
      category,
      ports: createdPorts,
      moduleUri: targetModuleUri,
      moduleCode: targetModuleCode,
      triples: [
        { subject: shortUri, predicate: 'rdf:type', object: classLabel },
        { subject: shortUri, predicate: 'rdfs:label', object: `"${payload.label}"@en` },
        ...(targetModuleCode ? [{ subject: shortUri, predicate: 'core:isLocatedInModule', object: targetModuleCode }] : []),
      ],
      components: createdComponents,
      design,
    };

    const updatedGraph = { ...graph, equipments: [...graph.equipments, newEquipment] };
    setGraph(updatedGraph);
    setSelectedEquipment(newEquipment);
    syncGraphWithFiles(updatedGraph);
  };

  const addPortToEquipment = (payload: CreatePortPayload) => {
    if (!graph) return;
    const targetEq = graph.equipments.find(e => e.uri === payload.equipmentUri);
    if (!targetEq) return;

    const pId = `${targetEq.label.replace(/[^a-zA-Z0-9_]/g, '_')}_${payload.type}_${Date.now()}`;
    const newPort: EquipmentPort = {
      uri: `http://usp.ai/ontologies/fpeo-collect-equipments-abox#${pId}`,
      shortUri: `abox:${pId}`,
      type: payload.type,
      label: payload.label,
      equipmentUri: targetEq.uri,
    };

    const updatedEquipments = graph.equipments.map(eq =>
      eq.uri === payload.equipmentUri ? { ...eq, ports: [...eq.ports, newPort] } : eq
    );

    updateGraphState({ ...graph, equipments: updatedEquipments }, targetEq.uri);
  };

  const removePortFromEquipment = (equipmentUri: string, portUri: string) => {
    if (!graph) return;
    const updatedEquipments = graph.equipments.map(eq =>
      eq.uri === equipmentUri ? { ...eq, ports: eq.ports.filter(p => p.uri !== portUri) } : eq
    );
    const updatedConnections = graph.connections.filter(
      c => c.sourcePortUri !== portUri && c.targetPortUri !== portUri
    );

    updateGraphState({ ...graph, equipments: updatedEquipments, connections: updatedConnections }, equipmentUri);
  };

  const addConnection = (
    sourceEquipmentUri: string,
    sourcePortUri: string,
    targetEquipmentUri: string,
    targetPortUri: string
  ) => {
    if (!graph) return;
    const newConnection: PortConnection = {
      id: `conn_${Date.now()}`,
      sourceEquipmentUri,
      sourcePortUri,
      targetEquipmentUri,
      targetPortUri,
      connectionType: 'portConnectedTo',
    };

    updateGraphState({ ...graph, connections: [...graph.connections, newConnection] });
  };

  const addComponentToEquipment = (equipmentUri: string, componentLabel: string, componentClassUri?: string) => {
    if (!graph) return;
    const targetEq = graph.equipments.find(e => e.uri === equipmentUri);
    if (!targetEq) return;

    const cId = `Comp_${targetEq.label.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;
    const newComp: EquipmentComponent = {
      uri: `http://usp.ai/ontologies/fpeo-collect-equipments-abox#${cId}`,
      shortUri: `abox:${cId}`,
      label: componentLabel,
      predicate: 'o3po:hasComponent',
      typeUri: componentClassUri,
      typeLabel: componentClassUri ? getShortUri(componentClassUri) : undefined,
      source: 'instance',
    };

    const updatedEquipments = graph.equipments.map(eq =>
      eq.uri === equipmentUri ? { ...eq, components: [...(eq.components || []), newComp] } : eq
    );

    updateGraphState({ ...graph, equipments: updatedEquipments }, targetEq.uri);
  };

  const handleSetActiveFpsoId = (fpsoId: string) => {
    setActiveFpsoId(fpsoId);
    setActiveModuleId('ALL');
    setDrilldownEquipment(null);
  };

  const handleSetActiveModuleId = (modId: string) => {
    setActiveModuleId(modId);
    setDrilldownEquipment(null);
    if (modId !== 'ALL') {
      const targetMod = modules.find(m => m.id === modId || m.code === modId || m.uri === modId);
      if (targetMod?.fpsoId) {
        setActiveFpsoId(targetMod.fpsoId);
      }
    }
  };

  const activeGraph: OntologyGraph | null = graph
    ? (() => {
      let filteredEquipments = graph.equipments;

      if (activeFpsoId !== 'ALL') {
        const activeFpsoObj = fpsos.find(
          f => f.id === activeFpsoId || f.code === activeFpsoId || f.uri === activeFpsoId
        );
        const targetFpsoId = activeFpsoObj?.id || activeFpsoId;
        const targetFpsoCode = activeFpsoObj?.code || activeFpsoId;

        const allowedModuleCodes = new Set(
          modules
            .filter(
              m =>
                m.fpsoId === targetFpsoId ||
                m.fpsoCode === targetFpsoCode ||
                m.fpsoId === targetFpsoCode ||
                m.fpsoCode === targetFpsoId ||
                (activeFpsoObj?.uri && m.fpsoId === activeFpsoObj.uri)
            )
            .map(m => m.code)
        );
        const allowedModuleIds = new Set(
          modules
            .filter(
              m =>
                m.fpsoId === targetFpsoId ||
                m.fpsoCode === targetFpsoCode ||
                m.fpsoId === targetFpsoCode ||
                m.fpsoCode === targetFpsoId ||
                (activeFpsoObj?.uri && m.fpsoId === activeFpsoObj.uri)
            )
            .map(m => m.id)
        );

        filteredEquipments = filteredEquipments.filter(
          e =>
            e.fpsoId === targetFpsoId ||
            e.fpsoId === targetFpsoCode ||
            (e.moduleCode && allowedModuleCodes.has(e.moduleCode)) ||
            (e.moduleCode && allowedModuleIds.has(e.moduleCode))
        );
      }

      if (activeModuleId !== 'ALL') {
        const matchedMod = modules.find(
          m => m.id === activeModuleId || m.code === activeModuleId || m.uri === activeModuleId
        );
        filteredEquipments = filteredEquipments.filter(
          e =>
            e.moduleCode === activeModuleId ||
            (matchedMod && e.moduleCode === matchedMod.code) ||
            (matchedMod && e.moduleCode === matchedMod.id) ||
            (matchedMod && e.moduleUri && e.moduleUri === matchedMod.uri)
        );
      }

      const equipmentUris = new Set(filteredEquipments.map(e => e.uri));
      const filteredConnections = graph.connections.filter(
        c => equipmentUris.has(c.sourceEquipmentUri) && equipmentUris.has(c.targetEquipmentUri)
      );

      const filteredFpsos = activeFpsoId === 'ALL'
        ? fpsos
        : fpsos.filter(f => f.id === activeFpsoId || f.code === activeFpsoId || f.uri === activeFpsoId);

      const filteredModules = activeModuleId === 'ALL'
        ? (activeFpsoId === 'ALL'
            ? modules
            : modules.filter(
                m =>
                  m.fpsoId === activeFpsoId ||
                  m.fpsoCode === activeFpsoId ||
                  m.fpsoId === filteredFpsos[0]?.id ||
                  m.fpsoCode === filteredFpsos[0]?.code
              ))
        : modules.filter(m => m.id === activeModuleId || m.code === activeModuleId || m.uri === activeModuleId);

      return {
        ...graph,
        equipments: filteredEquipments,
        connections: filteredConnections,
        fpsos: filteredFpsos,
        modules: filteredModules,
      };
    })()
    : null;

  return (
    <OntologyContext.Provider
      value={{
        graph,
        activeGraph,
        rawFiles,
        fpsos,
        activeFpsoId,
        setActiveFpsoId: handleSetActiveFpsoId,
        createFpso,
        modules,
        activeModuleId,
        setActiveModuleId: handleSetActiveModuleId,
        createModule,
        deleteModule,
        changeEquipmentModule,
        drilldownEquipment,
        setDrilldownEquipment,
        selectedEquipment,
        uoUnits: graph?.uoUnits || ALL_UO_UNITS,
        auditResult,
        isAuditing,
        isPreloading,
        settings,
        isSettingsOpen,
        setIsSettingsOpen,
        setGraphAndFiles,
        setSelectedEquipment,
        updateSettings,
        executeAudit,
        preloadScenario,
        loadCustomScenario,
        addEquipmentNode,
        addPortToEquipment,
        removePortFromEquipment,
        addConnection,
        addComponentToEquipment,
        updateEquipmentDesign,
        createEquipmentDesign,
        removeEquipmentDesign,
        updateSpecificationValue,
        addSpecificationToEquipment,
        removeSpecificationFromEquipment,
      }}
    >
      {children}
    </OntologyContext.Provider>
  );
}

export function useOntology() {
  const context = useContext(OntologyContext);
  if (!context) {
    throw new Error('useOntology must be used within an OntologyProvider');
  }
  return context;
}
