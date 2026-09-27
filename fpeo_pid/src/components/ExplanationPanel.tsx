'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Bot,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  FileCode,
  Copy,
  Check,
  X,
  GripHorizontal,
} from 'lucide-react';
import { AuditResult, InconsistencyJustification } from '@/lib/types';

interface ExplanationPanelProps {
  auditResult: AuditResult | null;
  onSelectEquipmentUri?: (uri: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function renderFormattedMarkdown(text: string) {
  if (!text) return null;

  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-1.5" />;

    // Headers ###
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={idx} className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-3 mb-1.5 border-b border-slate-200 dark:border-slate-800 pb-1 uppercase tracking-wide flex items-center gap-1">
          {trimmed.replace('### ', '')}
        </h3>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={idx} className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-4 mb-2 border-b border-slate-200 dark:border-slate-800 pb-1">
          {trimmed.replace('## ', '')}
        </h2>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h1 key={idx} className="text-base font-black text-slate-900 dark:text-slate-100 mt-4 mb-2">
          {trimmed.replace('# ', '')}
        </h1>
      );
    }

    // Process bold text **words**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formattedLine = parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx} className="font-bold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    // Bullet items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <li key={idx} className="ml-4 list-disc text-slate-700 dark:text-slate-300 my-1 leading-relaxed">
          {formattedLine}
        </li>
      );
    }

    // Numbered items
    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <li key={idx} className="ml-4 list-decimal text-slate-700 dark:text-slate-300 my-1 leading-relaxed">
          {formattedLine}
        </li>
      );
    }

    return (
      <p key={idx} className="text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
        {formattedLine}
      </p>
    );
  });
}

type ResizeDir = 'e' | 's' | 'w' | 'n' | 'se' | 'sw' | 'ne' | 'nw';

export function ExplanationPanel({
  auditResult,
  onSelectEquipmentUri,
  isOpen = false,
  onClose,
}: ExplanationPanelProps) {
  const [activeTab, setActiveTab] = useState<'formal' | 'llm'>('formal');
  const [copied, setCopied] = useState(false);

  // Position & Drag state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 880, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 880,
    posY: 16,
  });

  // Resizing state (Multi-edge & corner resizing)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 440, height: 580 });
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
    startW: 440,
    startH: 580,
    startXPos: 880,
    startYPos: 16,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('input')
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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPosition({
        x: Math.max(16, dragStartRef.current.posX + dx),
        y: Math.max(16, dragStartRef.current.posY + dy),
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
        newW = Math.min(800, Math.max(320, resizeStartRef.current.startW + dx));
      } else if (activeResizeDir.includes('w')) {
        const possibleW = resizeStartRef.current.startW - dx;
        if (possibleW >= 320 && possibleW <= 800) {
          newW = possibleW;
          newX = resizeStartRef.current.startXPos + dx;
        }
      }

      // Vertical Edge adjustment
      if (activeResizeDir.includes('s')) {
        newH = Math.min(900, Math.max(250, resizeStartRef.current.startH + dy));
      } else if (activeResizeDir.includes('n')) {
        const possibleH = resizeStartRef.current.startH - dy;
        if (possibleH >= 250 && possibleH <= 900) {
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

  if (!isOpen) return null;

  if (!auditResult) {
    return (
      <div
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${dimensions.width}px`,
        }}
        className="absolute z-40 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 shadow-2xl select-none"
      >
        <div
          onMouseDown={handleMouseDown}
          className="w-full flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-3 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
            <GripHorizontal className="w-4 h-4 text-slate-400" />
            <span>Auditoria Semântica</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Esconder Painel de Auditoria"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <BookOpen className="w-10 h-10 mb-3 text-slate-400 stroke-[1.5]" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Painel de Auditoria Semântica</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Clique no botão <strong className="text-blue-700 dark:text-blue-400">"Verificar Integridade do P&ID"</strong> para executar o raciocinador HermiT e visualizar a análise.
        </p>
      </div>
    );
  }

  const { isConsistent, justifications, llmExplanation } = auditResult;

  const handleCopyLlm = () => {
    if (llmExplanation) {
      navigator.clipboard.writeText(llmExplanation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
      className="absolute z-40 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col transition-shadow duration-200 overflow-hidden select-none text-slate-800 dark:text-slate-100"
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
      {/* Panel Header */}
      <div
        onMouseDown={handleMouseDown}
        className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <GripHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 truncate">
              Relatório de Inspecção Semântica
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{auditResult.timestamp}</span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Esconder Painel de Auditoria"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Big Status Badge */}
        <div
          className={`p-3 rounded-xl border flex items-center gap-3 shadow-2xs ${
            isConsistent
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/80 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          {isConsistent ? (
            <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0 animate-bounce" />
          )}
          <div>
            <h2 className="text-sm font-bold leading-tight">
              {isConsistent ? 'Ontologia Válida e Consistente' : 'Inconsistência Lógica/Física Detectada'}
            </h2>
            <p className="text-[11px] opacity-85 mt-0.5 font-medium">
              {isConsistent
                ? 'Nenhum axioma TBox foi violado pelas instâncias ABox do P&ID.'
                : `${justifications.length} contradição(ões) encontrada(s) pelo HermiT.`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <button
          onClick={() => setActiveTab('formal')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'formal'
              ? 'border-blue-600 text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Justificação Formal (OWL)</span>
        </button>

        <button
          onClick={() => setActiveTab('llm')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'llm'
              ? 'border-purple-600 text-purple-800 dark:text-purple-300 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Explicação LLM (Ollama)</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900">
        {activeTab === 'formal' ? (
          <div>
            {isConsistent ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs">
                <Check className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-2 opacity-60" />
                <p>Nenhuma explicação formal necessária. Todos os axiomas de engenharia foram respeitados.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {justifications.map((item: InconsistencyJustification, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="bg-white dark:bg-slate-950 border border-red-200 dark:border-red-900/60 rounded-xl p-3.5 space-y-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{item.title}</span>
                    </div>

                    {/* TBox Axiom */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                        Axioma TBox Violado (Regra Física)
                      </span>
                      <div className="mt-1 p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-blue-800 dark:text-blue-300 overflow-x-auto">
                        {item.tboxAxioms.map((ax, i) => (
                          <div key={i}>{ax}</div>
                        ))}
                      </div>
                    </div>

                    {/* ABox Triples */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                        Triplas ABox Conflitantes (Diagrama)
                      </span>
                      <div className="mt-1 p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-amber-800 dark:text-amber-300 space-y-1">
                        {item.aboxTriples.map((tr, i) => (
                          <div key={i} className="break-all">{tr}</div>
                        ))}
                      </div>
                    </div>

                    {/* Involved Equipments */}
                    {item.involvedEquipmentUris.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                          Equipamentos Envolvidos
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.involvedEquipmentUris.map((uri) => (
                            <button
                              key={uri}
                              onClick={() => onSelectEquipmentUri?.(uri)}
                              className="text-[10px] font-mono bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-2 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center gap-1 font-semibold"
                            >
                              <span>{uri.split('#').pop()}</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tab 2: LLM Explanation */
          <div className="h-full flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Tradução para Linguagem Natural (Pt-BR)</span>
              </span>
              {llmExplanation && (
                <button
                  onClick={handleCopyLlm}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 shadow-2xs font-medium"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs leading-relaxed text-slate-800 dark:text-slate-200 overflow-y-auto font-sans space-y-1 shadow-2xs">
              {llmExplanation ? (
                renderFormattedMarkdown(llmExplanation)
              ) : isConsistent ? (
                <p className="text-slate-500 dark:text-slate-400 italic">
                  O diagrama P&ID está totalmente em conformidade com as especificações ISO/API da ontologia FPEO. Não foram detectados riscos operacionais ou sobrepressões.
                </p>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 italic">
                  Aguardando geração de texto pelo modelo Ollama... (certifique-se que o Ollama está rodando ou verifique as configurações no botão ⚙️).
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
