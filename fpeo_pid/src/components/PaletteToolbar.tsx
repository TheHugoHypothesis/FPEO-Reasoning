'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Layers, Plus, ChevronLeft, Search, GripVertical, GripHorizontal } from 'lucide-react';
import { OntologyClass, EquipmentCategory } from '@/lib/types';
import { CategoryIcon } from './icons';

interface PaletteToolbarProps {
  availableClasses: OntologyClass[];
  onOpenCreateModal: (classUri?: string) => void;
}

const CATEGORY_NAMES: Record<EquipmentCategory, string> = {
  CompressorEquipment: 'Compressores',
  PumpEquipment: 'Bombas',
  GasTurbineEquipment: 'Turbinas / Geradores',
  PressureVesselEquipment: 'Vasos de Pressão',
  HeatExchangeEquipment: 'Trocadores de Calor',
  SeparationAndFilterEquipment: 'Filtros / Separadores',
  StorageAndPipingHeaderEquipment: 'Tanques / Tubulações',
  ValveAndSecurityEquipment: 'Válvulas (PSV / SDV)',
  ElectricalEquipment: 'Sistemas Elétricos',
  RenewableEquipment: 'Energia Renovável',
  GenericEquipment: 'Equipamentos Gerais',
};

type ResizeDir = 'e' | 's' | 'w' | 'n' | 'se' | 'sw' | 'ne' | 'nw';

export function PaletteToolbar({ availableClasses, onOpenCreateModal }: PaletteToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Positioning state (Movable)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 16, y: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 16,
    posY: 60,
  });

  // Resizing state (Multi-Edge & Multi-Corner Resizing)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 290, height: 500 });
  const [activeResizeDir, setActiveResizeDir] = useState<ResizeDir | null>(null);
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
    startW: 290,
    startH: 500,
    startXPos: 16,
    startYPos: 60,
  });

  const filteredClasses = availableClasses.filter(c => {
    const matchesSearch = c.label.toLowerCase().includes(searchQuery.toLowerCase()) || c.shortUri.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(availableClasses.map(c => c.category)));

  const handleDragStart = (e: React.DragEvent, owlClass: OntologyClass) => {
    e.dataTransfer.setData('application/json', JSON.stringify(owlClass));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Dragging handler (Identical to ExplanationPanel & ModuleSelectorBar)
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

  // Edge / Corner Resize Handler
  const handleResizeMouseDown = (e: React.MouseEvent, dir: ResizeDir) => {
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

  // Dragging Effect (Matching ExplanationPanel & ModuleSelectorBar)
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

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Resizing Effect
  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (!activeResizeDir) return;
      const dx = e.clientX - resizeStartRef.current.startX;
      const dy = e.clientY - resizeStartRef.current.startY;
      let newW = resizeStartRef.current.startW;
      let newH = resizeStartRef.current.startH;
      let newX = resizeStartRef.current.startXPos;
      let newY = resizeStartRef.current.startYPos;

      // Horizontal Edge adjustment
      if (activeResizeDir.includes('e')) {
        newW = Math.min(650, Math.max(220, resizeStartRef.current.startW + dx));
      } else if (activeResizeDir.includes('w')) {
        const possibleW = resizeStartRef.current.startW - dx;
        if (possibleW >= 220 && possibleW <= 650) {
          newW = possibleW;
          newX = resizeStartRef.current.startXPos + dx;
        }
      }

      // Vertical Edge adjustment
      if (activeResizeDir.includes('s')) {
        newH = Math.min(850, Math.max(200, resizeStartRef.current.startH + dy));
      } else if (activeResizeDir.includes('n')) {
        const possibleH = resizeStartRef.current.startH - dy;
        if (possibleH >= 200 && possibleH <= 850) {
          newH = possibleH;
          newY = resizeStartRef.current.startYPos + dy;
        }
      }

      setDimensions({ width: newW, height: newH });
      setPosition({ x: newX, y: newY });
    };

    const handleResizeMouseUp = () => {
      setActiveResizeDir(null);
    };

    if (activeResizeDir) {
      window.addEventListener('mousemove', handleResizeMouseMove);
      window.addEventListener('mouseup', handleResizeMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [activeResizeDir]);

  // Compact minimized view with smooth dragging & click to expand
  if (isCollapsed) {
    return (
      <div
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        className="absolute z-30 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg shadow-md p-1 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleDragMouseDown}
      >
        <GripHorizontal className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex items-center justify-center shadow-2xs hover:bg-blue-100 dark:hover:bg-blue-900 transition-all"
          title="Expandir Palette de Ontologia"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
      className="absolute z-30 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col transition-shadow duration-200 overflow-hidden select-none text-slate-800 dark:text-slate-100"
    >
      {/* Edge Resize Handles */}
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'e')}
        className="absolute top-0 right-0 w-2 h-full cursor-e-resize hover:bg-blue-400/30 transition-colors z-40"
        title="Redimensionar largura"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 's')}
        className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize hover:bg-blue-400/30 transition-colors z-40"
        title="Redimensionar altura"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'w')}
        className="absolute top-0 left-0 w-2 h-full cursor-w-resize hover:bg-blue-400/30 transition-colors z-40"
        title="Redimensionar largura"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'n')}
        className="absolute top-0 left-0 w-full h-2 cursor-n-resize hover:bg-blue-400/30 transition-colors z-40"
        title="Redimensionar altura"
      />

      {/* Corner Resize Handles */}
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'se')}
        className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize hover:bg-blue-500/50 z-50 rounded-br-xl"
        title="Redimensionar dimensões"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'sw')}
        className="absolute bottom-0 left-0 w-3.5 h-3.5 cursor-sw-resize hover:bg-blue-500/50 z-50 rounded-bl-xl"
        title="Redimensionar dimensões"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'ne')}
        className="absolute top-0 right-0 w-3.5 h-3.5 cursor-ne-resize hover:bg-blue-500/50 z-50 rounded-tr-xl"
        title="Redimensionar dimensões"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'nw')}
        className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nw-resize hover:bg-blue-500/50 z-50 rounded-tl-xl"
        title="Redimensionar dimensões"
      />

      {/* Header Bar with Drag Handle */}
      <div
        onMouseDown={handleDragMouseDown}
        className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-t-xl cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="p-1 rounded bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex-shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">Palette de Ontologia</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Arraste para o Canvas</p>
          </div>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex-shrink-0 z-50"
          title="Minimizar Palette"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area */}
      <div className="p-3 overflow-y-auto space-y-3 text-xs flex-1 bg-white dark:bg-slate-900">
        {/* Action Button: Create Custom Equipment */}
        <button
          onClick={() => onOpenCreateModal()}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 text-xs"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>+ Novo Equipamento Custom</span>
        </button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar classe OWL..."
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-[11px] focus:outline-none focus:border-blue-500 shadow-2xs"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap transition-colors border ${
              selectedCategory === 'all'
                ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Todas ({availableClasses.length})
          </button>

          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap transition-colors border ${
                selectedCategory === cat
                  ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                  : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {CATEGORY_NAMES[cat] || cat}
            </button>
          ))}
        </div>

        {/* Classes List */}
        <div className="space-y-1.5">
          {filteredClasses.length === 0 ? (
            <div className="text-center p-4 text-slate-400 text-[11px] italic">
              Nenhuma classe OWL encontrada
            </div>
          ) : (
            filteredClasses.map(owlClass => (
              <div
                key={owlClass.uri}
                draggable
                onDragStart={e => handleDragStart(e, owlClass)}
                onClick={() => onOpenCreateModal(owlClass.uri)}
                className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/40 transition-all cursor-grab active:cursor-grabbing flex items-center justify-between group shadow-2xs"
                title="Arraste para o canvas ou clique para instanciar"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 flex-shrink-0" />
                  <CategoryIcon category={owlClass.category} className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate block group-hover:text-blue-800 dark:group-hover:text-blue-300">
                      {owlClass.label}
                    </span>
                    <span className="font-mono text-[9px] text-slate-500 truncate block">
                      {owlClass.shortUri}
                    </span>
                  </div>
                </div>

                <span className="text-[9px] text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  + Instanciar
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
