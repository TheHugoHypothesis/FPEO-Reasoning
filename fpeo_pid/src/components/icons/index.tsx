import React from 'react';
import { EquipmentCategory } from '@/lib/types';

export function CategoryIcon({ category, className = "w-6 h-6" }: { category: EquipmentCategory; className?: string }) {
  switch (category) {
    case 'CompressorEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <circle cx="24" cy="24" r="18" className="stroke-cyan-600 dark:stroke-cyan-400 fill-cyan-50 dark:fill-cyan-950/50" />
          <polygon points="16,14 36,24 16,34" className="fill-cyan-200/80 dark:fill-cyan-400/30 stroke-cyan-600 dark:stroke-cyan-400" />
          <line x1="24" y1="6" x2="24" y2="42" strokeDasharray="2 2" className="stroke-cyan-500/70 dark:stroke-cyan-500/60" />
        </svg>
      );
    case 'PumpEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <circle cx="22" cy="24" r="16" className="stroke-sky-600 dark:stroke-sky-400 fill-sky-50 dark:fill-sky-950/50" />
          <polygon points="22,12 36,12 36,36 22,36" className="fill-sky-200/70 dark:fill-sky-500/20 stroke-sky-600 dark:stroke-sky-400" />
          <line x1="6" y1="24" x2="38" y2="24" className="stroke-sky-500 dark:stroke-sky-300" />
        </svg>
      );
    case 'GasTurbineEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <polygon points="10,14 38,8 38,40 10,34" className="stroke-amber-600 dark:stroke-amber-400 fill-amber-50 dark:fill-amber-950/50" />
          <line x1="4" y1="24" x2="44" y2="24" strokeDasharray="4 2" className="stroke-amber-500 dark:stroke-amber-300" />
        </svg>
      );
    case 'PressureVesselEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <rect x="14" y="8" width="20" height="32" rx="10" className="stroke-emerald-600 dark:stroke-emerald-400 fill-emerald-50 dark:fill-emerald-950/50" />
          <line x1="14" y1="18" x2="34" y2="18" className="stroke-emerald-500/80 dark:stroke-emerald-500/60" />
          <line x1="14" y1="30" x2="34" y2="30" className="stroke-emerald-500/80 dark:stroke-emerald-500/60" />
        </svg>
      );
    case 'HeatExchangeEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <circle cx="24" cy="24" r="18" className="stroke-orange-600 dark:stroke-orange-400 fill-orange-50 dark:fill-orange-950/50" />
          <path d="M10 24 C14 16, 20 16, 24 24 C28 32, 34 32, 38 24" className="stroke-orange-500 dark:stroke-orange-300 stroke-[3]" />
          <line x1="6" y1="24" x2="10" y2="24" className="stroke-orange-600 dark:stroke-orange-400" />
          <line x1="38" y1="24" x2="42" y2="24" className="stroke-orange-600 dark:stroke-orange-400" />
        </svg>
      );
    case 'SeparationAndFilterEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <polygon points="24,6 42,24 24,42 6,24" className="stroke-purple-600 dark:stroke-purple-400 fill-purple-50 dark:fill-purple-950/50" />
          <line x1="6" y1="24" x2="42" y2="24" strokeDasharray="3 3" className="stroke-purple-500 dark:stroke-purple-300" />
          <line x1="24" y1="6" x2="24" y2="42" strokeDasharray="3 3" className="stroke-purple-500 dark:stroke-purple-300" />
        </svg>
      );
    case 'StorageAndPipingHeaderEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <path d="M10 16 L24 8 L38 16 L38 38 L10 38 Z" className="stroke-slate-600 dark:stroke-slate-400 fill-slate-100 dark:fill-slate-900/60" />
          <line x1="10" y1="24" x2="38" y2="24" className="stroke-slate-400 dark:stroke-slate-500/60" />
        </svg>
      );
    case 'ValveAndSecurityEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <polygon points="10,12 24,24 10,36" className="stroke-rose-600 dark:stroke-rose-400 fill-rose-50 dark:fill-rose-950/50" />
          <polygon points="38,12 24,24 38,36" className="stroke-rose-600 dark:stroke-rose-400 fill-rose-50 dark:fill-rose-950/50" />
          <line x1="24" y1="24" x2="24" y2="10" className="stroke-rose-500 dark:stroke-rose-300" />
          <line x1="18" y1="10" x2="30" y2="10" className="stroke-rose-500 dark:stroke-rose-300" />
        </svg>
      );
    case 'ElectricalEquipment':
    case 'RenewableEquipment':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <rect x="8" y="10" width="32" height="28" rx="4" className="stroke-yellow-600 dark:stroke-yellow-400 fill-yellow-50 dark:fill-yellow-950/50" />
          <path d="M26 14 L18 26 L24 26 L22 34 L30 22 L24 22 Z" className="fill-yellow-500 dark:fill-yellow-400 stroke-yellow-600 dark:stroke-yellow-300" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} stroke="currentColor" strokeWidth="2.5">
          <rect x="14" y="8" width="20" height="32" rx="10" className="stroke-emerald-600 dark:stroke-emerald-400 fill-emerald-50 dark:fill-emerald-950/50" />
          <line x1="14" y1="18" x2="34" y2="18" className="stroke-emerald-500/80 dark:stroke-emerald-500/60" />
          <line x1="14" y1="30" x2="34" y2="30" className="stroke-emerald-500/80 dark:stroke-emerald-500/60" />
        </svg>
      );
  }
}
