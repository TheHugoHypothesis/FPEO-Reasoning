'use client';

import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  BackgroundVariant,
  Connection,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FolderX, Maximize2, Minimize2, ArrowLeft, Cpu, Bot, Filter, Anchor, RotateCcw, Sparkles } from 'lucide-react';

import { EquipmentNode } from './EquipmentNode';
import { ComponentNode } from './ComponentNode';
import { ModuleGroupNode } from './ModuleGroupNode';
import { FPSOGroupNode } from './FPSOGroupNode';
import { CustomEditableEdge, Waypoint } from './CustomEditableEdge';
import { OntologyGraph, Equipment, OntologyClass } from '@/lib/types';
import { layoutGraphWithDagre, layoutComponentSubGraph } from '@/lib/layoutEngine';
import { useOntology } from '@/context/OntologyContext';

interface PIDCanvasProps {
  graph: OntologyGraph | null;
  selectedEquipment: Equipment | null;
  onSelectEquipment: (equipment: Equipment | null) => void;
  inconsistentEquipmentUris?: string[];
  onOpenCreateModal?: (classUri?: string) => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  isAuditPanelOpen?: boolean;
  onToggleAuditPanel?: () => void;
  isQAPanelOpen?: boolean;
  onToggleQAPanel?: () => void;
}

export function PIDCanvas({
  graph,
  selectedEquipment,
  onSelectEquipment,
  inconsistentEquipmentUris = [],
  onOpenCreateModal,
  onToggleFullscreen,
  isFullscreen: isFullscreenProp,
  isAuditPanelOpen,
  onToggleAuditPanel,
  isQAPanelOpen,
  onToggleQAPanel,
}: PIDCanvasProps) {
  const {
    addConnection,
    drilldownEquipment,
    setDrilldownEquipment,
    modules,
    activeModuleId,
    fpsos,
    setActiveFpsoId,
    setActiveModuleId,
    settings,
  } = useOntology();
  const isLight = settings.themeMode === 'light';
  const canvasRef = useRef<HTMLDivElement>(null);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const expandedDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  const persistedNodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : internalFullscreen;

  const nodeTypes = useMemo(() => ({
    equipmentNode: EquipmentNode,
    componentNode: ComponentNode,
    moduleGroupNode: ModuleGroupNode,
    fpsoGroupNode: FPSOGroupNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    customEditableEdge: CustomEditableEdge,
  }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Toggle Fullscreen mode
  const handleToggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      if (!document.fullscreenElement) {
        canvasRef.current?.requestFullscreen();
        setInternalFullscreen(true);
      } else {
        document.exitFullscreen();
        setInternalFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setInternalFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const rotateEquipmentNode = useCallback(
    (targetNodeId: string, newAngle: number) => {
      setNodes(prevNodes => {
        const targetNode = prevNodes.find(n => n.id === targetNodeId);
        if (!targetNode) return prevNodes;

        const oldAngle = (targetNode.data?.rotation as number) || 0;
        let deltaAngle = newAngle - oldAngle;
        while (deltaAngle > 180) deltaAngle -= 360;
        while (deltaAngle < -180) deltaAngle += 360;
        if (deltaAngle === 0) return prevNodes;

        // Calculate node center for rotation transformation
        const width = (targetNode.measured?.width as number) || (targetNode.width as number) || 280;
        const height = (targetNode.measured?.height as number) || (targetNode.height as number) || 160;
        const cx = targetNode.position.x + width / 2;
        const cy = targetNode.position.y + height / 2;
        const rad = (deltaAngle * Math.PI) / 180;

        // Rotate connected edge waypoints jointly with the equipment node
        setEdges(prevEdges =>
          prevEdges.map(edge => {
            if (edge.source === targetNodeId || edge.target === targetNodeId) {
              const currentWps = (edge.data?.waypoints as Waypoint[]) || [];
              if (currentWps.length === 0) return edge;

              const rotatedWps = currentWps.map(wp => {
                const dx = wp.x - cx;
                const dy = wp.y - cy;
                const rx = Math.round(cx + dx * Math.cos(rad) - dy * Math.sin(rad));
                const ry = Math.round(cy + dx * Math.sin(rad) + dy * Math.cos(rad));
                return { ...wp, x: rx, y: ry };
              });

              return {
                ...edge,
                data: {
                  ...edge.data,
                  waypoints: rotatedWps,
                },
              };
            }
            return edge;
          })
        );

        return prevNodes.map(node =>
          node.id === targetNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  rotation: newAngle,
                  onRotate: rotateEquipmentNode,
                },
              }
            : node
        );
      });
    },
    [setNodes, setEdges]
  );

  // Layout graph when graph, drilldown, or inconsistencies update
  useEffect(() => {
    if (!graph || graph.equipments.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // LEVEL 2: Component Specification Sub-graph View
    if (drilldownEquipment) {
      const activeEqInGraph = graph.equipments.find(e => e.uri === drilldownEquipment.uri) || drilldownEquipment;
      const { nodes: subNodes, edges: subEdges } = layoutComponentSubGraph(activeEqInGraph);
      setNodes(subNodes);
      setEdges(subEdges);
      return;
    }

    // LEVEL 1: Main Top-Level Equipment View
    const updatedGraph: OntologyGraph = {
      ...graph,
      equipments: graph.equipments.map(eq => {
        const isError = inconsistentEquipmentUris.includes(eq.uri);
        return {
          ...eq,
          hasError: isError,
          errorMessage: isError
            ? 'Incompatibilidade física/lógica detectada no raciocinador HermiT'
            : undefined,
        };
      }),
    };

    const { nodes: layoutedNodes, edges: layoutedEdges } = layoutGraphWithDagre(
      updatedGraph,
      'LR',
      updatedGraph.modules || modules,
      updatedGraph.fpsos || fpsos
    );
    setNodes(prevNodes => {
      const prevRotationMap = new Map<string, number>();
      const prevPosMap = new Map<string, { x: number; y: number }>();
      const prevStyleMap = new Map<string, any>();

      prevNodes.forEach(n => {
        if (n.data?.rotation !== undefined) {
          prevRotationMap.set(n.id, n.data.rotation as number);
        }
        if (n.position) {
          prevPosMap.set(n.id, n.position);
        }
        if (n.style) {
          prevStyleMap.set(n.id, n.style);
        }

        // Save expanded dimensions ONLY when the node is NOT collapsed
        if (!n.data?.isCollapsed) {
          let w = n.width;
          let h = n.height;
          if (!w && n.style?.width) {
            w = typeof n.style.width === 'number' ? n.style.width : parseFloat(String(n.style.width));
          }
          if (!h && n.style?.height) {
            h = typeof n.style.height === 'number' ? n.style.height : parseFloat(String(n.style.height));
          }
          if (w && h && !isNaN(w) && !isNaN(h)) {
            expandedDimensionsRef.current.set(n.id, { width: w, height: h });
          }
        }
      });

      return layoutedNodes.map(node => {
        const existingRot = prevRotationMap.get(node.id);
        const existingPos = prevPosMap.get(node.id);
        const existingStyle = prevStyleMap.get(node.id);

        const isCollapsed = collapsedNodeIds.has(node.id);

        // Check if any ancestor module or FPSO is collapsed
        let isNodeHidden = false;
        if (node.type === 'equipmentNode') {
          const eq = node.data?.equipment as Equipment | undefined;
          const modCode = eq?.moduleCode;
          if (modCode && collapsedNodeIds.has(`group_${modCode}`)) {
            isNodeHidden = true;
          }
          const matchedMod = modules.find(m => m.code === modCode || m.id === modCode);
          const fpsoCode = eq?.fpsoId || matchedMod?.fpsoCode || matchedMod?.fpsoId;
          if (
            fpsoCode &&
            (collapsedNodeIds.has(`fpso_${fpsoCode}`) ||
              (matchedMod?.fpsoCode && collapsedNodeIds.has(`fpso_${matchedMod.fpsoCode}`)))
          ) {
            isNodeHidden = true;
          }
        } else if (node.type === 'moduleGroupNode') {
          const modCode = node.data?.code;
          const matchedMod = modules.find(m => m.code === modCode || m.id === modCode);
          const fpsoCode = matchedMod?.fpsoCode || matchedMod?.fpsoId;
          if (
            fpsoCode &&
            (collapsedNodeIds.has(`fpso_${fpsoCode}`) ||
              (matchedMod?.fpsoCode && collapsedNodeIds.has(`fpso_${matchedMod.fpsoCode}`)))
          ) {
            isNodeHidden = true;
          }
        }

        // Get stored expanded size or fall back to dagre node size / defaults
        const savedExpanded = expandedDimensionsRef.current.get(node.id);
        const initialWidth = node.width || (node.type === 'fpsoGroupNode' ? 800 : node.type === 'moduleGroupNode' ? 500 : undefined);
        const initialHeight = node.height || (node.type === 'fpsoGroupNode' ? 600 : node.type === 'moduleGroupNode' ? 400 : undefined);

        const expandedWidth = savedExpanded?.width || initialWidth;
        const expandedHeight = savedExpanded?.height || initialHeight;

        // Remember initial dagre expanded size in expandedDimensionsRef
        if (!savedExpanded && expandedWidth && expandedHeight) {
          expandedDimensionsRef.current.set(node.id, { width: expandedWidth, height: expandedHeight });
        }

        let width = expandedWidth;
        let height = expandedHeight;

        if (node.type === 'fpsoGroupNode') {
          if (isCollapsed) {
            width = 380;
            height = 76;
          }
        } else if (node.type === 'moduleGroupNode') {
          if (isCollapsed) {
            width = 320;
            height = 64;
          }
        }

        const persistedPos = persistedNodePositionsRef.current.get(node.id);
        const position = existingPos || persistedPos || node.position;
        persistedNodePositionsRef.current.set(node.id, position);

        return {
          ...node,
          hidden: isNodeHidden,
          position,
          style: {
            ...node.style,
            ...(existingStyle || {}),
            width,
            height,
          },
          width,
          height,
          data: {
            ...node.data,
            id: node.id,
            isCollapsed,
            onToggleCollapse: handleToggleCollapse,
            rotation: existingRot !== undefined ? existingRot : 0,
            onRotate: rotateEquipmentNode,
          },
        };
      });
    });

    setEdges(prevEdges => {
      const prevEdgeDataMap = new Map<string, any>();
      prevEdges.forEach(e => {
        if (e.data) {
          prevEdgeDataMap.set(e.id, e.data);
        }
      });

      return layoutedEdges.map(edge => {
        const existingData = prevEdgeDataMap.get(edge.id);
        if (existingData) {
          return {
            ...edge,
            data: {
              ...edge.data,
              ...existingData,
            },
          };
        }
        return edge;
      });
    });
  }, [graph, drilldownEquipment, inconsistentEquipmentUris, modules, fpsos, collapsedNodeIds, handleToggleCollapse, setNodes, setEdges, rotateEquipmentNode]);

  // Keyboard listener for node rotation via arrow keys (Up, Down, Left, Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
        return;
      }

      let targetAngle: number | null = null;
      if (e.key === 'ArrowRight') targetAngle = 0;
      else if (e.key === 'ArrowDown') targetAngle = 90;
      else if (e.key === 'ArrowLeft') targetAngle = 180;
      else if (e.key === 'ArrowUp') targetAngle = 270;

      if (targetAngle !== null) {
        setNodes(prevNodes => {
          const selectedEq = prevNodes.find(n => n.selected && n.type === 'equipmentNode');
          if (selectedEq) {
            e.preventDefault();
            rotateEquipmentNode(selectedEq.id, targetAngle);
          }
          return prevNodes;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setNodes, rotateEquipmentNode]);

  // Handle single click node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!graph) return;
      const eq = graph.equipments.find(e => e.uri === node.id);
      onSelectEquipment(eq || null);
    },
    [graph, onSelectEquipment]
  );

  // Handle double click node to drilldown into FPSO, Module, or Equipment view!
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'fpsoGroupNode') {
        const fpsoId = node.data?.id as string;
        if (fpsoId) {
          setActiveFpsoId(fpsoId);
          setActiveModuleId('ALL');
        }
        return;
      }
      if (node.type === 'moduleGroupNode') {
        const modCode = node.data?.code as string;
        if (modCode && modCode !== 'GERAL') {
          setActiveModuleId(modCode);
        }
        return;
      }
      if (!graph) return;
      const eq = graph.equipments.find(e => e.uri === node.id);
      if (eq) {
        onSelectEquipment(eq);
        setDrilldownEquipment(eq);
      }
    },
    [graph, onSelectEquipment, setDrilldownEquipment, setActiveFpsoId, setActiveModuleId]
  );

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    if (node.position) {
      persistedNodePositionsRef.current.set(node.id, node.position);
    }
  }, []);

  const handleResetLayout = useCallback(() => {
    persistedNodePositionsRef.current.clear();
    if (!graph || graph.equipments.length === 0) return;
    const updatedGraph: OntologyGraph = {
      ...graph,
      equipments: graph.equipments.map(eq => {
        const isError = (inconsistentEquipmentUris || []).includes(eq.uri);
        return {
          ...eq,
          hasError: isError,
          errorMessage: isError
            ? 'Incompatibilidade física/lógica detectada no raciocinador HermiT'
            : undefined,
        };
      }),
    };
    const { nodes: freshNodes, edges: freshEdges } = layoutGraphWithDagre(
      updatedGraph,
      'LR',
      updatedGraph.modules || modules,
      updatedGraph.fpsos || fpsos
    );
    freshNodes.forEach(n => {
      persistedNodePositionsRef.current.set(n.id, n.position);
    });
    setNodes(freshNodes);
    setEdges(freshEdges);
  }, [graph, inconsistentEquipmentUris, modules, fpsos, setNodes, setEdges]);

  const onPaneClick = useCallback(() => {
    onSelectEquipment(null);
  }, [onSelectEquipment]);

  // Drag-and-Drop support
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const rawClassData = event.dataTransfer.getData('application/json');
      if (!rawClassData) return;

      try {
        const owlClass: OntologyClass = JSON.parse(rawClassData);
        if (onOpenCreateModal) {
          onOpenCreateModal(owlClass.uri);
        }
      } catch (err) {
        console.error('Error parsing dropped OWL class data:', err);
      }
    },
    [onOpenCreateModal]
  );

  // Connecting ports on canvas
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      const srcPortUri = params.sourceHandle || `${params.source}_out`;
      const tgtPortUri = params.targetHandle || `${params.target}_in`;
      addConnection(params.source, srcPortUri, params.target, tgtPortUri);
    },
    [addConnection]
  );

  if (!graph) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-600 p-8 border-l border-t border-slate-200 select-none">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 mb-4 shadow-sm flex items-center justify-center">
          <FolderX className="w-12 h-12 text-slate-400" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800 mb-2 tracking-tight">Não há cenários carregados</h2>
        <p className="text-xs text-slate-500 max-w-md text-center leading-relaxed mb-6">
          Todos os cenários foram fechados. Adicione um novo cenário utilizando o botão <span className="text-blue-600 font-semibold">+ Carregar Arquivo TTL</span> acima.
        </p>
      </div>
    );
  }

  if (graph.equipments.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 p-8 border-l border-t border-slate-200 dark:border-slate-800 select-none">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-4 shadow-sm flex items-center justify-center">
          <Filter className="w-12 h-12 text-blue-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">Nenhum equipamento neste filtro</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md text-center leading-relaxed mb-6">
          Não há equipamentos associados a este filtro no grafo RDF ativo.
        </p>
        <button
          type="button"
          onClick={() => {
            setActiveFpsoId('ALL');
            setActiveModuleId('ALL');
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
        >
          <Anchor className="w-4 h-4 text-blue-200" />
          <span>Exibir Frota Completa</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={canvasRef} className="w-full h-full relative overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Unified Top-Right Floating Controls Bar */}
      <div className="absolute top-3 right-3 z-40 flex items-center gap-2 select-none">
        {!isAuditPanelOpen && onToggleAuditPanel && (
          <button
            onClick={onToggleAuditPanel}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-purple-700 dark:text-purple-300 shadow-md transition-all flex items-center gap-2 text-xs font-bold"
            title="Mostrar Painel de Auditoria Semântica"
          >
            <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Mostrar Auditoria</span>
          </button>
        )}

        {!isQAPanelOpen && onToggleQAPanel && (
          <button
            onClick={onToggleQAPanel}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 border border-blue-300 dark:border-slate-700 text-blue-700 dark:text-blue-300 shadow-md transition-all flex items-center gap-2 text-xs font-bold"
            title="Abrir Assistente de Perguntas GraphRAG"
          >
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>GraphRAG Q&A</span>
          </button>
        )}

        <button
          onClick={handleResetLayout}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 shadow-md transition-all flex items-center gap-1.5 text-xs font-bold"
          title="Reorganizar e Auto-Alinhar todos os Módulos e Equipamentos"
        >
          <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Auto-Alinhar</span>
        </button>

        <button
          onClick={handleToggleFullscreen}
          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 shadow-md transition-all flex items-center gap-1.5 text-xs font-bold"
          title={isFullscreen ? 'Sair da Tela Cheia' : 'Modo Tela Cheia (Fullscreen)'}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Sair Tela Cheia</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Tela Cheia</span>
            </>
          )}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ animated: true }}
        className="bg-slate-100 dark:bg-slate-950"
      >
        <CanvasCenterHelper
          activeModuleId={activeModuleId}
          graphCount={graph?.equipments.length}
          drilldownUri={drilldownEquipment?.uri}
          nodeCount={nodes.length}
        />
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color={isLight ? '#94a3b8' : '#334155'} bgColor={isLight ? '#f1f5f9' : '#020617'} />
        <Controls className="!bg-white dark:!bg-slate-900 !border-slate-300 dark:!border-slate-700 !text-slate-700 dark:!text-slate-200 shadow-md rounded-lg overflow-hidden" />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'componentNode') return '#9333ea';
            if (node.data?.hasError) return '#dc2626';
            return isLight ? '#0284c7' : '#38bdf8';
          }}
          className="!bg-white dark:!bg-slate-900 !border-slate-300 dark:!border-slate-700 shadow-md rounded-xl overflow-hidden opacity-85 hover:opacity-100 transition-all duration-200"
          maskColor={isLight ? 'rgba(241, 245, 249, 0.75)' : 'rgba(2, 6, 23, 0.75)'}
          zoomable
          pannable
          style={{ width: 120, height: 80 }}
        />
      </ReactFlow>
    </div>
  );
}

function CanvasCenterHelper({
  activeModuleId,
  graphCount,
  drilldownUri,
  nodeCount,
}: {
  activeModuleId?: string;
  graphCount?: number;
  drilldownUri?: string;
  nodeCount?: number;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!graphCount || graphCount === 0 || !nodeCount || nodeCount === 0) return;

    const timer = setTimeout(() => {
      fitView({ padding: 0.25, duration: 450 });
    }, 80);

    return () => clearTimeout(timer);
  }, [activeModuleId, graphCount, drilldownUri, nodeCount, fitView]);

  return null;
}
