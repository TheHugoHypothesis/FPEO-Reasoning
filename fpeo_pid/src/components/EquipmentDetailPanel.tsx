'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  Plug,
  FileSpreadsheet,
  Cpu,
  Box,
  ChevronRight,
  Plus,
  Trash2,
  GripHorizontal,
  Gauge,
  Sliders,
  Check,
  Edit2,
  Search,
  Sparkles,
  ExternalLink,
  FileText,
  Printer,
  ShieldCheck,
  BookOpen,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { Equipment, EquipmentComponent, EquipmentSpecification, PortType, UoUnit, EquipmentDesign } from '@/lib/types';
import { CategoryIcon } from './icons';
import { useOntology } from '@/context/OntologyContext';
import { NAMESPACES } from '@/lib/namespaces';

interface EquipmentDetailPanelProps {
  equipment: Equipment | null;
  onClose: () => void;
}

// Searchable Unit Selector displaying all UO units dynamically
function SearchableUoUnitSelect({
  value,
  onChange,
  uoUnits,
}: {
  value: string;
  onChange: (unitUri: string, unitShort: string, unitLabel: string) => void;
  uoUnits: UoUnit[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedUnit = useMemo(() => {
    return uoUnits.find(u => u.uri === value || u.id === value) || {
      uri: value,
      id: value,
      label: value.split('/').pop() || value,
      short: value.split('/').pop() || value,
    };
  }, [value, uoUnits]);

  const filteredUnits = useMemo(() => {
    if (!search.trim()) return uoUnits;
    const q = search.toLowerCase();
    return uoUnits.filter(
      u => u.label.toLowerCase().includes(q) || u.short.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    );
  }, [search, uoUnits]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1 min-w-[130px]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded px-2 py-1 text-xs text-amber-800 dark:text-amber-300 font-bold flex items-center justify-between gap-1 transition-all text-left shadow-2xs"
        title={selectedUnit.label}
      >
        <span className="truncate">
          {selectedUnit.short} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">({selectedUnit.label})</span>
        </span>
        <span className="text-[10px] text-slate-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar unidade da UO (ex: MW, bar, °C, rpm, Pa)..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1.5 py-0.5 font-bold">
              Instâncias da Ontologia de Unidades (UO.owl — {uoUnits.length} total)
            </div>
            {filteredUnits.length === 0 ? (
              <div className="text-[11px] text-slate-400 p-2 italic text-center">Nenhuma unidade encontrada.</div>
            ) : (
              filteredUnits.map(unit => (
                <button
                  key={unit.uri}
                  type="button"
                  onClick={() => {
                    onChange(unit.uri, unit.short, unit.label);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition-colors ${
                    unit.uri === value ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-bold border border-amber-200 dark:border-amber-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="truncate max-w-[180px]">
                    <strong className="text-amber-800 dark:text-amber-300 font-mono mr-1.5">{unit.short}</strong>
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">{unit.label}</span>
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 ml-1">{unit.id}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Dedicated Full Engineering Datasheet Modal
function DedicatedDatasheetModal({
  equipment,
  onClose,
}: {
  equipment: Equipment;
  onClose: () => void;
}) {
  const {
    uoUnits,
    updateSpecificationValue,
    addSpecificationToEquipment,
    removeSpecificationFromEquipment,
    removeEquipmentDesign,
    updateEquipmentDesign,
  } = useOntology();

  const [newSpecLabel, setNewSpecLabel] = useState('');
  const [newSpecValue, setNewSpecValue] = useState<number>(100.0);
  const [selectedUnitUri, setSelectedUnitUri] = useState<string>(
    uoUnits[0]?.uri || 'http://purl.obolibrary.org/obo/UO_0000037'
  );
  const [selectedUnitShort, setSelectedUnitShort] = useState<string>(uoUnits[0]?.short || 'MW');
  const [selectedUnitLabel, setSelectedUnitLabel] = useState<string>(uoUnits[0]?.label || 'megawatt');

  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [docTitle, setDocTitle] = useState(equipment.design?.documentLabel || '');
  const [docStandard, setDocStandard] = useState(equipment.design?.designStandard || '');
  const [docTag, setDocTag] = useState(equipment.design?.tagIdentifier || '');

  const specifications = equipment.design?.specifications || [];

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (equipment.design) {
      updateEquipmentDesign(equipment.uri, {
        ...equipment.design,
        documentLabel: docTitle.trim() || equipment.design.documentLabel,
        designStandard: docStandard.trim() || undefined,
        tagIdentifier: docTag.trim() || equipment.design.tagIdentifier,
      });
      setIsEditingMeta(false);
    }
  };

  const handleAddSpec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecLabel.trim()) return;

    const newSpec: EquipmentSpecification = {
      id: `spec-${Date.now()}`,
      uri: `${NAMESPACES.prop}DesignSpecification`,
      specTypeUri: `${NAMESPACES.prop}DesignSpecification`,
      specTypeLabel: newSpecLabel.trim(),
      valueExpressionUri: `${NAMESPACES.prop}ValueExpression`,
      value: newSpecValue,
      unitUri: selectedUnitUri,
      unitLabel: selectedUnitLabel,
      unitShort: selectedUnitShort,
    };

    addSpecificationToEquipment(equipment.uri, newSpec);
    setNewSpecLabel('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Datasheet Técnico de Engenharia (IOF-Core / UO)</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono text-[10px] font-semibold">
                  prop:EquipmentDesignDocument
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Prescreve: <strong className="text-blue-700 dark:text-blue-400">{equipment.label}</strong> ({equipment.shortUri})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Metadata Section */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Dados Cadastrais do Documento
              </span>
              <button
                type="button"
                onClick={() => setIsEditingMeta(!isEditingMeta)}
                className="text-[11px] text-amber-800 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-bold flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                {isEditingMeta ? 'Cancelar' : 'Editar Metadados'}
              </button>
            </div>

            {isEditingMeta ? (
              <form onSubmit={handleSaveMeta} className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold block mb-1">Título do Documento</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={e => setDocTitle(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold block mb-1">Norma de Projeto (Standard)</label>
                    <input
                      type="text"
                      placeholder="Ex: ISO 3977-1 / API 616"
                      value={docStandard}
                      onChange={e => setDocStandard(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold block mb-1">Tag do Equipamento</label>
                    <input
                      type="text"
                      value={docTag}
                      onChange={e => setDocTag(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 shadow-2xs"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs transition-colors shadow-xs"
                >
                  Salvar Alterações
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-semibold">Documento</span>
                  <strong className="text-slate-900 dark:text-slate-100 text-xs block truncate">{equipment.design?.documentLabel}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-semibold">Norma Técnica</span>
                  <strong className="text-amber-800 dark:text-amber-300 text-xs block font-semibold">{equipment.design?.designStandard || 'API / ISO Standard'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-semibold">Tag Identifier</span>
                  <strong className="text-blue-700 dark:text-blue-400 font-mono text-xs block">{equipment.design?.tagIdentifier || equipment.label}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Specifications Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Grandezas de Projeto Prescritas ({specifications.length})
              </span>
            </div>

            {specifications.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center text-slate-500 italic">
                Nenhuma especificação cadastrada no documento.
              </div>
            ) : (
              <div className="space-y-2">
                {specifications.map((spec, idx) => (
                  <div
                    key={spec.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-amber-400 transition-all shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
                        <strong className="text-slate-800 dark:text-slate-200 text-xs truncate">{spec.specTypeLabel}</strong>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pl-4 block truncate">
                        iof-core:prescribes {equipment.shortUri}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        step="any"
                        value={spec.value}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            updateSpecificationValue(equipment.uri, spec.id, val);
                          }
                        }}
                        className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-amber-800 dark:text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500 shadow-2xs"
                      />

                      <SearchableUoUnitSelect
                        value={spec.unitUri}
                        uoUnits={uoUnits}
                        onChange={(unitUri, unitShort, unitLabel) => {
                          updateSpecificationValue(equipment.uri, spec.id, spec.value, unitUri, unitShort);
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => removeSpecificationFromEquipment(equipment.uri, spec.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Remover especificação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Specification Form */}
          <form onSubmit={handleAddSpec} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Adicionar Nova Especificação com Unidade UO
            </span>

            <input
              type="text"
              required
              value={newSpecLabel}
              onChange={e => setNewSpecLabel(e.target.value)}
              placeholder="Nome da Especificação (ex: Maximum Allowable Working Pressure, Rated Thermal Duty)"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs"
            />

            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                required
                value={newSpecValue}
                onChange={e => setNewSpecValue(parseFloat(e.target.value) || 0)}
                placeholder="Valor"
                className="w-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
              />

              <SearchableUoUnitSelect
                value={selectedUnitUri}
                uoUnits={uoUnits}
                onChange={(unitUri, unitShort, unitLabel) => {
                  setSelectedUnitUri(unitUri);
                  setSelectedUnitShort(unitShort);
                  setSelectedUnitLabel(unitLabel);
                }}
              />

              <button
                type="submit"
                className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs transition-colors flex items-center gap-1 flex-shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (confirm('Deseja realmente remover este Documento de Engenharia e todas as suas especificações do ABox?')) {
                removeEquipmentDesign(equipment.uri);
                onClose();
              }
            }}
            className="px-3 py-1.5 bg-red-50 dark:bg-red-950/80 hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>Excluir Documento de Engenharia</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg font-bold text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export function EquipmentDetailPanel({ equipment, onClose }: EquipmentDetailPanelProps) {
  const {
    addPortToEquipment,
    removePortFromEquipment,
    addComponentToEquipment,
    setDrilldownEquipment,
    modules,
    uoUnits,
    changeEquipmentModule,
    updateSpecificationValue,
    addSpecificationToEquipment,
    removeSpecificationFromEquipment,
    createEquipmentDesign,
    removeEquipmentDesign,
  } = useOntology();

  const [activeTab, setActiveTab] = useState<'components' | 'overview' | 'ports' | 'triples'>('components');
  const [newPortType, setNewPortType] = useState<PortType>('InletPort');
  const [newPortLabel, setNewPortLabel] = useState('');
  const [newCompInput, setNewCompInput] = useState('');

  // Dedicated Datasheet Modal View state
  const [isDatasheetModalOpen, setIsDatasheetModalOpen] = useState(false);

  // Create Document Form state
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocStandard, setNewDocStandard] = useState('ISO / API Standard');

  // New Spec Form state
  const [newSpecLabel, setNewSpecLabel] = useState<string>('Design Operating Parameter');
  const [newSpecValue, setNewSpecValue] = useState<number>(100.0);
  const [selectedUnitUri, setSelectedUnitUri] = useState<string>(
    uoUnits[0]?.uri || 'http://purl.obolibrary.org/obo/UO_0000037'
  );
  const [selectedUnitShort, setSelectedUnitShort] = useState<string>(uoUnits[0]?.short || 'MW');
  const [selectedUnitLabel, setSelectedUnitLabel] = useState<string>(uoUnits[0]?.label || 'megawatt');

  // In-place Spec editing
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Minimize state
  const [isMinimized, setIsMinimized] = useState(false);

  // Drag & Position state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 310, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 310,
    posY: 16,
  });

  // Resizing state (Multi-edge & corner resizing)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 450, height: 560 });
  const [activeResizeDir, setActiveResizeDir] = useState<'e' | 's' | 'w' | 'n' | 'se' | 'sw' | 'ne' | 'nw' | null>(null);
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startXPos: number;
    startYPos: number;
  }>({
    startX: 0,
    startY: 0,
    startW: 450,
    startH: 560,
    startXPos: 310,
    startYPos: 16,
  });

  // Auto-fit height to screen on equipment change
  useEffect(() => {
    if (equipment && typeof window !== 'undefined') {
      const maxH = Math.max(300, window.innerHeight - 100);
      setDimensions(prev => ({
        width: Math.min(prev.width || 450, window.innerWidth - 40),
        height: Math.min(prev.height || 560, maxH),
      }));
      setPosition(prev => ({
        x: Math.max(10, Math.min(prev.x, window.innerWidth - 470)),
        y: Math.max(10, Math.min(prev.y, window.innerHeight - maxH - 20)),
      }));
    }
  }, [equipment?.uri]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input') ||
      (e.target as HTMLElement).closest('select') ||
      (e.target as HTMLElement).closest('textarea')
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

  const handleResizeMouseDown = (e: React.MouseEvent, dir: 'e' | 's' | 'w' | 'n' | 'se' | 'sw' | 'ne' | 'nw') => {
    e.stopPropagation();
    e.preventDefault();
    setActiveResizeDir(dir);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: dimensions.width,
      startH: dimensions.height,
      startXPos: position.x,
      startYPos: position.y,
    };
  };

  // Move effect (Bounded within window viewport)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const maxW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const maxH = typeof window !== 'undefined' ? window.innerHeight : 800;
      setPosition({
        x: Math.max(10, Math.min(maxW - dimensions.width - 15, dragStartRef.current.posX + dx)),
        y: Math.max(10, Math.min(maxH - dimensions.height - 15, dragStartRef.current.posY + dy)),
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
  }, [isDragging, dimensions]);

  // Resize effect (Full 8 directions, bounded within window)
  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (!activeResizeDir) return;
      const dx = e.clientX - resizeStartRef.current.startX;
      const dy = e.clientY - resizeStartRef.current.startY;
      let newW = resizeStartRef.current.startW;
      let newH = resizeStartRef.current.startH;
      let newX = resizeStartRef.current.startXPos;
      let newY = resizeStartRef.current.startYPos;

      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const maxAllowedW = Math.min(850, screenW - 30);
      const maxAllowedH = Math.min(850, screenH - 60);

      // Horizontal resize
      if (activeResizeDir.includes('e')) {
        newW = Math.min(maxAllowedW, Math.max(340, resizeStartRef.current.startW + dx));
      } else if (activeResizeDir.includes('w')) {
        const possibleW = resizeStartRef.current.startW - dx;
        if (possibleW >= 340 && possibleW <= maxAllowedW) {
          newW = possibleW;
          newX = resizeStartRef.current.startXPos + dx;
        }
      }

      // Vertical resize
      if (activeResizeDir.includes('s')) {
        newH = Math.min(maxAllowedH, Math.max(260, resizeStartRef.current.startH + dy));
      } else if (activeResizeDir.includes('n')) {
        const possibleH = resizeStartRef.current.startH - dy;
        if (possibleH >= 260 && possibleH <= maxAllowedH) {
          newH = possibleH;
          newY = resizeStartRef.current.startYPos + dy;
        }
      }

      setDimensions({ width: newW, height: newH });
      setPosition({ x: newX, y: newY });
    };

    const handleResizeMouseUp = () => setActiveResizeDir(null);

    if (activeResizeDir) {
      window.addEventListener('mousemove', handleResizeMouseMove);
      window.addEventListener('mouseup', handleResizeMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [activeResizeDir]);

  if (!equipment) return null;

  const componentsCount = equipment.components?.length || 0;
  const specifications = equipment.design?.specifications || [];
  const hasDesignDocument = !!equipment.design;

  const handleAddSpecification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecLabel.trim()) return;

    const newSpec: EquipmentSpecification = {
      id: `spec-${Date.now()}`,
      uri: `${NAMESPACES.prop}DesignSpecification`,
      specTypeUri: `${NAMESPACES.prop}DesignSpecification`,
      specTypeLabel: newSpecLabel.trim(),
      valueExpressionUri: `${NAMESPACES.prop}ValueExpression`,
      value: newSpecValue,
      unitUri: selectedUnitUri,
      unitLabel: selectedUnitLabel,
      unitShort: selectedUnitShort,
    };

    addSpecificationToEquipment(equipment.uri, newSpec);
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    createEquipmentDesign(
      equipment.uri,
      newDocTitle.trim() || `Datasheet Técnico - ${equipment.label}`,
      newDocStandard.trim() || undefined,
      undefined,
      equipment.label
    );
    setIsCreatingDoc(false);
  };

  // Minimized floating pill representation
  if (isMinimized) {
    return (
      <div
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        className="absolute z-40 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-xl px-3 py-2 select-none cursor-grab active:cursor-grabbing flex items-center gap-2.5 text-slate-800 dark:text-slate-100 group transition-shadow duration-200"
      >
        <div onMouseDown={handleMouseDown} className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 flex-shrink-0 text-blue-700 dark:text-blue-300">
            <CategoryIcon category={equipment.category} className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0 pr-1">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{equipment.label}</span>
            <span className="text-[9px] font-mono text-blue-700 dark:text-blue-400 truncate">{equipment.shortUri}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs"
            title="Expandir Inspetor de Equipamento"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          maxHeight: 'calc(100vh - 80px)',
          maxWidth: 'calc(100vw - 30px)',
        }}
        className="absolute z-40 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-shadow duration-200 text-slate-800 dark:text-slate-100 select-none"
      >
        {/* Edge Resize Handles */}
        <div
          onMouseDown={e => handleResizeMouseDown(e, 'e')}
          className="absolute top-0 -right-1 w-2 h-full cursor-e-resize hover:bg-blue-400/40 transition-colors z-30"
          title="Redimensionar largura"
        />
        <div
          onMouseDown={e => handleResizeMouseDown(e, 's')}
          className="absolute -bottom-1 left-0 w-full h-2 cursor-s-resize hover:bg-blue-400/40 transition-colors z-30"
          title="Redimensionar altura"
        />
        <div
          onMouseDown={e => handleResizeMouseDown(e, 'w')}
          className="absolute top-0 -left-1 w-2 h-full cursor-w-resize hover:bg-blue-400/40 transition-colors z-30"
          title="Redimensionar largura"
        />
        <div
          onMouseDown={e => handleResizeMouseDown(e, 'n')}
          className="absolute -top-1 left-0 w-full h-2 cursor-n-resize hover:bg-blue-400/40 transition-colors z-30"
          title="Redimensionar altura"
        />

        {/* Corner Resize Handles */}
        <div
          onMouseDown={e => handleResizeMouseDown(e, 'se')}
          className="absolute -bottom-1 -right-1 w-3.5 h-3.5 cursor-se-resize hover:bg-blue-500/50 z-40 rounded-br-xl"
          title="Redimensionar dimensões"
        />
        <div
          onMouseDown={e => handleResizeMouseDown(e, 'sw')}
          className="absolute -bottom-1 -left-1 w-3.5 h-3.5 cursor-sw-resize hover:bg-blue-500/50 z-40 rounded-bl-xl"
          title="Redimensionar dimensões"
        />
        <div
          onMouseDown={e => handleResizeMouseDown(e, 'ne')}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 cursor-ne-resize hover:bg-blue-500/50 z-40 rounded-tr-xl"
          title="Redimensionar dimensões"
        />
        <div
          onMouseDown={e => handleResizeMouseDown(e, 'nw')}
          className="absolute -top-1 -left-1 w-3.5 h-3.5 cursor-nw-resize hover:bg-blue-500/50 z-40 rounded-tl-xl"
          title="Redimensionar dimensões"
        />

        {/* Drag Handle Header */}
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripHorizontal className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0" />
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 flex-shrink-0 text-blue-700 dark:text-blue-300">
              <CategoryIcon category={equipment.category} className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={equipment.label}>
                {equipment.label}
              </h3>
              <p className="text-[10px] font-mono text-blue-700 dark:text-blue-400 truncate">{equipment.shortUri}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Minimizar para Ícone Compacto"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Fechar inspetor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 pt-1 text-[11px] gap-1">
          {/* TAB 1: Components & Design Specifications (Unified) */}
          <button
            onClick={() => setActiveTab('components')}
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'components'
                ? 'border-purple-600 text-purple-900 dark:text-purple-300 bg-white dark:bg-slate-900 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Componentes & Design</span>
            <span className="text-[9px] px-1.5 py-0.2 bg-purple-50 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800 font-mono font-bold">
              {componentsCount + specifications.length}
            </span>
          </button>

          {/* TAB 2: Overview */}
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-all border-b-2 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-900 dark:text-blue-300 bg-white dark:bg-slate-900 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Visão Geral
          </button>

          {/* TAB 3: Ports */}
          <button
            onClick={() => setActiveTab('ports')}
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'ports'
                ? 'border-emerald-600 text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-900 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Plug className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Portas ({equipment.ports.length})</span>
          </button>

          {/* TAB 4: Triples */}
          <button
            onClick={() => setActiveTab('triples')}
            className={`px-3 py-1.5 font-semibold rounded-t-md transition-all border-b-2 ${
              activeTab === 'triples'
                ? 'border-blue-600 text-blue-900 dark:text-blue-300 bg-white dark:bg-slate-900 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Triplas ({equipment.triples.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1 min-h-0 bg-white dark:bg-slate-900">
          {/* TAB: COMPONENTS & DESIGN / DATA PROPERTIES */}
          {activeTab === 'components' && (
            <div className="space-y-4">
              {/* SECTION A: Design & Data Properties (IOF-Core + UO) */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Documento de Engenharia & Especificações (IOF-Core)
                  </span>

                  {hasDesignDocument && (
                    <button
                      type="button"
                      onClick={() => setIsDatasheetModalOpen(true)}
                      className="text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 transition-colors shadow-2xs"
                      title="Abrir visualizador dedicado de datasheet"
                    >
                      <ExternalLink className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>Ver Datasheet Completo</span>
                    </button>
                  )}
                </div>

                {hasDesignDocument ? (
                  <>
                    {/* Document Header Info with Delete Document Option */}
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="truncate min-w-0">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold block text-[9px] uppercase">
                            Documento (prop:EquipmentDesignDocument)
                          </span>
                          <span className="font-mono text-amber-800 dark:text-amber-300 font-bold truncate block">
                            {equipment.design?.documentLabel || 'Technical Datasheet'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Deseja desvincular e remover este Documento de Engenharia do equipamento?')) {
                                removeEquipmentDesign(equipment.uri);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Excluir documento de engenharia"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                        <span className="text-slate-600 dark:text-slate-400">
                          Norma: <strong className="text-slate-800 dark:text-slate-200">{equipment.design?.designStandard || 'ISO / API'}</strong>
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          Tag: <strong className="text-blue-700 dark:text-blue-400 font-mono">{equipment.design?.tagIdentifier || equipment.label}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Specifications List */}
                    <div className="space-y-2">
                      {specifications.length === 0 ? (
                        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 italic text-[11px]">
                          Nenhuma grandeza de projeto associada a este documento no ABox.
                        </div>
                      ) : (
                        specifications.map(spec => (
                          <div
                            key={spec.id}
                            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 transition-all space-y-1.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                {spec.specTypeLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeSpecificationFromEquipment(equipment.uri, spec.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                title="Remover especificação"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Value & UO Unit selector / editor */}
                            <div className="flex items-center gap-2 pt-1">
                              {editingSpecId === spec.id ? (
                                <div className="flex items-center gap-1.5 flex-1">
                                  <input
                                    type="number"
                                    step="any"
                                    autoFocus
                                    value={tempValue}
                                    onChange={e => setTempValue(e.target.value)}
                                    className="w-24 bg-white dark:bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs text-amber-800 dark:text-amber-300 font-mono font-bold focus:outline-none shadow-2xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const parsed = parseFloat(tempValue);
                                      if (!isNaN(parsed)) {
                                        updateSpecificationValue(equipment.uri, spec.id, parsed);
                                      }
                                      setEditingSpecId(null);
                                    }}
                                    className="p-1 bg-amber-600 text-white rounded hover:bg-amber-700"
                                    title="Confirmar"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSpecId(null)}
                                    className="p-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700"
                                    title="Cancelar"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    setEditingSpecId(spec.id);
                                    setTempValue(String(spec.value));
                                  }}
                                  className="px-2 py-1 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 rounded font-mono font-bold text-amber-900 dark:text-amber-300 text-xs cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors flex items-center gap-1.5 shadow-2xs"
                                  title="Clique para editar valor numérico"
                                >
                                  <span>{spec.value}</span>
                                  <Edit2 className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400 opacity-70" />
                                </div>
                              )}

                              {/* Searchable UO Unit dropdown */}
                              <SearchableUoUnitSelect
                                value={spec.unitUri}
                                uoUnits={uoUnits}
                                onChange={(unitUri, unitShort, unitLabel) => {
                                  updateSpecificationValue(equipment.uri, spec.id, spec.value, unitUri, unitShort);
                                }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Form to Add New Specification */}
                    <form onSubmit={handleAddSpecification} className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                        <Plus className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Adicionar Especificação ao Documento
                      </span>

                      <input
                        type="text"
                        required
                        value={newSpecLabel}
                        onChange={e => setNewSpecLabel(e.target.value)}
                        placeholder="Nome da Especificação (ex: Rated Power, Design Pressure)"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-2xs"
                      />

                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          required
                          value={newSpecValue}
                          onChange={e => setNewSpecValue(parseFloat(e.target.value) || 0)}
                          placeholder="Valor Numérico"
                          className="w-28 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
                        />

                        <SearchableUoUnitSelect
                          value={selectedUnitUri}
                          uoUnits={uoUnits}
                          onChange={(unitUri, unitShort, unitLabel) => {
                            setSelectedUnitUri(unitUri);
                            setSelectedUnitShort(unitShort);
                            setSelectedUnitLabel(unitLabel);
                          }}
                        />

                        <button
                          type="submit"
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs transition-colors flex items-center gap-1 flex-shrink-0 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  /* Empty state with Create Document Action */
                  <div className="space-y-3">
                    {isCreatingDoc ? (
                      <form onSubmit={handleCreateDocument} className="p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400">
                            Novo Documento de Engenharia
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsCreatingDoc(false)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-semibold block mb-1">
                            Título / Nome do Datasheet
                          </label>
                          <input
                            type="text"
                            required
                            value={newDocTitle}
                            onChange={e => setNewDocTitle(e.target.value)}
                            placeholder={`Datasheet Técnico - ${equipment.label}`}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-semibold block mb-1">
                            Norma Técnica Aplicável (Standard)
                          </label>
                          <input
                            type="text"
                            value={newDocStandard}
                            onChange={e => setNewDocStandard(e.target.value)}
                            placeholder="Ex: ISO 3977-1 / API 616"
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 shadow-2xs"
                          />
                        </div>

                        <div className="pt-1 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsCreatingDoc(false)}
                            className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded font-bold text-xs"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs shadow-xs"
                          >
                            Criar e Vincular
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="p-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-center space-y-2 shadow-2xs">
                        <FileSpreadsheet className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Nenhum Documento de Engenharia Ativo</p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Instancie um <code className="text-amber-800 dark:text-amber-400 font-semibold">prop:EquipmentDesignDocument</code> para prescrever grandezas de projeto.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNewDocTitle(`Datasheet Técnico - ${equipment.label}`);
                            setIsCreatingDoc(true);
                          }}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Criar Documento de Engenharia (ABox)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION B: Sub-components (o3po:hasComponent) */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-[10px] uppercase font-bold text-purple-800 dark:text-purple-400 tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    Sub-componentes Físicos (<code className="text-purple-800 dark:text-purple-300 font-mono">o3po:hasComponent</code>)
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrilldownEquipment(equipment)}
                    className="text-[10px] font-bold text-purple-800 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-200 flex items-center gap-1 bg-purple-50 dark:bg-purple-950/80 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 transition-colors shadow-2xs"
                    title="Isolar e explorar sub-componentes no Canvas principal"
                  >
                    <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    <span>Explorar no Canvas</span>
                  </button>
                </div>

                {/* Add Component Form */}
                <div className="flex gap-1.5 p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <input
                    type="text"
                    value={newCompInput}
                    onChange={e => setNewCompInput(e.target.value)}
                    placeholder="Nome da peça / sub-componente (ex: Shaft, Impeller, DLN Nozzle)"
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCompInput.trim()) {
                        addComponentToEquipment(equipment.uri, newCompInput.trim());
                        setNewCompInput('');
                      }
                    }}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>

                {/* Components List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {equipment.components && equipment.components.length > 0 ? (
                    equipment.components.map(comp => (
                      <div
                        key={comp.uri}
                        className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-300 transition-all flex items-center justify-between shadow-2xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block truncate">{comp.label}</span>
                          <span className="text-[9px] font-mono text-purple-700 dark:text-purple-400">
                            {comp.predicate} {comp.typeLabel ? `→ ${comp.typeLabel}` : ''}
                          </span>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 rounded font-mono font-semibold">
                          {comp.source}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-500 italic text-[11px]">
                      Nenhum sub-componente instanciado.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* FPSO Module Selector Box */}
              <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                  <Box className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Módulo do FPSO (<code className="text-blue-700 dark:text-blue-400 font-mono">core:isLocatedInModule</code>)
                </span>
                <div className="pt-1">
                  <select
                    value={equipment.moduleCode || 'NONE'}
                    onChange={e => changeEquipmentModule(equipment.uri, e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-blue-800 dark:text-blue-300 font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="NONE">🌐 Nenhum / Equipamento Geral (Sem Módulo)</option>
                    {modules.map(mod => (
                      <option key={mod.id} value={mod.code}>
                        {mod.code}: {mod.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class Info */}
              <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Classe OWL (TBox)
                </span>
                <p className="font-mono text-blue-800 dark:text-blue-300 font-semibold text-xs">{equipment.classLabel}</p>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">{equipment.classUri}</p>
              </div>

              {/* Quick Specs Summary Link */}
              <div className="bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      {hasDesignDocument ? 'Especificações de Projeto (IOF)' : 'Sem Documento de Engenharia'}
                    </h4>
                    <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                      {hasDesignDocument
                        ? `${specifications.length} grandezas ativas com unidades UO`
                        : 'Clique para criar um datasheet para este equipamento'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('components')}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                >
                  <span>{hasDesignDocument ? 'Ver/Editar' : '+ Criar'}</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PHYSICAL PORTS */}
          {activeTab === 'ports' && (
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                <Plug className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Portas Físicas ({equipment.ports.length})
              </span>

              {/* Add Port Form */}
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex gap-1 text-[10px]">
                  <select
                    value={newPortType}
                    onChange={e => setNewPortType(e.target.value as PortType)}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-blue-500 shadow-2xs"
                  >
                    <option value="InletPort">InletPort (Entrada)</option>
                    <option value="OutletPort">OutletPort (Saída)</option>
                    <option value="ElectricalPort">ElectricalPort</option>
                    <option value="SignalPort">SignalPort</option>
                  </select>

                  <input
                    type="text"
                    value={newPortLabel}
                    onChange={e => setNewPortLabel(e.target.value)}
                    placeholder="Tag da porta"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const portName = newPortLabel.trim() || `${newPortType}_${equipment.ports.length + 1}`;
                      addPortToEquipment({ equipmentUri: equipment.uri, type: newPortType, label: portName });
                      setNewPortLabel('');
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {equipment.ports.map(port => (
                  <div
                    key={port.uri}
                    className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] shadow-2xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{port.label}</span>
                      <span className="block font-mono text-[9px] text-slate-500 dark:text-slate-400">{port.shortUri}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          port.type === 'InletPort'
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : port.type === 'OutletPort'
                            ? 'bg-orange-50 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800'
                            : 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {port.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePortFromEquipment(equipment.uri, port.uri)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Remover porta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: TRIPLES */}
          {activeTab === 'triples' && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Grafo de Triplas RDF do Equipamento ({equipment.triples.length})
              </span>

              <div className="space-y-1.5 max-h-72 overflow-y-auto font-mono text-[10px]">
                {equipment.triples.map((t, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5">
                    <p className="text-slate-600 dark:text-slate-400 truncate">
                      <span className="text-slate-400">S:</span> {t.subject}
                    </p>
                    <p className="text-blue-700 dark:text-blue-400 truncate">
                      <span className="text-slate-400">P:</span> {t.predicate}
                    </p>
                    <p className="text-amber-800 dark:text-amber-400 truncate">
                      <span className="text-slate-400">O:</span> {t.object}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated Datasheet Modal View */}
      {isDatasheetModalOpen && (
        <DedicatedDatasheetModal
          equipment={equipment}
          onClose={() => setIsDatasheetModalOpen(false)}
        />
      )}
    </>
  );
}
