import React, { memo, useEffect } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { Equipment, EquipmentCategory, EquipmentPort, EquipmentComponent } from '@/lib/types';
import { CategoryIcon } from './icons';
import { AlertTriangle, Cpu, RotateCw } from 'lucide-react';

export interface EquipmentNodeData {
  equipment: Equipment;
  label: string;
  category: EquipmentCategory;
  classLabel: string;
  hasError?: boolean;
  errorMessage?: string;
  isSelected?: boolean;
  rotation?: number; // 0, 90, 180, 270
  onRotate?: (uri: string, newAngle: number) => void;
}

const categoryColors: Record<EquipmentCategory, { border: string; bg: string; text: string; badge: string }> = {
  CompressorEquipment: { border: 'border-blue-300 dark:border-blue-700', bg: 'bg-white dark:bg-slate-900', text: 'text-blue-900 dark:text-blue-300', badge: 'bg-blue-50 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  PumpEquipment: { border: 'border-sky-300 dark:border-sky-700', bg: 'bg-white dark:bg-slate-900', text: 'text-sky-900 dark:text-sky-300', badge: 'bg-sky-50 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  GasTurbineEquipment: { border: 'border-amber-300 dark:border-amber-700', bg: 'bg-white dark:bg-slate-900', text: 'text-amber-900 dark:text-amber-300', badge: 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  PressureVesselEquipment: { border: 'border-emerald-300 dark:border-emerald-700', bg: 'bg-white dark:bg-slate-900', text: 'text-emerald-900 dark:text-emerald-300', badge: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  HeatExchangeEquipment: { border: 'border-orange-300 dark:border-orange-700', bg: 'bg-white dark:bg-slate-900', text: 'text-orange-900 dark:text-orange-300', badge: 'bg-orange-50 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  SeparationAndFilterEquipment: { border: 'border-purple-300 dark:border-purple-700', bg: 'bg-white dark:bg-slate-900', text: 'text-purple-900 dark:text-purple-300', badge: 'bg-purple-50 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  StorageAndPipingHeaderEquipment: { border: 'border-slate-300 dark:border-slate-700', bg: 'bg-white dark:bg-slate-900', text: 'text-slate-900 dark:text-slate-300', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
  ValveAndSecurityEquipment: { border: 'border-rose-300 dark:border-rose-700', bg: 'bg-white dark:bg-slate-900', text: 'text-rose-900 dark:text-rose-300', badge: 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  ElectricalEquipment: { border: 'border-yellow-400 dark:border-yellow-600', bg: 'bg-white dark:bg-slate-900', text: 'text-yellow-900 dark:text-yellow-300', badge: 'bg-yellow-50 dark:bg-yellow-950/80 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' },
  RenewableEquipment: { border: 'border-teal-300 dark:border-teal-700', bg: 'bg-white dark:bg-slate-900', text: 'text-teal-900 dark:text-teal-300', badge: 'bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800' },
  GenericEquipment: { border: 'border-slate-300 dark:border-slate-700', bg: 'bg-white dark:bg-slate-900', text: 'text-slate-800 dark:text-slate-300', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
};

const POSITION_ORDER: Position[] = [Position.Left, Position.Top, Position.Right, Position.Bottom];

function getRotatedPosition(basePos: Position, rotationAngle: number = 0): Position {
  const steps = Math.floor(rotationAngle / 90) % 4;
  const currIdx = POSITION_ORDER.indexOf(basePos);
  if (currIdx === -1) return basePos;
  return POSITION_ORDER[(currIdx + steps) % 4];
}

const rotationBadges: Record<number, { label: string; arrow: string }> = {
  0: { label: '0°', arrow: '➡️' },
  90: { label: '90°', arrow: '⬇️' },
  180: { label: '180°', arrow: '⬅️' },
  270: { label: '270°', arrow: '⬆️' },
};

function PortHandlePair({ id, type, position, handleColor }: { id: string; type: string; position: Position; handleColor: string }) {
  return (
    <>
      <Handle
        type="target"
        position={position}
        id={id}
        className={`w-3.5 h-3.5 ${handleColor} !border-2 !border-white dark:!border-slate-900 rounded-full shadow-sm`}
      />
      <Handle
        type="source"
        position={position}
        id={id}
        className={`w-3.5 h-3.5 ${handleColor} !border-2 !border-white dark:!border-slate-900 rounded-full shadow-sm`}
      />
    </>
  );
}

function EquipmentNodeComponent({ id, data, selected }: NodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const nodeData = data as unknown as EquipmentNodeData;
  const { equipment, label, category, classLabel, hasError, errorMessage, rotation = 0 } = nodeData;
  const colors = categoryColors[category] || categoryColors.GenericEquipment;
  const currentRotation = rotationBadges[rotation] || rotationBadges[0];

  // Notify React Flow whenever node rotation changes to update handle spatial bounds
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, rotation, updateNodeInternals]);

  // Consolidate explicit ports and virtual fallback ports (_in, _out, _elec)
  const existingPorts = equipment.ports || [];
  const portUris = new Set(existingPorts.map(p => p.uri));

  const allPorts: EquipmentPort[] = [...existingPorts];

  const inVirtualUri = `${equipment.uri}_in`;
  if (!portUris.has(inVirtualUri)) {
    allPorts.push({ uri: inVirtualUri, shortUri: 'IN', type: 'InletPort', equipmentUri: equipment.uri });
  }

  const outVirtualUri = `${equipment.uri}_out`;
  if (!portUris.has(outVirtualUri)) {
    allPorts.push({ uri: outVirtualUri, shortUri: 'OUT', type: 'OutletPort', equipmentUri: equipment.uri });
  }

  const elecVirtualUri = `${equipment.uri}_elec`;
  if (!portUris.has(elecVirtualUri)) {
    allPorts.push({ uri: elecVirtualUri, shortUri: 'ELEC', type: 'ElectricalPort', equipmentUri: equipment.uri });
  }

  // Calculate rotated position for each port
  const portsWithPosition = allPorts.map((port) => {
    let basePos = Position.Left;
    if (port.type === 'InletPort') basePos = Position.Left;
    else if (port.type === 'OutletPort') basePos = Position.Right;
    else if (port.type === 'ElectricalPort' || port.type === 'SignalPort') basePos = Position.Bottom;

    const rotatedPos = getRotatedPosition(basePos, rotation);
    return { ...port, rotatedPos };
  });

  const leftPorts = portsWithPosition.filter((p) => p.rotatedPos === Position.Left);
  const rightPorts = portsWithPosition.filter((p) => p.rotatedPos === Position.Right);
  const topPorts = portsWithPosition.filter((p) => p.rotatedPos === Position.Top);
  const bottomPorts = portsWithPosition.filter((p) => p.rotatedPos === Position.Bottom);

  return (
    <div
      style={{
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
      }}
      className={`relative w-[280px] rounded-xl bg-white dark:bg-slate-900 border shadow-md hover:shadow-lg transition-all duration-200 text-slate-800 dark:text-slate-100 ${
        hasError
          ? 'border-red-600 ring-2 ring-red-400/40 shadow-red-200'
          : selected
          ? 'border-blue-600 ring-2 ring-blue-400/40 shadow-blue-100'
          : colors.border
      }`}
    >
      {/* Static Error Badge */}
      {hasError && (
        <div
          style={{ transform: `rotate(-${rotation}deg)` }}
          className="absolute -top-3 -right-3 z-20 flex items-center gap-1 bg-red-600 text-white px-2.5 py-0.5 rounded-full text-xs font-extrabold shadow-md border border-red-400 transition-transform duration-300"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>INCONSISTENTE</span>
        </div>
      )}

      {/* Interactive Rotation Badge */}
      {selected && (
        <div
          style={{ transform: `rotate(-${rotation}deg)` }}
          onClick={(e) => {
            e.stopPropagation();
            const nextAngle = ((rotation || 0) + 90) % 360;
            nodeData.onRotate?.(equipment.uri, nextAngle);
          }}
          title="Clique para girar 90° ou use as setas do teclado (⬆️ ⬇️ ⬅️ ➡️)"
          className="absolute -top-3 -left-3 z-20 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-sm border border-blue-300 dark:border-blue-700 cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <RotateCw className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>{currentRotation.label} {currentRotation.arrow}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 rounded-t-xl">
        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-center">
          <CategoryIcon category={category} className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-tight" title={label}>
            {label}
          </h3>
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 mt-1 rounded border ${colors.badge} truncate max-w-full`}>
            {classLabel}
          </span>
        </div>
      </div>

      {/* Body / URI */}
      <div className="p-3 text-xs space-y-1.5 bg-white dark:bg-slate-900">
        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">ID Semântico</span>
          <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[170px]" title={equipment.shortUri}>
            {equipment.shortUri}
          </span>
        </div>

        {equipment.design?.specifications && equipment.design.specifications.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {equipment.design.specifications[0].specTypeLabel.replace(/ Specification.*$/, '')}
            </span>
            <span className="font-mono text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-bold">
              {equipment.design.specifications[0].value} {equipment.design.specifications[0].unitShort}
            </span>
          </div>
        )}

        {equipment.components && equipment.components.length > 0 && (
          <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
            <span className="text-[10px] uppercase tracking-wider text-purple-700 dark:text-purple-400 font-semibold flex items-center gap-1">
              <Cpu className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              Componentes
            </span>
            <span className="font-mono text-[10px] text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 font-bold">
              {equipment.components.length}
            </span>
          </div>
        )}

        {hasError && errorMessage && (
          <div className="p-2 rounded bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-[11px] text-red-800 dark:text-red-300 leading-tight font-medium mt-2">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>

      {/* PORT HANDLES AROUND 4 EDGES */}

      {/* LEFT SIDE HANDLES */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-3 -translate-x-1.5 z-10">
        {leftPorts.map((p) => {
          const handleColor = p.type === 'InletPort' ? '!bg-emerald-600' : p.type === 'OutletPort' ? '!bg-orange-500' : '!bg-yellow-500';
          const textColor = p.type === 'InletPort' ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : p.type === 'OutletPort' ? 'text-orange-700 border-orange-300 bg-orange-50' : 'text-yellow-700 border-yellow-300 bg-yellow-50';

          return (
            <div key={p.uri} className="relative group">
              <PortHandlePair id={p.uri} type={p.type} position={Position.Left} handleColor={handleColor} />
              <span
                title={p.shortUri}
                className={`absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1 rounded border ${textColor} pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[90px] whitespace-nowrap shadow-sm z-30`}
              >
                {p.shortUri}
              </span>
            </div>
          );
        })}
      </div>

      {/* RIGHT SIDE HANDLES */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-3 translate-x-1.5 z-10">
        {rightPorts.map((p) => {
          const handleColor = p.type === 'InletPort' ? '!bg-emerald-600' : p.type === 'OutletPort' ? '!bg-orange-500' : '!bg-yellow-500';
          const textColor = p.type === 'InletPort' ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : p.type === 'OutletPort' ? 'text-orange-700 border-orange-300 bg-orange-50' : 'text-yellow-700 border-yellow-300 bg-yellow-50';

          return (
            <div key={p.uri} className="relative group flex justify-end">
              <PortHandlePair id={p.uri} type={p.type} position={Position.Right} handleColor={handleColor} />
              <span
                title={p.shortUri}
                className={`absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono px-1 rounded border ${textColor} pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[90px] whitespace-nowrap shadow-sm z-30`}
              >
                {p.shortUri}
              </span>
            </div>
          );
        })}
      </div>

      {/* TOP SIDE HANDLES */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-3 -translate-y-1.5 z-10">
        {topPorts.map((p) => {
          const handleColor = p.type === 'InletPort' ? '!bg-emerald-600' : p.type === 'OutletPort' ? '!bg-orange-500' : '!bg-yellow-500';
          return <PortHandlePair key={p.uri} id={p.uri} type={p.type} position={Position.Top} handleColor={handleColor} />;
        })}
      </div>

      {/* BOTTOM SIDE HANDLES */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-3 translate-y-1.5 z-10">
        {bottomPorts.map((p) => {
          const handleColor = p.type === 'InletPort' ? '!bg-emerald-600' : p.type === 'OutletPort' ? '!bg-orange-500' : '!bg-yellow-500';
          return <PortHandlePair key={p.uri} id={p.uri} type={p.type} position={Position.Bottom} handleColor={handleColor} />;
        })}
      </div>
    </div>
  );
}

export const EquipmentNode = memo(EquipmentNodeComponent);
