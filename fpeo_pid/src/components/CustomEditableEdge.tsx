'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
  getStraightPath,
  getBezierPath,
  useReactFlow,
  useViewport,
  Position,
} from '@xyflow/react';
import { Settings, RefreshCw, Trash2, Route, Palette, Sparkles } from 'lucide-react';
import { useOntology } from '@/context/OntologyContext';

export interface Waypoint {
  id: string;
  x: number;
  y: number;
}

type RoutingType = 'smoothstep' | 'step' | 'straight' | 'bezier';
type LineStyleType = 'dashed' | 'dotted' | 'solid';

export function CustomEditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  data,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow();
  const { zoom } = useViewport();
  const { graph, setGraphAndFiles } = useOntology();

  const waypoints = (data?.waypoints as Waypoint[]) || [];
  const routing = ((data?.routing as RoutingType) || 'smoothstep') as RoutingType;
  const lineStyle = ((data?.lineStyle as LineStyleType) ||
    (style.strokeDasharray === '8 4'
      ? 'dashed'
      : style.strokeDasharray === '6 6' || style.strokeDasharray === '3 3'
      ? 'dotted'
      : 'solid')) as LineStyleType;
  const customColor = (data?.customColor as string) || (style.stroke as string) || '#06b6d4';

  const [activeDraggingWpId, setActiveDraggingWpId] = useState<string | null>(null);
  const [selectedWpId, setSelectedWpId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Calculate default path and center label position based on selected routing mode
  const [defaultPath, defaultLabelX, defaultLabelY] = React.useMemo(() => {
    switch (routing) {
      case 'step':
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 0,
        });
      case 'straight':
        return getStraightPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
        });
      case 'bezier':
        return getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        });
      case 'smoothstep':
      default:
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 16,
        });
    }
  }, [routing, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  // Build multi-segment path if waypoints exist, otherwise default path
  const edgePath = React.useMemo(() => {
    if (waypoints.length === 0) {
      return defaultPath;
    }

    const points = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
    let fullPath = '';

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const [segmentPath] = getSmoothStepPath({
        sourceX: p1.x,
        sourceY: p1.y,
        sourcePosition: i === 0 ? sourcePosition : Position.Right,
        targetX: p2.x,
        targetY: p2.y,
        targetPosition: i === points.length - 2 ? targetPosition : Position.Left,
        borderRadius: routing === 'step' ? 0 : 12,
      });
      fullPath += (i === 0 ? '' : ' ') + segmentPath;
    }

    return fullPath;
  }, [waypoints, defaultPath, routing, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  // DOUBLE CLICK on line -> Create a Breakpoint!
  const handleEdgeDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const canvasPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newWaypoint: Waypoint = {
        id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        x: Math.round(canvasPos.x),
        y: Math.round(canvasPos.y),
      };

      setEdges(prevEdges =>
        prevEdges.map(edge => {
          if (edge.id === id) {
            const currentWps = (edge.data?.waypoints as Waypoint[]) || [];
            return {
              ...edge,
              data: {
                ...edge.data,
                waypoints: [...currentWps, newWaypoint],
              },
            };
          }
          return edge;
        })
      );
    },
    [id, screenToFlowPosition, setEdges]
  );

  // SINGLE CLICK & DRAG on line -> Move line segment or grab nearest breakpoint
  const handleEdgeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Left click only
      e.stopPropagation();

      const canvasPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const roundX = Math.round(canvasPos.x);
      const roundY = Math.round(canvasPos.y);

      // Check if near an existing waypoint
      const existingWp = waypoints.find(
        w => Math.hypot(w.x - roundX, w.y - roundY) < 30
      );

      let targetWpId: string;
      let initX = roundX;
      let initY = roundY;

      if (existingWp) {
        targetWpId = existingWp.id;
        initX = existingWp.x;
        initY = existingWp.y;
      } else {
        // Create new waypoint for dragging
        const newWaypoint: Waypoint = {
          id: `wp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          x: roundX,
          y: roundY,
        };
        targetWpId = newWaypoint.id;

        setEdges(prevEdges =>
          prevEdges.map(edge => {
            if (edge.id === id) {
              const currentWps = (edge.data?.waypoints as Waypoint[]) || [];
              return {
                ...edge,
                data: {
                  ...edge.data,
                  waypoints: [...currentWps, newWaypoint],
                },
              };
            }
            return edge;
          })
        );
      }

      setActiveDraggingWpId(targetWpId);
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: initX,
        initialY: initY,
      };
    },
    [id, waypoints, screenToFlowPosition, setEdges]
  );

  // SINGLE CLICK on Breakpoint Handle -> Open Menu Popup!
  const handleWaypointClick = useCallback(
    (e: React.MouseEvent, wp: Waypoint) => {
      e.stopPropagation();
      setSelectedWpId(wp.id);
      setMenuPosition({ x: wp.x, y: wp.y });
    },
    []
  );

  // DOUBLE CLICK on Breakpoint Handle -> Remove Waypoint!
  const handleWaypointDoubleClick = useCallback(
    (e: React.MouseEvent, wpId: string) => {
      e.stopPropagation();
      setEdges(prevEdges =>
        prevEdges.map(edge => {
          if (edge.id === id) {
            const currentWps = (edge.data?.waypoints as Waypoint[]) || [];
            return {
              ...edge,
              data: {
                ...edge.data,
                waypoints: currentWps.filter(w => w.id !== wpId),
              },
            };
          }
          return edge;
        })
      );
      setMenuPosition(null);
    },
    [id, setEdges]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDraggingWpId) return;
      const dx = (e.clientX - dragStartRef.current.startX) / (zoom || 1);
      const dy = (e.clientY - dragStartRef.current.startY) / (zoom || 1);

      const newX = Math.round(dragStartRef.current.initialX + dx);
      const newY = Math.round(dragStartRef.current.initialY + dy);

      setEdges(prevEdges =>
        prevEdges.map(edge => {
          if (edge.id === id) {
            const currentWps = (edge.data?.waypoints as Waypoint[]) || [];
            return {
              ...edge,
              data: {
                ...edge.data,
                waypoints: currentWps.map(w => (w.id === activeDraggingWpId ? { ...w, x: newX, y: newY } : w)),
              },
            };
          }
          return edge;
        })
      );
    };

    const handleMouseUp = () => {
      setActiveDraggingWpId(null);
    };

    if (activeDraggingWpId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDraggingWpId, zoom, id, setEdges]);

  // Context / Configuration Menu Update Helpers
  const updateEdgeData = (updates: Partial<{ routing: RoutingType; lineStyle: LineStyleType; customColor: string; waypoints: Waypoint[] }>) => {
    setEdges(prevEdges =>
      prevEdges.map(edge => {
        if (edge.id === id) {
          const nextStyle = { ...edge.style };
          if (updates.customColor) nextStyle.stroke = updates.customColor;
          if (updates.lineStyle !== undefined) {
            if (updates.lineStyle === 'dashed') nextStyle.strokeDasharray = '8 4';
            else if (updates.lineStyle === 'dotted') nextStyle.strokeDasharray = '3 3';
            else nextStyle.strokeDasharray = undefined;
          }

          return {
            ...edge,
            style: nextStyle,
            data: {
              ...edge.data,
              ...updates,
            },
          };
        }
        return edge;
      })
    );
  };

  const handleRemoveCurrentWaypoint = () => {
    if (selectedWpId) {
      const updatedWps = waypoints.filter(w => w.id !== selectedWpId);
      updateEdgeData({ waypoints: updatedWps });
      setSelectedWpId(null);
      setMenuPosition(null);
    }
  };

  const handleClearAllWaypoints = () => {
    updateEdgeData({ waypoints: [] });
    setSelectedWpId(null);
    setMenuPosition(null);
  };

  const handleDeleteConnection = () => {
    if (graph) {
      const updatedConnections = graph.connections.filter(c => c.id !== id);
      setGraphAndFiles({ ...graph, connections: updatedConnections }, []);
    } else {
      setEdges(prev => prev.filter(e => e.id !== id));
    }
    setMenuPosition(null);
  };

  const computedDasharray =
    lineStyle === 'dashed' ? '8 4' : lineStyle === 'dotted' ? '3 3' : undefined;

  const edgeStyle = {
    ...style,
    stroke: customColor,
    strokeDasharray: computedDasharray,
  };

  return (
    <>
      {/* Hitbox path for Left-Click Drag and Double-Click Breakpoint creation */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(255, 255, 255, 0.001)"
        strokeWidth={24}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onMouseDown={handleEdgeMouseDown}
        onDoubleClick={handleEdgeDoubleClick}
      />

      {/* Visible SVG Edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
        onDoubleClick={handleEdgeDoubleClick}
      />

      <EdgeLabelRenderer>
        {/* Render Breakpoint Handles */}
        {waypoints.map((wp, idx) => (
          <div
            key={wp.id}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${wp.x}px,${wp.y}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan group z-40"
          >
            <div
              onMouseDown={e => {
                if (e.button === 0) {
                  setActiveDraggingWpId(wp.id);
                  dragStartRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    initialX: wp.x,
                    initialY: wp.y,
                  };
                }
              }}
              onClick={e => handleWaypointClick(e, wp)}
              onDoubleClick={e => handleWaypointDoubleClick(e, wp.id)}
              title="1 Clique: Abrir Menu | Clique e Arraste: Mover | Duplo Clique: Remover"
              className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center shadow-md ${
                activeDraggingWpId === wp.id
                  ? 'bg-blue-600 border-white scale-125 ring-4 ring-blue-400/50'
                  : selectedWpId === wp.id || (menuPosition && menuPosition.x === wp.x && menuPosition.y === wp.y)
                  ? 'bg-purple-600 border-white scale-125 ring-2 ring-purple-400/50'
                  : 'bg-white border-blue-600 hover:bg-blue-500 hover:border-white hover:scale-125'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            </div>
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-white text-blue-700 text-[8px] font-mono px-1 rounded border border-slate-300 pointer-events-none transition-opacity shadow-xs">
              Ponto #{idx + 1}
            </span>
          </div>
        ))}

        {/* Edge Label Badge */}
        {label && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${defaultLabelX}px,${defaultLabelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan flex items-center justify-center gap-1 z-40"
          >
            <div
              onClick={e => {
                e.stopPropagation();
                setSelectedWpId(null);
                setMenuPosition({ x: defaultLabelX, y: defaultLabelY });
              }}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-sm text-slate-800 dark:text-slate-100 whitespace-nowrap select-none cursor-pointer hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
            >
              {label}
            </div>
          </div>
        )}

        {/* Elegant Configuration Menu Popup */}
        {menuPosition && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, 12px) translate(${menuPosition.x}px,${menuPosition.y}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan w-64 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl p-2.5 z-50 text-xs select-none space-y-2 text-slate-800 dark:text-slate-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 px-1">
              <span className="font-bold text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Configurar Conexão
              </span>
              <button
                onClick={() => setMenuPosition(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-mono"
              >
                ✕
              </button>
            </div>

            {/* Roteamento da Linha */}
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Route className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>Roteamento da Linha</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    { id: 'smoothstep', label: 'Suave 90°' },
                    { id: 'step', label: 'Esquadro 90°' },
                    { id: 'straight', label: 'Linha Reta' },
                    { id: 'bezier', label: 'Curva Bezier' },
                  ] as const
                ).map(item => (
                  <button
                    key={item.id}
                    onClick={() => updateEdgeData({ routing: item.id })}
                    className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all text-left ${
                      routing === item.id
                        ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 text-blue-800 dark:text-blue-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estilo da Linha */}
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Settings className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span>Estilo da Linha</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'solid', label: 'Contínua' },
                    { id: 'dashed', label: 'Tracejada' },
                    { id: 'dotted', label: 'Pontilhada' },
                  ] as const
                ).map(item => (
                  <button
                    key={item.id}
                    onClick={() => updateEdgeData({ lineStyle: item.id })}
                    className={`px-1.5 py-1 rounded text-[10px] font-semibold border transition-all text-center ${
                      lineStyle === item.id
                        ? 'bg-purple-50 dark:bg-purple-950/80 border-purple-500 text-purple-800 dark:text-purple-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor da Tubulação */}
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Palette className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Cor da Conexão</span>
              </div>
              <div className="flex items-center gap-1.5 justify-between">
                {[
                  { color: '#0284c7', name: 'Gás/Fluido' },
                  { color: '#059669', name: 'Processo' },
                  { color: '#9333ea', name: 'Inter-Módulo' },
                  { color: '#d97706', name: 'Energia' },
                  { color: '#ea580c', name: 'Alta Pressão' },
                  { color: '#dc2626', name: 'Alerta' },
                ].map(item => (
                  <button
                    key={item.color}
                    onClick={() => updateEdgeData({ customColor: item.color })}
                    style={{ backgroundColor: item.color }}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${
                      customColor === item.color ? 'border-slate-900 dark:border-white scale-125 ring-2 ring-blue-400' : 'border-transparent hover:scale-110'
                    }`}
                    title={item.name}
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 flex-wrap">
              {selectedWpId && (
                <button
                  onClick={handleRemoveCurrentWaypoint}
                  className="flex-1 py-1 rounded bg-amber-50 dark:bg-amber-950/80 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>Remover Ponto</span>
                </button>
              )}

              {waypoints.length > 0 && (
                <button
                  onClick={handleClearAllWaypoints}
                  className="flex-1 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center justify-center gap-1"
                  title="Resetar todos os pontos de quebra"
                >
                  <RefreshCw className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>Limpar Pontos</span>
                </button>
              )}

              <button
                onClick={handleDeleteConnection}
                className="flex-1 py-1 rounded bg-red-50 dark:bg-red-950/80 hover:bg-red-100 dark:hover:bg-red-900 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-[10px] font-bold flex items-center justify-center gap-1"
                title="Remover esta Conexão"
              >
                <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
