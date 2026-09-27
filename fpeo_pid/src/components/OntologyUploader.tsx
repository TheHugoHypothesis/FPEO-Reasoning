'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { parseTurtleContent } from '@/lib/rdfParser';
import { OntologyGraph } from '@/lib/types';

interface OntologyUploaderProps {
  onGraphLoaded: (graph: OntologyGraph, rawFiles: { name: string; content: string }[]) => void;
  isLoading?: boolean;
}

export function OntologyUploader({ onGraphLoaded, isLoading = false }: OntologyUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: File[]) => {
    setErrorMsg(null);
    const ttlFiles = files.filter(f => f.name.endsWith('.ttl') || f.name.endsWith('.owl') || f.name.endsWith('.xml'));

    if (ttlFiles.length === 0) {
      setErrorMsg('Por favor selecione apenas arquivos com extensão .ttl ou .owl');
      return;
    }

    try {
      const filePromises = ttlFiles.map(file => {
        return new Promise<{ name: string; content: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, content: e.target?.result as string || '' });
          reader.onerror = reject;
          reader.readAsText(file);
        });
      });

      const readFiles = await Promise.all(filePromises);
      const updatedList = [...loadedFiles, ...readFiles];
      setLoadedFiles(updatedList);

      const contents = updatedList.map(f => f.content);
      const names = updatedList.map(f => f.name);
      const graph = await parseTurtleContent(contents, names);

      onGraphLoaded(graph, updatedList);
    } catch (err: unknown) {
      console.error('Error parsing files:', err);
      setErrorMsg('Erro ao ler ou processar arquivo de ontologia.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFiles(Array.from(e.target.files));
    }
  };

  const removeFile = async (index: number) => {
    const newList = loadedFiles.filter((_, i) => i !== index);
    setLoadedFiles(newList);
    if (newList.length > 0) {
      const graph = await parseTurtleContent(newList.map(f => f.content), newList.map(f => f.name));
      onGraphLoaded(graph, newList);
    } else {
      onGraphLoaded({ equipments: [], connections: [], availableClasses: [], rawTriplesCount: 0, filesLoaded: [] }, []);
    }
  };

  const clearAllFiles = () => {
    setLoadedFiles([]);
    setErrorMsg(null);
    onGraphLoaded({ equipments: [], connections: [], availableClasses: [], rawTriplesCount: 0, filesLoaded: [] }, []);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 shadow-xs text-slate-800 dark:text-slate-100">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".ttl,.owl,.xml"
          onChange={handleChange}
          className="hidden"
        />

        {/* Drag & Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 w-full flex items-center justify-between px-4 py-2.5 rounded-lg border-2 border-dashed transition-all cursor-pointer ${
            dragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <Upload className={`w-5 h-5 ${dragActive ? 'text-blue-600 animate-bounce' : 'text-blue-600 dark:text-blue-400'}`} />
            <div className="text-xs">
              <span className="font-bold text-blue-700 dark:text-blue-400">Clique para carregar ou trocar</span> ou arraste arquivos de ontologia <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">(.ttl / .owl)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="px-3 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Trocar Arquivo</span>
          </button>
        </div>

        {/* Loaded Files Bar */}
        {loadedFiles.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-xl py-1">
            {loadedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs shadow-2xs whitespace-nowrap font-medium"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="font-mono text-[11px] max-w-[140px] truncate text-slate-900 dark:text-slate-100 font-semibold">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  title="Remover este arquivo"
                  className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded p-0.5 text-slate-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            <button
              onClick={clearAllFiles}
              title="Limpar todos os arquivos carregados"
              className="px-2.5 py-1 rounded bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center gap-1 font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 p-2 rounded max-w-7xl mx-auto shadow-2xs font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
