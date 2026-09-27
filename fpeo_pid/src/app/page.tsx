'use client';

import React, { useState, useRef, useEffect } from 'react';
import { OntologyProvider, useOntology } from '@/context/OntologyContext';
import { AuditToolbar } from '@/components/AuditToolbar';
import { OntologyUploader } from '@/components/OntologyUploader';
import { PIDCanvas } from '@/components/PIDCanvas';
import { ExplanationPanel } from '@/components/ExplanationPanel';
import { EquipmentDetailPanel } from '@/components/EquipmentDetailPanel';
import { PaletteToolbar } from '@/components/PaletteToolbar';
import { CreateEquipmentModal } from '@/components/CreateEquipmentModal';
import { ModuleSelectorBar } from '@/components/ModuleSelectorBar';
import { SettingsModal } from '@/components/SettingsModal';
import { OnboardingModal } from '@/components/OnboardingModal';
import { QAPanel } from '@/components/QAPanel';
import { Loader2, AlertOctagon, CheckCircle2, X, Plus, FolderPlus, Bot, PanelRightOpen, ChevronUp, ChevronDown, Layers } from 'lucide-react';
import { parseTurtleContent } from '@/lib/rdfParser';

interface ScenarioTab {
  id: string;
  label: string;
  type: 'abox' | 'abox2' | 'custom';
  content?: string;
}

function DashboardContent() {
  const {
    graph,
    activeGraph,
    selectedEquipment,
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
  } = useOntology();

  const [scenarios, setScenarios] = useState<ScenarioTab[]>([
    {
      id: 'abox',
      label: 'fpeo-collect-equipments-abox.ttl (Normal)',
      type: 'abox',
    },
  ]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('abox');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalInitialClassUri, setCreateModalInitialClassUri] = useState<string | undefined>(undefined);
  const [isWorkspaceFullscreen, setIsWorkspaceFullscreen] = useState(false);
  const [isAuditPanelOpen, setIsAuditPanelOpen] = useState(false);
  const [isQAPanelOpen, setIsQAPanelOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    try {
      const hasOnboarded = localStorage.getItem('fpeo_has_onboarded') === 'true';
      if (!hasOnboarded) {
        setIsOnboardingOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const scenarioInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const handleAddPresetScenario = async (type: 'abox' | 'abox2') => {
    const id = type;
    const label = type === 'abox' ? 'fpeo-collect-equipments-abox.ttl (Normal)' : 'fpeo-collect-equipments-abox2.ttl (Incompatível)';
    if (!scenarios.some(s => s.id === id)) {
      const newTab: ScenarioTab = { id, label, type };
      setScenarios(prev => [...prev, newTab]);
      setActiveScenarioId(id);
      await preloadScenario(type);
    } else {
      setActiveScenarioId(id);
      await preloadScenario(type);
    }
  };

  const activeScenario = scenarios.find(s => s.id === activeScenarioId);

  const toggleWorkspaceFullscreen = () => {
    if (!document.fullscreenElement) {
      workspaceRef.current?.requestFullscreen();
      setIsWorkspaceFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsWorkspaceFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsWorkspaceFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleScenarioChange = async (scenario: ScenarioTab) => {
    setActiveScenarioId(scenario.id);
    if (scenario.type === 'abox' || scenario.type === 'abox2') {
      await preloadScenario(scenario.type);
    } else if (scenario.content) {
      await loadCustomScenario(scenario.content, scenario.label);
    }
  };

  const handleCloseScenario = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedScenarios = scenarios.filter(s => s.id !== id);
    setScenarios(updatedScenarios);

    if (updatedScenarios.length > 0) {
      if (activeScenarioId === id) {
        handleScenarioChange(updatedScenarios[0]);
      }
    } else {
      setActiveScenarioId('');
      setGraphAndFiles({ equipments: [], connections: [], availableClasses: [], rawTriplesCount: 0, filesLoaded: [] }, []);
    }
  };

  const handleAddCustomScenarioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const text = await file.text();
      const newId = `custom_${Date.now()}`;
      const newTab: ScenarioTab = {
        id: newId,
        label: file.name,
        type: 'custom',
        content: text,
      };
      setScenarios(prev => [...prev, newTab]);
      handleScenarioChange(newTab);
    }
  };

  const handleOpenCreateModal = (classUri?: string) => {
    setCreateModalInitialClassUri(classUri);
    setIsCreateModalOpen(true);
  };

  const inconsistentUris = auditResult?.justifications?.flatMap(j => j.involvedEquipmentUris) || [];

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100">
      {/* Hidden file input for adding custom scenario */}
      <input
        ref={scenarioInputRef}
        type="file"
        accept=".ttl,.owl,.xml"
        onChange={handleAddCustomScenarioFile}
        className="hidden"
      />

      {/* Top Header Toolbar with Export Report Button */}
      <AuditToolbar
        graph={graph}
        auditResult={auditResult}
        isAuditing={isAuditing}
        onRunAudit={executeAudit}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenQAPanel={() => setIsQAPanelOpen(true)}
      />

      {/* Collapsible Ontologies & Scenarios Header */}
      {!isHeaderCollapsed ? (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-all duration-200">
          {/* Scenario Selector & Quick Actions bar */}
          <div className="px-6 py-2 flex items-center justify-between text-xs overflow-x-auto">
            <div className="flex items-center gap-3">
              <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">
                Cenários de Teste:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto max-w-4xl py-0.5">
                {scenarios.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 italic">Nenhum cenário TTL ativo.</span>
                    <button
                      onClick={() => handleAddPresetScenario('abox')}
                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-blue-700 dark:text-blue-400 hover:border-blue-500 font-semibold text-[11px] transition-all"
                      title="Carregar Cenário Exemplo 1 (Normal)"
                    >
                      + Exemplo ABox 1
                    </button>
                    <button
                      onClick={() => handleAddPresetScenario('abox2')}
                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-red-700 dark:text-red-400 hover:border-red-500 font-semibold text-[11px] transition-all"
                      title="Carregar Cenário Exemplo 2 (Incompatível)"
                    >
                      + Exemplo ABox 2
                    </button>
                  </div>
                ) : (
                  scenarios.map(sc => {
                    const isActive = activeScenarioId === sc.id;
                    return (
                      <div
                        key={sc.id}
                        onClick={() => handleScenarioChange(sc)}
                        className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-2 border cursor-pointer whitespace-nowrap text-xs ${isActive
                            ? sc.type === 'abox2'
                              ? 'bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700 shadow-xs'
                              : 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-xs'
                            : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                      >
                        {sc.type === 'abox' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                        {sc.type === 'abox2' && <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                        {sc.type === 'custom' && <FolderPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                        <span>{sc.label}</span>

                        <button
                          onClick={(e) => handleCloseScenario(e, sc.id)}
                          title="Fechar cenário"
                          className="hover:bg-slate-200 dark:hover:bg-slate-800 rounded p-0.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}

                {/* Add New Scenario Button */}
                <button
                  onClick={() => scenarioInputRef.current?.click()}
                  className="px-3 py-1 rounded-md font-semibold bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                  title="Carregar arquivo TTL / OWL do seu computador"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Carregar Arquivo TTL</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isPreloading && (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-semibold animate-pulse whitespace-nowrap">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Carregando ontologia FPEO...</span>
                </div>
              )}

              {/* Collapse Button */}
              <button
                onClick={() => setIsHeaderCollapsed(true)}
                className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Recolher Painel de Cenários para Maximizar Canvas"
              >
                <ChevronUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Recolher Painel</span>
              </button>
            </div>
          </div>

          {/* Drag and Drop Uploader Bar with Change File Button */}
          <OntologyUploader onGraphLoaded={setGraphAndFiles} isLoading={isPreloading} />
        </div>
      ) : (
        /* Collapsed Header Strip (Minimizado) */
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-1.5 flex items-center justify-between text-xs select-none shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">Cenário Ativo:</span>
            {activeScenario ? (
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-semibold font-mono text-[11px] flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>{activeScenario.label}</span>
              </span>
            ) : (
              <span className="text-slate-500 italic text-[11px]">Nenhum cenário ativo</span>
            )}
          </div>

          <button
            onClick={() => setIsHeaderCollapsed(false)}
            className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center gap-1 transition-colors shadow-xs"
            title="Expandir Painel de Cenários e Ontologias"
          >
            <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Expandir Cenários & Arquivos</span>
          </button>
        </div>
      )}

      {/* Main Workspace Area (FULLSCREEN TARGET): Canvas + Palette + Detail Inspector + Explanation Panel + Modals */}
      <div ref={workspaceRef} className="flex-1 relative flex overflow-hidden bg-slate-100 dark:bg-slate-950">
        {/* FPSO Module Selector Bar (Top Floating Strip) */}
        <ModuleSelectorBar />

        {/* React Flow Graph Canvas */}
        <div className="flex-1 h-full relative">
          <PIDCanvas
            graph={activeGraph || graph}
            selectedEquipment={selectedEquipment}
            onSelectEquipment={setSelectedEquipment}
            inconsistentEquipmentUris={inconsistentUris}
            onOpenCreateModal={handleOpenCreateModal}
            onToggleFullscreen={toggleWorkspaceFullscreen}
            isFullscreen={isWorkspaceFullscreen}
            isAuditPanelOpen={isAuditPanelOpen}
            onToggleAuditPanel={() => setIsAuditPanelOpen(true)}
            isQAPanelOpen={isQAPanelOpen}
            onToggleQAPanel={() => setIsQAPanelOpen(true)}
          />

          {/* Palette Toolbar (Floating Drag-and-Drop Sidebar) */}
          {graph && graph.availableClasses && (
            <PaletteToolbar
              availableClasses={graph.availableClasses}
              onOpenCreateModal={handleOpenCreateModal}
            />
          )}

          {/* Selected Equipment Details Inspector (Left Floating & Movable) */}
          <EquipmentDetailPanel
            equipment={selectedEquipment}
            onClose={() => setSelectedEquipment(null)}
          />
        </div>

        {/* Right Drawer Explanation Panel */}
        <ExplanationPanel
          auditResult={auditResult}
          isOpen={isAuditPanelOpen}
          onClose={() => setIsAuditPanelOpen(false)}
          onSelectEquipmentUri={(uri) => {
            const eq = graph?.equipments.find(e => e.uri === uri);
            if (eq) setSelectedEquipment(eq);
          }}
        />

        {/* Right Drawer GraphRAG Q&A Assistant Panel */}
        <QAPanel
          isOpen={isQAPanelOpen}
          onClose={() => setIsQAPanelOpen(false)}
        />

        {/* Dynamic Equipment Creation Modal (Inside Workspace for Fullscreen visibility) */}
        {graph && (
          <CreateEquipmentModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            availableClasses={graph.availableClasses || []}
            initialClassUri={createModalInitialClassUri}
            onSave={addEquipmentNode}
          />
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={updateSettings}
      />

      {/* First-Time AI Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        settings={settings}
        onSaveSettings={updateSettings}
      />
    </div>
  );
}

export default function Home() {
  return (
    <OntologyProvider>
      <DashboardContent />
    </OntologyProvider>
  );
}
