'use client';

import React, { useState } from 'react';
import { X, Settings, Server, Cpu, Sparkles, ShieldCheck, Check, RefreshCw, Sun, Moon, Key } from 'lucide-react';
import { AppSettings, LLMProvider } from '@/lib/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSaveSettings }: SettingsModalProps) {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  const testOllamaConnection = async () => {
    setTestStatus('testando...');
    try {
      const res = await fetch(`${formData.ollamaUrl}/api/tags`);
      if (res.ok) {
        setTestStatus('Conectado com sucesso ao Ollama');
      } else {
        setTestStatus('Resposta de erro do Ollama');
      }
    } catch {
      setTestStatus('Erro de conexão com Ollama');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 font-bold">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Configurações do Sistema FPEO</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
          {/* LLM Provider Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Provedor de Inteligência Artificial / LLM
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, llmProvider: 'gemini' })}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                  formData.llmProvider === 'gemini'
                    ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Google Gemini</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, llmProvider: 'ollama' })}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                  formData.llmProvider === 'ollama'
                    ? 'bg-purple-50 dark:bg-purple-950/80 border-purple-500 text-purple-800 dark:text-purple-300 ring-2 ring-purple-500/20 shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Ollama Local</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, llmProvider: 'none' })}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                  formData.llmProvider === 'none'
                    ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Sem LLM</span>
              </button>
            </div>
          </div>

          {/* Provider Details Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
            {formData.llmProvider === 'gemini' && (
              <>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                  <Key className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Credenciais Google AI Studio (Gemini)
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                    Chave de API Gemini:
                  </label>
                  <input
                    type="password"
                    value={formData.geminiApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                    placeholder="Cole sua chave AIzaSy..."
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs font-mono focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                    Modelo Gemini:
                  </label>
                  <select
                    value={formData.geminiModel || 'gemini-3.6-flash'}
                    onChange={(e) => setFormData({ ...formData, geminiModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500 shadow-2xs"
                  >
                    <option value="gemini-3.6-flash">gemini-3.6-flash (Padrão & Mais Rápido)</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  </select>
                </div>
              </>
            )}

            {formData.llmProvider === 'ollama' && (
              <>
                <div className="flex justify-between items-center text-xs font-bold text-purple-800 dark:text-purple-300">
                  <span className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    Servidor Ollama Local
                  </span>
                  <button
                    type="button"
                    onClick={testOllamaConnection}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <RefreshCw className="w-3 h-3" /> Testar Conexão
                  </button>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                    Endpoint URL:
                  </label>
                  <input
                    type="text"
                    value={formData.ollamaUrl || 'http://localhost:11434'}
                    onChange={(e) => setFormData({ ...formData, ollamaUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 shadow-2xs"
                  />
                  {testStatus && <p className="text-[11px] font-semibold mt-1 text-purple-700 dark:text-purple-300">{testStatus}</p>}
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                    Modelo Alvo:
                  </label>
                  <input
                    type="text"
                    value={formData.ollamaModel || 'gemma4:12b-it-qat'}
                    onChange={(e) => setFormData({ ...formData, ollamaModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 shadow-2xs"
                  />
                </div>
              </>
            )}

            {formData.llmProvider === 'none' && (
              <div className="py-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p>
                  Modo sem LLM ativo. As funcionalidades generativas (diagnósticos explicativos de inconsistências e assistente GraphRAG) permanecem desabilitadas. Apenas as regras formais e consistência OWL DL do HermiT são executadas.
                </p>
              </div>
            )}
          </div>

          {/* Backend FastAPI URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>URL do Serviço Raciocinador OWL (FastAPI Backend)</span>
            </label>
            <input
              type="text"
              value={formData.backendUrl}
              onChange={(e) => setFormData({ ...formData, backendUrl: e.target.value })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500 shadow-2xs"
              placeholder="http://localhost:8000"
            />
          </div>

          {/* Theme Mode Selection */}
          <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Tema Visual do Sistema</span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, themeMode: 'light' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-bold transition-all shadow-2xs ${
                  (formData.themeMode || 'light') === 'light'
                    ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Modo Claro</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, themeMode: 'dark' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-bold transition-all shadow-2xs ${
                  formData.themeMode === 'dark'
                    ? 'bg-slate-800 border-slate-600 text-slate-100 ring-2 ring-slate-400/20'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Moon className="w-4 h-4 text-slate-400" />
                <span>Modo Escuro</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Configurações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
