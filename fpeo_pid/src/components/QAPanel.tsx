'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquareQuote,
  Sparkles,
  Send,
  X,
  Database,
  Network,
  Code2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Bot,
  Info,
  Loader2,
  Anchor,
  Compass,
  Key,
  Settings2,
  GripHorizontal,
  Minimize2,
  Maximize2,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { useOntology } from '@/context/OntologyContext';
import { askOntologyGraphRAG, QAResponse } from '@/lib/qaClient';

interface QAPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_PROMPTS = [
  'Quais compressores estão no FPSO P-78?',
  'Quais equipamentos estão no módulo M-01?',
  'Quais bombas estão instaladas no FPSO P-79?',
  'Quais são as portas e conexões do gerador GTG-01?',
  'Quais trocadores de calor existem no processo?',
];

const GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash — Interactions API (Recomendado)' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite — Rápido' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro — Raciocínio Profundo' },
];

type ResizeDir = 'e' | 's' | 'w' | 'n' | 'se' | 'sw' | 'ne' | 'nw';

export const QAPanel: React.FC<QAPanelProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, activeFpsoId, activeModuleId, fpsos, modules, rawFiles } = useOntology();
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qaResult, setQaResult] = useState<QAResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gemini API Key & Model Settings
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [geminiModel, setGeminiModel] = useState<string>('gemini-3.6-flash');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Minimize state
  const [isMinimized, setIsMinimized] = useState(false);

  // Position & Drag state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 740, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 740,
    posY: 16,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  // Resizing state (Multi-edge & corner resizing)
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 480, height: 640 });
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
    startW: 480,
    startH: 640,
    startXPos: 740,
    startYPos: 16,
  });

  // Load API Key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setGeminiApiKey(savedKey);
    const savedModel = localStorage.getItem('gemini_model');
    if (savedModel) setGeminiModel(savedModel);
    else setGeminiModel('gemini-3.6-flash');
  }, []);

  const handleSaveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const handleSaveModel = (model: string) => {
    setGeminiModel(model);
    localStorage.setItem('gemini_model', model);
  };

  // Dragging handler
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

  // Move effect
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

  // Resize effect (Full 8 directions)
  useEffect(() => {
    const handleResizeMouseMove = (e: MouseEvent) => {
      if (!activeResizeDir) return;
      const dx = e.clientX - resizeStartRef.current.startX;
      const dy = e.clientY - resizeStartRef.current.startY;
      let newW = resizeStartRef.current.startW;
      let newH = resizeStartRef.current.startH;
      let newX = resizeStartRef.current.startXPos;
      let newY = resizeStartRef.current.startYPos;

      // Width adjustments
      if (activeResizeDir.includes('e')) {
        newW = Math.min(900, Math.max(340, resizeStartRef.current.startW + dx));
      } else if (activeResizeDir.includes('w')) {
        const possibleW = resizeStartRef.current.startW - dx;
        if (possibleW >= 340 && possibleW <= 900) {
          newW = possibleW;
          newX = resizeStartRef.current.startXPos + dx;
        }
      }

      // Height adjustments
      if (activeResizeDir.includes('s')) {
        newH = Math.min(950, Math.max(280, resizeStartRef.current.startH + dy));
      } else if (activeResizeDir.includes('n')) {
        const possibleH = resizeStartRef.current.startH - dy;
        if (possibleH >= 280 && possibleH <= 950) {
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

  // Collapsible section toggles
  const [isMappingOpen, setIsMappingOpen] = useState(true);
  const [isSparqlOpen, setIsSparqlOpen] = useState(false);
  const [isGraphRagOpen, setIsGraphRagOpen] = useState(false);
  const [copiedSparql, setCopiedSparql] = useState(false);

  const activeFpsoObj = fpsos.find(f => f.id === activeFpsoId || f.code === activeFpsoId);
  const activeModObj = modules.find(m => m.code === activeModuleId || m.id === activeModuleId);

  const handleCopySparql = useCallback(() => {
    if (!qaResult?.sparql_query) return;
    navigator.clipboard.writeText(qaResult.sparql_query);
    setCopiedSparql(true);
    setTimeout(() => setCopiedSparql(false), 2000);
  }, [qaResult]);

  const handleSubmit = async (e?: React.FormEvent, customQ?: string) => {
    if (e) e.preventDefault();
    const queryToAsk = customQ || question;
    if (!queryToAsk.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await askOntologyGraphRAG(
        {
          question: queryToAsk.trim(),
          active_fpso_id: activeFpsoId !== 'ALL' ? activeFpsoId : undefined,
          active_module_id: activeModuleId !== 'ALL' ? activeModuleId : undefined,
          ttl_contents: rawFiles.map(f => f.content),
          llm_provider: settings.llmProvider || 'gemini',
          gemini_api_key: settings.geminiApiKey?.trim() || undefined,
          gemini_model: settings.geminiModel || 'gemini-3.6-flash',
          ollama_url: settings.ollamaUrl || undefined,
          ollama_model: settings.ollamaModel || undefined,
        },
        settings.backendUrl
      );

      setQaResult(response);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao processar a pergunta com o GraphRAG.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Minimized floating pill representation
  if (isMinimized) {
    return (
      <div
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        className="absolute z-40 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-xl px-3.5 py-2 select-none cursor-grab active:cursor-grabbing flex items-center gap-3 text-slate-800 dark:text-slate-100 group transition-shadow duration-200"
      >
        <div onMouseDown={handleMouseDown} className="flex items-center gap-2.5 min-w-0">
          <GripHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex-shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0 pr-1">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">GraphRAG Q&A</span>
            <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold font-mono">
              {settings.llmProvider === 'gemini' ? (settings.geminiModel || 'Gemini') : settings.llmProvider === 'ollama' ? `Ollama (${settings.ollamaModel})` : 'Sem LLM (HermiT)'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs cursor-pointer"
            title="Expandir Assistente GraphRAG"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar Assistente"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
      className="absolute z-40 flex flex-col bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100 transition-shadow duration-200"
    >
      {/* Resize handles */}
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'e')}
        className="absolute top-0 right-0 w-2 h-full cursor-e-resize hover:bg-blue-500/50 z-30"
        title="Redimensionar largura"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'w')}
        className="absolute top-0 left-0 w-2 h-full cursor-w-resize hover:bg-blue-500/50 z-30"
        title="Redimensionar largura"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 's')}
        className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize hover:bg-blue-500/50 z-30"
        title="Redimensionar altura"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'n')}
        className="absolute top-0 left-0 w-full h-2 cursor-n-resize hover:bg-blue-500/50 z-30"
        title="Redimensionar altura"
      />
      <div
        onMouseDown={e => handleResizeMouseDown(e, 'se')}
        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 cursor-se-resize hover:bg-blue-500/50 z-40 rounded-br-xl"
        title="Redimensionar dimensões"
      />

      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <GripHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex-shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wide truncate">GraphRAG Semântico</h2>
              {settings.llmProvider === 'gemini' && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                  {settings.geminiModel || 'Gemini'}
                </span>
              )}
              {settings.llmProvider === 'ollama' && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-50 dark:bg-purple-950/80 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 flex items-center gap-0.5">
                  <Cpu className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                  Ollama
                </span>
              )}
              {settings.llmProvider === 'none' && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                  Sem LLM
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Q&A Ontológico Grounded em SPARQL</p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer ${
              isSettingsOpen ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300' : ''
            }`}
            title="Configurar Provedor de IA / Chaves"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Minimizar para Ícone Compacto"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar Painel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Drawer */}
      {isSettingsOpen && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs space-y-3 animate-in slide-in-from-top duration-200 text-slate-800 dark:text-slate-200">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Provedor de LLM / IA:</span>
            <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => updateSettings({ ...settings, llmProvider: 'gemini' })}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  settings.llmProvider === 'gemini'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Gemini
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ ...settings, llmProvider: 'ollama' })}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  settings.llmProvider === 'ollama'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Ollama
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ ...settings, llmProvider: 'none' })}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  settings.llmProvider === 'none'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Sem LLM
              </button>
            </div>
          </div>

          {settings.llmProvider === 'gemini' && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1 text-[11px]">Chave da API Gemini (Google AI Studio):</label>
                <input
                  type="password"
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => updateSettings({ ...settings, geminiApiKey: e.target.value })}
                  placeholder="Cole sua chave AIzaSy..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1 text-[11px]">Modelo LLM:</label>
                <select
                  value={settings.geminiModel || 'gemini-3.6-flash'}
                  onChange={(e) => updateSettings({ ...settings, geminiModel: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs shadow-2xs"
                >
                  <option value="gemini-3.6-flash">gemini-3.6-flash (Padrão)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                </select>
              </div>
            </div>
          )}

          {settings.llmProvider === 'ollama' && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1 text-[11px]">Endpoint Ollama:</label>
                <input
                  type="text"
                  value={settings.ollamaUrl || 'http://localhost:11434'}
                  onChange={(e) => updateSettings({ ...settings, ollamaUrl: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1 text-[11px]">Modelo Ollama:</label>
                <input
                  type="text"
                  value={settings.ollamaModel || 'gemma4:12b-it-qat'}
                  onChange={(e) => updateSettings({ ...settings, ollamaModel: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 shadow-2xs"
                />
              </div>
            </div>
          )}

          {settings.llmProvider === 'none' && (
            <div className="py-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
              <span>O motor LLM está desativado. Para fazer perguntas no GraphRAG, selecione o Google Gemini ou Ollama.</span>
            </div>
          )}
        </div>
      )}

      {/* Contextual Banner */}
      <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Anchor className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            Navio: <strong className="text-slate-900 dark:text-slate-100 font-bold">{activeFpsoObj?.title || 'Frota Geral'}</strong>
          </span>
          <span className="text-slate-400">•</span>
          <span className="flex items-center gap-1">
            <Compass className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            Módulo: <strong className="text-slate-900 dark:text-slate-100 font-bold">{activeModObj?.title || 'Todos'}</strong>
          </span>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium">TBox + ABox</span>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-white dark:bg-slate-900">
        {/* Sample Prompt Chips */}
        {!qaResult && !isLoading && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Sugestões de Perguntas Ontológicas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuestion(prompt);
                    handleSubmit(undefined, prompt);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/80 hover:text-blue-800 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 text-slate-700 dark:text-slate-300 text-left transition-all shadow-2xs font-medium"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-10 flex flex-col items-center justify-center space-y-3 text-center">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 animate-pulse flex items-center justify-center shadow-md text-white">
                <Bot className="w-5 h-5 animate-bounce" />
              </div>
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin absolute -top-1 -left-1 opacity-70" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Executando Pipeline GraphRAG</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs mt-0.5 font-medium">
                Mapeamento Ontológico → Exploração Multi-Hop → SPARQL 1.1 → Gemini
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-start gap-2.5 shadow-2xs">
            <Info className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Falha no Processamento</p>
              <p className="text-red-700 dark:text-red-300 leading-relaxed">{errorMessage}</p>
              {!geminiApiKey && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-bold"
                >
                  <Key className="w-3 h-3" /> Configurar Chave Gemini
                </button>
              )}
            </div>
          </div>
        )}

        {/* Q&A Result Presentation */}
        {qaResult && !isLoading && (
          <div className="space-y-3">
            {/* Final Natural Language Answer */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Resposta do Especialista (Gemini)</span>
                </div>
                <div className="flex items-center gap-2">
                  {qaResult.hermit_consistency && !qaResult.hermit_consistency.isConsistent && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                      title="Inconsistência lógica detectada no grafo inferido"
                    >
                      Inconsistente
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400">{qaResult.timestamp}</span>
                </div>
              </div>
              <div className="prose-md-answer text-xs leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {qaResult.llm_response}
                </ReactMarkdown>
              </div>
            </div>

            {/* Accordion 1: Semantic Mapping */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden shadow-2xs">
              <button
                onClick={() => setIsMappingOpen(!isMappingOpen)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">1. Mapeamento Ontológico</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    ({qaResult.semantic_mapping?.target_classes?.length || 0} classes • {qaResult.semantic_mapping?.context_entities?.length || 0} entidades)
                  </span>
                </div>
                {isMappingOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              </button>

              {isMappingOpen && (
                <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2 bg-white dark:bg-slate-900">
                  {qaResult.semantic_mapping?.target_classes?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Classes Identificadas:</p>
                      <div className="flex flex-wrap gap-1">
                        {qaResult.semantic_mapping.target_classes.map((cls, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[10px] font-medium"
                            title={cls.uri}
                          >
                            {cls.label} ({cls.local_name})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {qaResult.semantic_mapping?.context_entities?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">Entidades de Contexto / Restrição:</p>
                      <div className="flex flex-wrap gap-1">
                        {qaResult.semantic_mapping.context_entities.map((ent, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-[10px] font-medium"
                            title={ent.uri}
                          >
                            ⚓ {ent.label} ({ent.local_name})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accordion 2: SPARQL 1.1 Query */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden shadow-2xs">
              <button
                onClick={() => setIsSparqlOpen(!isSparqlOpen)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">2. Consulta SPARQL 1.1 Gerada</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    ({qaResult.sparql_results?.length || 0} resultados)
                  </span>
                </div>
                {isSparqlOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              </button>

              {isSparqlOpen && (
                <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1.5 bg-white dark:bg-slate-900">
                  <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                    <span className="truncate pr-2">{qaResult.sparql_intent}</span>
                    <button
                      onClick={handleCopySparql}
                      className="flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-all font-medium flex-shrink-0"
                    >
                      {copiedSparql ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedSparql ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <pre className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[10px] overflow-x-auto max-h-40">
                    {qaResult.sparql_query}
                  </pre>
                </div>
              )}
            </div>

            {/* Accordion 3: GraphRAG Subgraph Evidence */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden shadow-2xs">
              <button
                onClick={() => setIsGraphRagOpen(!isGraphRagOpen)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Network className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">3. Subgrafo GraphRAG</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    ({qaResult.exploration?.explored_triples?.length || 0} triplas)
                  </span>
                </div>
                {isGraphRagOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              </button>

              {isGraphRagOpen && (
                <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1.5 bg-white dark:bg-slate-900">
                  <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[10px]">
                    {qaResult.exploration?.explored_triples?.map((t, idx) => (
                      <div key={idx} className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
                        <span className="text-blue-700 dark:text-blue-400 font-semibold">{t.subject}</span>
                        <span className="text-slate-400 font-sans">--[{t.predicate}]--&gt;</span>
                        <span className="text-purple-700 dark:text-purple-400 font-semibold">{t.object}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Query Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5">
        <div className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pergunte sobre equipamentos, módulos ou conexões..."
            disabled={isLoading}
            className="w-full pl-3 pr-10 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-2xs"
          />
          <button
            type="submit"
            disabled={!question.trim() || isLoading}
            className="absolute right-1.5 p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            title="Enviar Pergunta"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
};

