'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Plus,
  Trash2,
  Globe,
  GripHorizontal,
  Anchor,
  ChevronRight as BreadcrumbArrow,
  Cpu,
  ArrowLeft,
  Ship,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useOntology } from '@/context/OntologyContext';

export function ModuleSelectorBar() {
  const {
    graph,
    fpsos,
    activeFpsoId,
    setActiveFpsoId,
    createFpso,
    modules,
    activeModuleId,
    setActiveModuleId,
    createModule,
    deleteModule,
    drilldownEquipment,
    setDrilldownEquipment,
  } = useOntology();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'fpso' | 'module'>('module');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newExtra, setNewExtra] = useState('');
  const [selectedParentFpsoId, setSelectedParentFpsoId] = useState<string>('');

  // Positioning state (Movable)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 16, y: 12 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 16,
    posY: 12,
  });

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input') ||
      (e.target as HTMLElement).closest('select')
    ) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPosition({
        x: Math.max(8, dragStartRef.current.posX + dx),
        y: Math.max(8, dragStartRef.current.posY + dy),
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Count equipments per module and per FPSO
  const { equipmentCountByModule, equipmentCountByFpso, modulesByFpso } = useMemo(() => {
    const modCounts: Record<string, number> = {};
    const fpsoCounts: Record<string, number> = {};
    const modGroups: Record<string, typeof modules> = {};

    if (graph) {
      for (const eq of graph.equipments) {
        if (eq.moduleCode) {
          modCounts[eq.moduleCode] = (modCounts[eq.moduleCode] || 0) + 1;
        }
      }
    }

    fpsos.forEach(f => {
      const fpsosMods = modules.filter(
        m => m.fpsoId === f.id || m.fpsoCode === f.code || m.fpsoId === f.code
      );
      modGroups[f.id] = fpsosMods;
      const count = fpsosMods.reduce((sum, m) => sum + (modCounts[m.code] || 0), 0);
      fpsoCounts[f.id] = count;
    });

    return {
      equipmentCountByModule: modCounts,
      equipmentCountByFpso: fpsoCounts,
      modulesByFpso: modGroups,
    };
  }, [graph, modules, fpsos]);

  const activeFpsoObj = fpsos.find(f => f.id === activeFpsoId || f.code === activeFpsoId);
  const activeModuleObj = modules.find(m => m.id === activeModuleId || m.code === activeModuleId);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newTitle.trim()) return;

    if (modalType === 'fpso') {
      createFpso(newCode, newTitle, newExtra);
    } else {
      createModule(newCode, newTitle, newExtra, selectedParentFpsoId || activeFpsoId);
    }
    setNewCode('');
    setNewTitle('');
    setNewExtra('');
    setIsModalOpen(false);
  };

  // Modules to show in Tier 2
  const visibleModules = useMemo(() => {
    if (activeFpsoId === 'ALL') {
      return modules;
    }
    return modules.filter(
      m =>
        m.fpsoId === activeFpsoId ||
        m.fpsoCode === activeFpsoId ||
        m.fpsoId === activeFpsoObj?.id ||
        m.fpsoCode === activeFpsoObj?.code
    );
  }, [activeFpsoId, activeFpsoObj, modules]);

  return (
    <>
      {/* Movable & Hierarchical Fleet & Module Control Strip */}
      <div
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        className="absolute z-30 max-w-[calc(100vw-450px)] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-lg p-2.5 flex flex-col gap-1.5 select-none transition-shadow duration-200"
      >
        {/* ROW 1: Breadcrumb & Drag Handle */}
        <div className="flex items-center justify-between gap-2 px-1 pb-1 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <div
              onMouseDown={handleDragMouseDown}
              className="flex items-center gap-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mr-1"
              title="Arraste para reposicionar este painel"
            >
              <GripHorizontal className="w-3.5 h-3.5" />
            </div>

            {/* Breadcrumb Level 0: Fleet */}
            <button
              onClick={() => {
                setActiveFpsoId('ALL');
                setActiveModuleId('ALL');
                setDrilldownEquipment(null);
              }}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
                activeFpsoId === 'ALL' && activeModuleId === 'ALL' && !drilldownEquipment
                  ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-extrabold border border-blue-300 dark:border-blue-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Anchor className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Frota FPSO</span>
            </button>

            {/* Breadcrumb Level 1: Active FPSO */}
            {activeFpsoId !== 'ALL' && activeFpsoObj && (
              <>
                <BreadcrumbArrow className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <button
                  onClick={() => {
                    setActiveModuleId('ALL');
                    setDrilldownEquipment(null);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
                    activeModuleId === 'ALL' && !drilldownEquipment
                      ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-extrabold border border-blue-300 dark:border-blue-700 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Ship className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span className="font-mono text-blue-700 dark:text-blue-400 font-bold">{activeFpsoObj.code}</span>
                  <span className="text-[11px] opacity-80">{activeFpsoObj.title}</span>
                </button>
              </>
            )}

            {/* Breadcrumb Level 2: Active Module */}
            {activeModuleId !== 'ALL' && activeModuleObj && (
              <>
                <BreadcrumbArrow className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <button
                  onClick={() => setDrilldownEquipment(null)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg transition-all ${
                    !drilldownEquipment
                      ? 'bg-sky-50 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-extrabold border border-sky-300 dark:border-sky-700 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Box className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span className="font-mono text-sky-700 dark:text-sky-400 font-bold">{activeModuleObj.code}</span>
                  <span className="text-[11px] opacity-80 truncate max-w-[120px]">
                    {activeModuleObj.title}
                  </span>
                </button>
              </>
            )}

            {/* Breadcrumb Level 3: Active Drilldown */}
            {drilldownEquipment && (
              <>
                <BreadcrumbArrow className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-bold border border-purple-300 dark:border-purple-700 shadow-xs">
                  <Cpu className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span className="font-mono">{drilldownEquipment.shortUri}</span>
                </div>
              </>
            )}
          </div>

          {/* Minimize / Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Expandir Painel' : 'Recolher Painel'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Level 2 Subgraph Banner */}
        {drilldownEquipment && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] truncate">
                Nível 2 (Componentes): <strong className="text-purple-800 dark:text-purple-300">{drilldownEquipment.label}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDrilldownEquipment(null)}
              className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/80 hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all flex-shrink-0 shadow-xs"
            >
              <ArrowLeft className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span>Voltar aos Equipamentos</span>
            </button>
          </div>
        )}

        {!isCollapsed && (
          <div className="flex flex-col gap-1.5 pt-0.5">
            {/* TIER 1: FLEET LEVEL (o3po:FPSO) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1 px-1 flex-shrink-0">
                <Ship className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>Navios FPSO:</span>
              </span>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {/* Fleet Overview Button */}
                <button
                  onClick={() => {
                    setActiveFpsoId('ALL');
                    setActiveModuleId('ALL');
                    setDrilldownEquipment(null);
                  }}
                  className={`px-2.5 py-1 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all border flex items-center gap-1.5 flex-shrink-0 ${
                    activeFpsoId === 'ALL'
                      ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 text-blue-800 dark:text-blue-300 shadow-xs ring-1 ring-blue-300'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                  title="Visualizar Toda a Frota de FPSOs"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Frota Completa</span>
                </button>

                {/* Individual FPSO Vessels */}
                {fpsos.map(fpso => {
                  const isActive = fpso.id === activeFpsoId || fpso.code === activeFpsoId;
                  const modCount = modulesByFpso[fpso.id]?.length || 0;
                  const eqCount = equipmentCountByFpso[fpso.id] || 0;

                  return (
                    <button
                      key={fpso.id}
                      onClick={() => {
                        setActiveFpsoId(fpso.id);
                        setActiveModuleId('ALL');
                        setDrilldownEquipment(null);
                      }}
                      className={`px-2.5 py-1 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all border flex items-center gap-1.5 flex-shrink-0 ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 text-blue-900 dark:text-blue-200 shadow-xs ring-1 ring-blue-300'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
                      }`}
                      title={`${fpso.code}: ${fpso.title}${fpso.fieldLocation ? ` (${fpso.fieldLocation})` : ''}`}
                    >
                      <Anchor className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span className="font-mono text-blue-700 dark:text-blue-400 font-extrabold">{fpso.code}</span>
                      <span className="text-[10px] text-slate-700 dark:text-slate-300 font-medium">{fpso.title}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 font-bold">
                        {modCount} mod • {eqCount} eq
                      </span>
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    setModalType('fpso');
                    setIsModalOpen(true);
                  }}
                  className="px-2 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1 flex-shrink-0"
                  title="Adicionar Novo Navio FPSO"
                >
                  <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>+ FPSO</span>
                </button>
              </div>
            </div>

            {/* TIER 2: TOPSIDE MODULES LEVEL (obo:RO_0001025 inside FPSO) */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1 px-1 flex-shrink-0">
                <Box className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                <span>
                  {activeFpsoId !== 'ALL' && activeFpsoObj
                    ? `Módulos do ${activeFpsoObj.code}:`
                    : 'Módulos Topside:'}
                </span>
              </span>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {/* All Modules of current context */}
                <button
                  onClick={() => {
                    setActiveModuleId('ALL');
                    setDrilldownEquipment(null);
                  }}
                  className={`px-2 py-0.5 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all border flex items-center gap-1 flex-shrink-0 ${
                    activeModuleId === 'ALL'
                      ? 'bg-sky-50 dark:bg-sky-950/80 border-sky-500 text-sky-900 dark:text-sky-200 shadow-xs'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                  title="Exibir todos os módulos deste escopo"
                >
                  <Layers className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Todos os Módulos</span>
                </button>

                {/* Render Visible Modules */}
                {visibleModules.map(mod => {
                  const isActive = mod.id === activeModuleId || mod.code === activeModuleId;
                  const count = equipmentCountByModule[mod.code] || 0;

                  return (
                    <div key={mod.id} className="relative group flex items-center flex-shrink-0">
                      <button
                        onClick={() => {
                          setActiveModuleId(mod.id);
                          setDrilldownEquipment(null);
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-sky-50 dark:bg-sky-950/80 border-sky-500 text-sky-900 dark:text-sky-200 shadow-xs ring-1 ring-sky-300'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                        title={`${mod.code}: ${mod.title}${mod.description ? `\n${mod.description}` : ''}`}
                      >
                        <span
                          className={`font-mono text-[10px] ${
                            isActive ? 'text-sky-700 dark:text-sky-400 font-extrabold' : 'text-slate-700 dark:text-slate-300 font-bold'
                          }`}
                        >
                          {mod.code}
                        </span>
                        <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 max-w-[130px] truncate">
                          {mod.title}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                          {count} eq
                        </span>
                      </button>

                      {!mod.isDefault && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm(`Remover módulo ${mod.code}?`)) {
                              deleteModule(mod.id);
                            }
                          }}
                          className="ml-0.5 p-0.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Excluir Módulo"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add Module Button */}
                <button
                  onClick={() => {
                    setModalType('module');
                    setSelectedParentFpsoId(activeFpsoId !== 'ALL' ? activeFpsoId : fpsos[0]?.id || '');
                    setIsModalOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/80 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1 flex-shrink-0"
                  title="Criar Novo Módulo Topside"
                >
                  <Plus className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>+ Módulo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Creation Modal (FPSO or Module) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {modalType === 'fpso' ? (
                  <Ship className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Box className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                )}
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {modalType === 'fpso'
                    ? 'Instanciar Novo Navio FPSO (o3po:FPSO)'
                    : 'Instanciar Módulo Topside (core:FPSOModule)'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                  Código Canônico
                </label>
                <input
                  type="text"
                  required
                  placeholder={modalType === 'fpso' ? 'Ex: P-80' : 'Ex: M-03'}
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:outline-none shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                  Nome / Descrição
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    modalType === 'fpso'
                      ? 'Ex: FPSO P-80 Búzios'
                      : 'Ex: Módulo de Remoção de CO2 e Ajuste de Ponto de Orvalho'
                  }
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none shadow-xs"
                />
              </div>

              {modalType === 'fpso' ? (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                    Bacia / Campo Offshore (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Bacia de Santos - Campo de Búzios"
                    value={newExtra}
                    onChange={e => setNewExtra(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none shadow-xs"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                    Instalado no Navio FPSO (obo:RO_0001025)
                  </label>
                  <select
                    value={selectedParentFpsoId}
                    onChange={e => setSelectedParentFpsoId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none shadow-xs"
                  >
                    {fpsos.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.code} - {f.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-white font-bold shadow-sm ${
                    modalType === 'fpso'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  Instanciar na Ontologia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
