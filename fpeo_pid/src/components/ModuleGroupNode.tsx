'use client';

import React, { memo } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import { Box, GripHorizontal, Minimize2, Maximize2 } from 'lucide-react';

export interface ModuleGroupNodeData {
  id?: string;
  code: string;
  title: string;
  description?: string;
  equipmentCount: number;
  width?: number;
  height?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: (id: string) => void;
}

export function ModuleGroupNodeComponent({ selected, data, id }: NodeProps) {
  const groupData = data as unknown as ModuleGroupNodeData;
  const { code, title, equipmentCount, isCollapsed, onToggleCollapse } = groupData;
  const nodeModId = groupData.id || id;

  if (isCollapsed) {
    return (
      <div className="relative w-full h-full rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 select-none cursor-grab active:cursor-grabbing transition-all hover:border-blue-500 shadow-md flex items-center justify-between gap-2.5 group pointer-events-auto text-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-xs flex-shrink-0">
            <Box className="w-4 h-4" />
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
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
              {equipmentCount} equip.
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.(nodeModId);
          }}
          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 transition-all shadow-xs flex-shrink-0"
          title="Expandir Módulo Topside"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-4 select-none pointer-events-none transition-all hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 shadow-xs group"
    >
      <NodeResizer
        minWidth={280}
        minHeight={180}
        isVisible={selected}
        lineClassName="border-blue-500 border-dashed"
        handleClassName="h-3.5 w-3.5 bg-blue-600 border-2 border-white rounded-md shadow-md hover:scale-125 transition-transform"
      />

      {/* Header Drag Handle Badge */}
      <div className="absolute top-3 left-4 flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-md hover:border-blue-400 transition-colors pointer-events-auto text-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <GripHorizontal className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          <div className="p-1 rounded bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
            <Box className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black text-blue-700 dark:text-blue-400 tracking-wider">
            {code}
          </span>
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {title}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold">
            {equipmentCount} equip.
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.(nodeModId);
            }}
            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 transition-colors ml-1"
            title="Minimizar Módulo para Cartão Demonstrativo"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const ModuleGroupNode = memo(ModuleGroupNodeComponent);
