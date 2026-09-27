'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Layers, Plug, Cpu, Check, Box } from 'lucide-react';
import { OntologyClass, PortType, CreateEquipmentPayload } from '@/lib/types';

import { useOntology } from '@/context/OntologyContext';

interface CreateEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableClasses: OntologyClass[];
  onSave: (payload: CreateEquipmentPayload) => void;
  initialClassUri?: string;
}

export function CreateEquipmentModal({
  isOpen,
  onClose,
  availableClasses,
  onSave,
  initialClassUri,
}: CreateEquipmentModalProps) {
  const { modules, activeModuleId } = useOntology();
  const [label, setLabel] = useState('');
  const [shortUri, setShortUri] = useState('');
  const [selectedClassUri, setSelectedClassUri] = useState(initialClassUri || availableClasses[0]?.uri || '');
  const [selectedModuleCode, setSelectedModuleCode] = useState(activeModuleId !== 'ALL' ? activeModuleId : '');
  const [ports, setPorts] = useState<{ type: PortType; label: string }[]>([
    { type: 'InletPort', label: 'IN_01' },
    { type: 'OutletPort', label: 'OUT_01' },
  ]);
  const [components, setComponents] = useState<{ label: string }[]>([]);
  const [newCompLabel, setNewCompLabel] = useState('');

  useEffect(() => {
    if (activeModuleId && activeModuleId !== 'ALL') {
      setSelectedModuleCode(activeModuleId);
    }
  }, [activeModuleId]);

  useEffect(() => {
    if (initialClassUri) {
      setSelectedClassUri(initialClassUri);
    } else if (availableClasses.length > 0) {
      setSelectedClassUri(availableClasses[0].uri);
    }
  }, [initialClassUri, availableClasses, isOpen]);

  const selectedClass = useMemo(() => {
    return availableClasses.find(c => c.uri === selectedClassUri) || availableClasses[0];
  }, [selectedClassUri, availableClasses]);

  // Dynamic default placeholder based on selected class and random industrial tag code
  const generatedPlaceholder = useMemo(() => {
    if (!selectedClass) return 'K-101 High Pressure Compressor';
    const classLabel = selectedClass.label || 'Equipamento';
    const randomCode = Math.floor(100 + Math.random() * 900);
    const categoryPrefix =
      selectedClass.category === 'CompressorEquipment'
        ? 'K'
        : selectedClass.category === 'PumpEquipment'
        ? 'P'
        : selectedClass.category === 'GasTurbineEquipment'
        ? 'GT'
        : selectedClass.category === 'PressureVesselEquipment'
        ? 'V'
        : selectedClass.category === 'HeatExchangeEquipment'
        ? 'E'
        : selectedClass.category === 'ValveAndSecurityEquipment'
        ? 'PSV'
        : 'EQ';

    return `${classLabel} ${categoryPrefix}-${randomCode}`;
  }, [selectedClass, isOpen]);

  if (!isOpen) return null;

  const handleAddPort = (type: PortType) => {
    const portCount = ports.filter(p => p.type === type).length + 1;
    const prefix = type === 'InletPort' ? 'IN' : type === 'OutletPort' ? 'OUT' : type === 'ElectricalPort' ? 'ELEC' : 'SIG';
    setPorts(prev => [...prev, { type, label: `${prefix}_0${portCount}` }]);
  };

  const handleRemovePort = (index: number) => {
    setPorts(prev => prev.filter((_, i) => i !== index));
  };

  const handlePortLabelChange = (index: number, newLabel: string) => {
    setPorts(prev => prev.map((p, i) => (i === index ? { ...p, label: newLabel } : p)));
  };

  const handleAddComponent = () => {
    if (!newCompLabel.trim()) return;
    setComponents(prev => [...prev, { label: newCompLabel.trim() }]);
    setNewCompLabel('');
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalLabel = label.trim() || generatedPlaceholder;

    onSave({
      label: finalLabel,
      shortUri: shortUri.trim() || undefined,
      classUri: selectedClassUri || availableClasses[0]?.uri || 'http://usp.ai/ontologies/fpeo-equipments-core#TopsideEquipment',
      category: selectedClass?.category || 'GenericEquipment',
      moduleCode: selectedModuleCode || 'NONE',
      ports,
      components,
    });

    setLabel('');
    setShortUri('');
    setComponents([]);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Modelar Novo Equipamento OWL</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Criar triplas RDF dinâmicas no ABox com portas e componentes configuráveis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 text-xs bg-white dark:bg-slate-900">
          {/* Label & Short URI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                Nome / Tag do Equipamento *
              </label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={`Ex: ${generatedPlaceholder}`}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                Identificador Semântico (opcional)
              </label>
              <input
                type="text"
                value={shortUri}
                onChange={e => setShortUri(e.target.value)}
                placeholder="Ex: K_102_HP_Compressor"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-blue-700 dark:text-blue-400 text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>
          </div>

          {/* OWL Class Selector */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
              Classe Ontológica (TBox) *
            </label>
            <select
              value={selectedClassUri}
              onChange={e => setSelectedClassUri(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              {availableClasses.map(c => (
                <option key={c.uri} value={c.uri}>
                  {c.shortUri} — {c.label} ({c.category})
                </option>
              ))}
            </select>
          </div>

          {/* FPSO Module Selector */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
              <Box className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Atribuir a Módulo Topside (core:isLocatedInModule)
            </label>
            <select
              value={selectedModuleCode}
              onChange={e => setSelectedModuleCode(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-blue-800 dark:text-blue-300 font-mono text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="">🌐 Nenhum / Equipamento Geral (Sem Módulo)</option>
              {modules.map(m => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Design Specifications Preview & Configuration (IOF-Core Data Properties) */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Especificações de Projeto Iniciais (iof-core:DesignSpecification)
            </span>
            <div className="bg-amber-50/60 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 text-xs space-y-1">
              <p className="text-[11px] text-amber-900 dark:text-amber-200">
                Será gerado automaticamente um <code className="text-amber-800 dark:text-amber-300 font-bold">prop:EquipmentDesignDocument</code> contendo as especificações de projeto padrão para a categoria <span className="font-bold text-blue-700 dark:text-blue-400">{selectedClass?.category}</span> com unidades da <code className="text-amber-800 dark:text-amber-300 font-bold">UO.owl</code> e propriedades de dados <code className="text-blue-700 dark:text-blue-400 font-bold">iof-core:hasSimpleExpressionValue</code>.
              </p>
            </div>
          </div>

          {/* Dynamic Physical Ports Section */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                <Plug className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Configurar Portas Físicas ({ports.length})
              </span>

              {/* Quick Add Port Buttons */}
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleAddPort('InletPort')}
                  className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors font-bold"
                >
                  + Entrada (Inlet)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPort('OutletPort')}
                  className="px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors font-bold"
                >
                  + Saída (Outlet)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddPort('ElectricalPort')}
                  className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors font-bold"
                >
                  + Elétrica
                </button>
              </div>
            </div>

            {/* Ports List */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {ports.map((port, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shadow-2xs"
                >
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

                  <input
                    type="text"
                    value={port.label}
                    onChange={e => handlePortLabelChange(idx, e.target.value)}
                    placeholder="Nome da porta"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:border-blue-500 shadow-2xs"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemovePort(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Components Section (o3po:hasComponent) */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Sub-componentes Internos (<code className="text-purple-700 dark:text-purple-300 font-mono">o3po:hasComponent</code>)
            </span>

            <div className="flex gap-2">
              <input
                type="text"
                value={newCompLabel}
                onChange={e => setNewCompLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddComponent();
                  }
                }}
                placeholder="Ex: Rotor Impeller Stage 1"
                className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:border-purple-500 shadow-2xs"
              />
              <button
                type="button"
                onClick={handleAddComponent}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {components.map((c, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs"
                >
                  <span className="font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                    <Box className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    {c.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveComponent(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Submit / Cancel Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Instanciar no ABox</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
