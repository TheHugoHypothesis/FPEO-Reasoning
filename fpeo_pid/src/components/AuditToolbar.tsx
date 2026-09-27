'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Play, Settings, RefreshCw, Cpu, Layers, Download, FileText, FileCode, Printer, Workflow, Sparkles } from 'lucide-react';
import { AuditResult, OntologyGraph } from '@/lib/types';

interface AuditToolbarProps {
  graph: OntologyGraph | null;
  auditResult: AuditResult | null;
  isAuditing: boolean;
  onRunAudit: () => void;
  onOpenSettings: () => void;
  onOpenQAPanel?: () => void;
}

export function AuditToolbar({
  graph,
  auditResult,
  isAuditing,
  onRunAudit,
  onOpenSettings,
  onOpenQAPanel,
}: AuditToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const equipmentCount = graph?.equipments.length || 0;
  const connectionCount = graph?.connections.length || 0;

  const handleExportMarkdown = () => {
    if (!auditResult) return;
    const content = `# RELATÓRIO DE AUDITORIA SEMÂNTICA P&ID (FPEO-VIEWER)
Data e Hora: ${auditResult.timestamp}
Status: ${auditResult.isConsistent ? 'VÁLIDO E CONSISTENTE' : 'INCONSISTÊNCIA DETECTADA'}

## 1. RESUMO DA INSPEÇÃO
- Equipamentos analisados: ${equipmentCount}
- Conexões inspecionadas: ${connectionCount}
- Inconsistências encontradas: ${auditResult.justifications.length}

## 2. LAUDO TÉCNICO (LLM OLLAMA)
${auditResult.llmExplanation || 'Nenhum laudo gerado.'}

## 3. JUSTIFICATIVAS FORMAIS (OWL DL REASONER)
${auditResult.justifications.map((j, i) => `
### Justificativa #${i+1}: ${j.title}
- Axiomas TBox Violados:
${j.tboxAxioms.map(a => `  * ${a}`).join('\n')}

- Triplas ABox Conflitantes:
${j.aboxTriples.map(a => `  * ${a}`).join('\n')}
`).join('\n')}
`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_auditoria_pid_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!auditResult) return;
    const blob = new Blob([JSON.stringify(auditResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_auditoria_pid_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    window.print();
    setShowExportMenu(false);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 shadow-xs relative z-30">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Professional Industrial Logo */}
            <div className="p-2 rounded-xl bg-blue-600 shadow-sm border border-blue-700 flex items-center justify-center text-white">
              <Workflow className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none flex items-center gap-2">
                FPEO-VIEWER <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[9px] font-semibold">v1.0</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Auditor Semântico P&ID FPSO</p>
            </div>
          </div>

          {/* Status Badge */}
          {auditResult && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${
                auditResult.isConsistent
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
              }`}
            >
              {auditResult.isConsistent ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>VÁLIDO</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>INCONSISTENTE ({auditResult.justifications.length})</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Center: Active File & Statistics Chips */}
        <div className="hidden lg:flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <FileCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-slate-500 dark:text-slate-400">ABox:</span>
            <strong className="font-mono text-amber-800 dark:text-amber-300 font-bold">
              {graph?.filesLoaded?.find(f => f.includes('abox')) || 'fpeo-collect-equipments-abox.ttl'}
            </strong>
          </div>
          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-slate-500 dark:text-slate-400">Equipamentos:</span>
            <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold">{equipmentCount}</strong>
          </div>
          <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-slate-500 dark:text-slate-400">Triplas:</span>
            <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold">{graph?.rawTriplesCount || 0}</strong>
          </div>
        </div>

        {/* Right: Actions, Export Menu & Audit Button */}
        <div className="flex items-center gap-2.5">
          {/* Export Report Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!auditResult}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border font-bold text-xs transition-all shadow-xs ${
                auditResult
                  ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
              title="Exportação de Relatórios"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {showExportMenu && auditResult && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 space-y-1 text-xs z-50 text-slate-700 dark:text-slate-300">
                <div className="px-3 py-1 font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 text-[9px] uppercase tracking-wider">
                  Exportar Relatório
                </div>
                <button
                  onClick={handleExportMarkdown}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-colors font-medium"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Laudo (Markdown .md)</span>
                </button>
                <button
                  onClick={handleExportJson}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-colors font-medium"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Relatório (JSON)</span>
                </button>
                <button
                  onClick={handleExportPdf}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-colors font-medium"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Imprimir / PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
            title="Configurações do Raciocinador & Ollama"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* GraphRAG Natural Language Q&A Button */}
          {onOpenQAPanel && (
            <button
              onClick={onOpenQAPanel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-xs transition-all shadow-xs active:scale-[0.98]"
              title="Perguntas em Linguagem Natural sobre a Ontologia (GraphRAG)"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>GraphRAG Q&A</span>
            </button>
          )}

          {/* Audit Action Button */}
          <button
            onClick={onRunAudit}
            disabled={isAuditing || equipmentCount === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs shadow-xs transition-all ${
              isAuditing || equipmentCount === 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]'
            }`}
          >
            {isAuditing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Raciocinando...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-white" />
                <span>Auditar P&ID</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
