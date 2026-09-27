'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Cpu, Box } from 'lucide-react';
import { EquipmentComponent } from '@/lib/types';

export const ComponentNode = memo(({ data }: NodeProps) => {
  const component = data.component as EquipmentComponent;
  const isSelected = data.isSelected;

  return (
    <div
      className={`relative w-64 bg-white dark:bg-slate-900 rounded-xl border-2 transition-all shadow-md p-3 select-none text-slate-800 dark:text-slate-100 ${
        isSelected
          ? 'border-purple-600 shadow-purple-100 ring-2 ring-purple-400/40'
          : 'border-purple-200 dark:border-purple-900/60 hover:border-purple-400 dark:hover:border-purple-600'
      }`}
    >
      {/* Target Handle from Parent Equipment */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${component.uri}_target`}
        className="w-3.5 h-3.5 !bg-purple-600 !border-2 !border-white dark:!border-slate-900 rounded-full shadow-sm"
      />

      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
          <Cpu className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[9px] uppercase font-mono font-bold text-purple-700 dark:text-purple-400 tracking-wider block">
            o3po:hasComponent
          </span>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={component.label}>
            {component.label}
          </h4>
          <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 truncate block">
            {component.shortUri}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
          <Box className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          Sub-componente Interno
        </span>
        <span className="font-mono text-purple-800 dark:text-purple-300 text-[9px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 font-semibold">
          ABox Triple
        </span>
      </div>

      {/* Optional Source Handle for child nested components */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${component.uri}_source`}
        className="w-3.5 h-3.5 !bg-purple-600 !border-2 !border-white dark:!border-slate-900 rounded-full shadow-sm"
      />
    </div>
  );
});

ComponentNode.displayName = 'ComponentNode';
