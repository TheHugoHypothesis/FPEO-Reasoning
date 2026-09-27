'use client';

import React, { memo } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import { Anchor, GripHorizontal, Minimize2, Maximize2 } from 'lucide-react';

export interface FPSOGroupNodeData {
  id: string;
  code: string;
  title: string;
  fieldLocation?: string;
  moduleCount: number;
  equipmentCount: number;
  width?: number;
  height?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: (id: string) => void;
}

export function FPSOGroupNodeComponent({ selected, data, id }: NodeProps) {
  const fpsoData = data as unknown as FPSOGroupNodeData;
  const {
    code,
    title,
    fieldLocation,
    moduleCount,
    equipmentCount,
    isCollapsed,
    onToggleCollapse,
  } = fpsoData;

  const nodeFpsoId = fpsoData.id || id;

  if (isCollapsed) {
    return (
      <div className="relative w-full h-full rounded-2xl border-2 border-blue-500 bg-white dark:bg-slate-900 px-4 py-2.5 select-none cursor-grab active:cursor-grabbing transition-all hover:border-blue-600 shadow-md flex items-center justify-between gap-3 group pointer-events-auto text-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-xs flex-shrink-0">
            <Anchor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-blue-700 dark:text-blue-400 tracking-wider">
                {code}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {title}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              {fieldLocation && <span>📍 {fieldLocation}</span>}
              <span className="text-blue-700 dark:text-blue-400 font-bold">• {moduleCount} Módulos</span>
              <span className="text-slate-700 dark:text-slate-300 font-bold">• {equipmentCount} Equip.</span>
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.(nodeFpsoId);
          }}
          className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 transition-all shadow-xs flex-shrink-0"
          title="Expandir Navio FPSO"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-[2.5rem] border-2 border-dashed border-blue-400 dark:border-blue-600 bg-blue-50/20 dark:bg-blue-950/20 p-6 select-none pointer-events-none transition-all hover:border-blue-500 shadow-sm group">
      <NodeResizer
        minWidth={480}
        minHeight={320}
        isVisible={selected}
        lineClassName="border-blue-500 border-dashed"
        handleClassName="h-4 w-4 bg-blue-600 border-2 border-white rounded-lg shadow-md hover:scale-125 transition-transform"
      />

      {/* Naval Hull Outer Badge Header */}
      <div className="absolute top-4 left-6 flex items-center gap-3 bg-white dark:bg-slate-900 border-2 border-blue-400 dark:border-blue-600 px-4 py-2 rounded-2xl shadow-md hover:border-blue-500 transition-colors pointer-events-auto text-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <GripHorizontal className="w-4 h-4 text-blue-400 group-hover:text-blue-600" />
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-xs">
            <Anchor className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-blue-700 dark:text-blue-400 tracking-wider">
                {code}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {title}
              </span>
            </div>
            {fieldLocation && (
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                📍 {fieldLocation}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-800 pl-3">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
              {moduleCount} Módulos
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
              {equipmentCount} Equip.
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse?.(nodeFpsoId);
              }}
              className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 transition-colors ml-1"
              title="Minimizar FPSO para Cartão Demonstrativo"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const FPSOGroupNode = memo(FPSOGroupNodeComponent);
