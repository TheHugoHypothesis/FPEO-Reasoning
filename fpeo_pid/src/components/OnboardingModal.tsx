'use client';

import React, { useState } from 'react';
import { Sparkles, Cpu, ShieldCheck, Check, Key, Server, ArrowRight, Bot } from 'lucide-react';
import { AppSettings, LLMProvider } from '@/lib/types';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export function OnboardingModal({ isOpen, onClose, settings, onSaveSettings }: OnboardingModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>(settings.llmProvider || 'gemini');
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel || 'gemini-3.6-flash');
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel || 'gemma4:12b-it-qat');
  const [rememberChoice, setRememberChoice] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const updated: AppSettings = {
      ...settings,
      llmProvider: selectedProvider,
      geminiApiKey: geminiApiKey.trim(),
      geminiModel: geminiModel.trim(),
      ollamaUrl: ollamaUrl.trim(),
      ollamaModel: ollamaModel.trim(),
      hasCompletedOnboarding: rememberChoice,
    };
    onSaveSettings(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Configuração do Motor de Inteligência Artificial
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Escolha o provedor de inferência que será utilizado para auditoria e perguntas ontológicas (GraphRAG).
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Provider Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* 1. Google Gemini */}
            <button
              type="button"
              onClick={() => setSelectedProvider('gemini')}
              className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedProvider === 'gemini'
                  ? 'bg-blue-50/70 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/20 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {selectedProvider === 'gemini' && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-400">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Google Gemini</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Alta precisão em raciocínio SPARQL e síntese de ontologias via Google AI Studio.
                </p>
              </div>
              <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 mt-3 block">
                Recomendado
              </span>
            </button>

            {/* 2. Ollama Local */}
            <button
              type="button"
              onClick={() => setSelectedProvider('ollama')}
              className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedProvider === 'ollama'
                  ? 'bg-purple-50/70 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/20 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {selectedProvider === 'ollama' && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2 text-purple-700 dark:text-purple-400">
                  <Cpu className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Ollama Local</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Execução 100% offline e privada no seu computador com LLaMA, DeepSeek ou Qwen.
                </p>
              </div>
              <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 mt-3 block">
                Privacidade Total
              </span>
            </button>

            {/* 3. Sem LLM */}
            <button
              type="button"
              onClick={() => setSelectedProvider('none')}
              className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                selectedProvider === 'none'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {selectedProvider === 'none' && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2 text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Sem LLM</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Desativa os recursos generativos de LLM. Roda apenas a auditoria formal OWL DL do HermiT.
                </p>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-3 block">
                LLM Desativado
              </span>
            </button>
          </div>

          {/* Provider Specific Configuration Inputs */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3.5">
            {selectedProvider === 'gemini' && (
              <>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                  <Key className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Configuração Google AI Studio (Gemini)
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                    Chave de API Gemini:
                  </label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Cole sua chave AIzaSy..."
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs font-mono focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Obtenha sua chave gratuita em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline">aistudio.google.com</a>.
                  </p>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                    Modelo Alvo:
                  </label>
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500 shadow-2xs"
                  >
                    <option value="gemini-3.6-flash">gemini-3.6-flash (Mais rápido & recomendado)</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  </select>
                </div>
              </>
            )}

            {selectedProvider === 'ollama' && (
              <>
                <div className="flex items-center gap-2 text-xs font-bold text-purple-800 dark:text-purple-300">
                  <Server className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  Configuração Ollama Local
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                    Endpoint do Servidor Ollama:
                  </label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                    Nome do Modelo Instalado:
                  </label>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="llama3:latest ou deepseek-r1:latest"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-purple-500 shadow-2xs"
                  />
                </div>
              </>
            )}

            {selectedProvider === 'none' && (
              <div className="py-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Motor LLM Desabilitado</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Nenhuma chamada a provedores de LLM externos ou locais será efetuada. As respostas generativas de auditoria e o assistente GraphRAG permanecerão desabilitados até que um provedor seja configurado.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Remember Choice Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="remember_choice"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="remember_choice" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              Lembrar minha preferência (você poderá alterá-la a qualquer momento nas Configurações).
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">FPEO-PID Framework</span>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Confirmar e Iniciar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
