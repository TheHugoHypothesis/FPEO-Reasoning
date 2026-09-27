import dagre from '@dagrejs/dagre';
import { Node, Edge } from '@xyflow/react';
import { OntologyGraph, Equipment, FpsoModule, FpsoVessel, PortConnection } from './types';

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;

function createEquipmentNode(
  eq: Equipment,
  position: { x: number; y: number },
  parentId?: string
): Node {
  return {
    id: eq.uri,
    type: 'equipmentNode',
    ...(parentId ? { parentId, extent: 'parent' as const } : {}),
    position,
    zIndex: 10,
    data: {
      equipment: eq,
      label: eq.label,
      category: eq.category,
      classLabel: eq.classLabel,
      hasError: eq.hasError,
      errorMessage: eq.errorMessage,
    },
  };
}

function createGraphEdge(conn: PortConnection, equipments: Equipment[]): Edge {
  const srcEq = equipments.find(e => e.uri === conn.sourceEquipmentUri);
  const tgtEq = equipments.find(e => e.uri === conn.targetEquipmentUri);

  const isInterModule = !!(
    srcEq?.moduleCode &&
    tgtEq?.moduleCode &&
    srcEq.moduleCode !== tgtEq.moduleCode
  );
  const isPower = conn.connectionType === 'powersEquipment';
  const isFeed = conn.connectionType === 'feedsFluidToEquipment';

  let strokeColor = '#10b981';
  let strokeDasharray: string | undefined;

  if (isInterModule) {
    strokeColor = '#c084fc';
    strokeDasharray = '8 4';
  } else if (isPower) {
    strokeColor = '#eab308';
    strokeDasharray = '6 6';
  } else if (isFeed) {
    strokeColor = '#06b6d4';
  }

  const label = isInterModule
    ? `Inter-Mapeamento (${srcEq?.moduleCode} → ${tgtEq?.moduleCode})`
    : isPower
      ? 'Power'
      : undefined;

  return {
    id: conn.id,
    source: conn.sourceEquipmentUri,
    sourceHandle: conn.sourcePortUri,
    target: conn.targetEquipmentUri,
    targetHandle: conn.targetPortUri,
    type: 'customEditableEdge',
    animated: true,
    zIndex: 1,
    style: {
      stroke: strokeColor,
      strokeWidth: isInterModule ? 3.5 : 2.5,
      strokeDasharray,
    },
    label,
    labelStyle: {
      fill: isInterModule ? '#f0abfc' : '#94a3b8',
      fontSize: 10,
      fontWeight: 700,
    },
    labelBgStyle: {
      fill: isInterModule ? '#3b0764' : '#0f172a',
      fillOpacity: 0.9,
    },
  };
}

export function layoutGraphWithDagre(
  graph: OntologyGraph,
  direction: 'LR' | 'TB' = 'LR',
  modulesList?: FpsoModule[],
  fpsosList?: FpsoVessel[]
): { nodes: Node[]; edges: Edge[] } {
  if (!graph || graph.equipments.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Identify distinct modules present in the graph
  const moduleMap = new Map<string, Equipment[]>();
  graph.equipments.forEach(eq => {
    const modCode = eq.moduleCode || 'UNASSIGNED';
    if (!moduleMap.has(modCode)) {
      moduleMap.set(modCode, []);
    }
    moduleMap.get(modCode)!.push(eq);
  });

  interface CalculatedModuleCluster {
    modCode: string;
    isUnassigned: boolean;
    modEquipments: Equipment[];
    boxWidth: number;
    boxHeight: number;
    equipmentPositions: Map<string, { x: number; y: number }>;
  }

  const clusters: CalculatedModuleCluster[] = [];

  moduleMap.forEach((modEquipments, modCode) => {
    const isUnassigned = modCode === 'UNASSIGNED';

    const subDagre = new dagre.graphlib.Graph();
    subDagre.setDefaultEdgeLabel(() => ({}));
    subDagre.setGraph({
      rankdir: 'LR',
      nodesep: 80,
      ranksep: 140,
      marginx: 50,
      marginy: 60,
    });

    modEquipments.forEach(eq => {
      subDagre.setNode(eq.uri, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    let internalEdgeCount = 0;
    graph.connections.forEach(conn => {
      const hasSrc = modEquipments.some(e => e.uri === conn.sourceEquipmentUri);
      const hasTgt = modEquipments.some(e => e.uri === conn.targetEquipmentUri);
      if (hasSrc && hasTgt) {
        subDagre.setEdge(conn.sourceEquipmentUri, conn.targetEquipmentUri);
        internalEdgeCount++;
      }
    });

    dagre.layout(subDagre);

    const positions = new Map<string, { x: number; y: number }>();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    modEquipments.forEach((eq, eqIdx) => {
      const pos = subDagre.node(eq.uri);
      let posX: number;
      let posY: number;

      if (internalEdgeCount === 0 || !pos) {
        const col = eqIdx % 2;
        const row = Math.floor(eqIdx / 2);
        posX = col * 360;
        posY = row * 240;
      } else {
        posX = pos.x - NODE_WIDTH / 2;
        posY = pos.y - NODE_HEIGHT / 2;
      }

      positions.set(eq.uri, { x: posX, y: posY });

      if (posX < minX) minX = posX;
      if (posX + NODE_WIDTH > maxX) maxX = posX + NODE_WIDTH;
      if (posY < minY) minY = posY;
      if (posY + NODE_HEIGHT > maxY) maxY = posY + NODE_HEIGHT;
    });

    if (minX === Infinity) {
      minX = 0; maxX = 600; minY = 0; maxY = 350;
    }

    const paddingX = 50;
    const paddingY = 70;
    const boxWidth = Math.max(680, maxX - minX + paddingX * 2);
    const boxHeight = Math.max(420, maxY - minY + paddingY * 2);

    const normalizedPositions = new Map<string, { x: number; y: number }>();
    positions.forEach((pos, uri) => {
      normalizedPositions.set(uri, {
        x: pos.x - minX + paddingX,
        y: pos.y - minY + paddingY,
      });
    });

    clusters.push({
      modCode,
      isUnassigned,
      modEquipments,
      boxWidth,
      boxHeight,
      equipmentPositions: normalizedPositions,
    });
  });

  if (fpsosList && fpsosList.length > 0) {
    const fpsoNodes: Node[] = [];
    const groupNodes: Node[] = [];
    const equipmentNodes: Node[] = [];

    const fpsoMap = new Map<string, { fpso: FpsoVessel; clusters: CalculatedModuleCluster[] }>();

    fpsosList.forEach(fpso => {
      fpsoMap.set(fpso.id, { fpso, clusters: [] });
    });

    const unassignedClusters: CalculatedModuleCluster[] = [];

    clusters.forEach(cluster => {
      const matchedMod = modulesList?.find(
        m => m.code === cluster.modCode || m.id === cluster.modCode || m.uri === cluster.modCode
      );
      const targetFpso = fpsosList.find(
        f =>
          f.id === matchedMod?.fpsoId ||
          f.code === matchedMod?.fpsoCode ||
          f.code === matchedMod?.fpsoId ||
          f.id === matchedMod?.fpsoCode ||
          f.uri === matchedMod?.fpsoId ||
          f.id === cluster.modCode ||
          f.code === cluster.modCode
      );
      if (targetFpso && fpsoMap.has(targetFpso.id)) {
        fpsoMap.get(targetFpso.id)!.clusters.push(cluster);
      } else {
        unassignedClusters.push(cluster);
      }
    });

    let fpsoX = 0;
    let fpsoY = 0;

    fpsoMap.forEach(({ fpso, clusters: fpsoClusters }) => {
      if (fpsoClusters.length === 0) return;

      const fpsoParentId = `fpso_${fpso.code}`;
      const MOD_COLS = 2;
      const numRows = Math.ceil(fpsoClusters.length / MOD_COLS);

      // 1. Calculate maximum width for each column and maximum height for each row
      const colWidths = new Array(MOD_COLS).fill(0);
      const rowHeights = new Array(numRows).fill(0);

      fpsoClusters.forEach((cluster, idx) => {
        const col = idx % MOD_COLS;
        const row = Math.floor(idx / MOD_COLS);
        colWidths[col] = Math.max(colWidths[col], cluster.boxWidth);
        rowHeights[row] = Math.max(rowHeights[row], cluster.boxHeight);
      });

      const PADDING_X = 80;
      const PADDING_TOP = 110;
      const PADDING_BOTTOM = 90;
      const GAP_X = 100;
      const GAP_Y = 100;

      // 2. Compute exact X offset for each column and Y offset for each row
      const colXOffsets = new Array(MOD_COLS).fill(0);
      let currentXOffset = PADDING_X;
      for (let c = 0; c < MOD_COLS; c++) {
        colXOffsets[c] = currentXOffset;
        if (colWidths[c] > 0) {
          currentXOffset += colWidths[c] + GAP_X;
        }
      }

      const rowYOffsets = new Array(numRows).fill(0);
      let currentYOffset = PADDING_TOP;
      for (let r = 0; r < numRows; r++) {
        rowYOffsets[r] = currentYOffset;
        currentYOffset += rowHeights[r] + GAP_Y;
      }

      // 3. Compute total FPSO width and height to strictly encompass all modules
      const activeColsCount = colWidths.filter(w => w > 0).length;
      const totalFpsoWidth = Math.max(
        900,
        currentXOffset - (activeColsCount > 0 ? GAP_X : 0) + PADDING_X
      );
      const totalFpsoHeight = Math.max(520, currentYOffset - GAP_Y + PADDING_BOTTOM);

      // 4. Position each module cleanly inside its column and row
      fpsoClusters.forEach((cluster, idx) => {
        const col = idx % MOD_COLS;
        const row = Math.floor(idx / MOD_COLS);
        const innerModX = colXOffsets[col];
        const innerModY = rowYOffsets[row];

        const parentGroupId = `group_${cluster.modCode}`;
        const matchedModObj = modulesList?.find(m => m.code === cluster.modCode || m.id === cluster.modCode);
        const modTitle = cluster.isUnassigned
          ? 'Equipamentos Gerais (Sem Módulo)'
          : matchedModObj?.title || `Módulo ${cluster.modCode}`;

        groupNodes.push({
          id: parentGroupId,
          parentId: fpsoParentId,
          extent: 'parent' as const,
          type: 'moduleGroupNode',
          position: { x: innerModX, y: innerModY },
          selectable: true,
          draggable: true,
          zIndex: -10,
          style: { width: cluster.boxWidth, height: cluster.boxHeight, zIndex: -10 },
          width: cluster.boxWidth,
          height: cluster.boxHeight,
          data: {
            code: cluster.isUnassigned ? 'GERAL' : cluster.modCode,
            title: modTitle,
            equipmentCount: cluster.modEquipments.length,
            width: cluster.boxWidth,
            height: cluster.boxHeight,
          },
        });

        cluster.modEquipments.forEach(eq => {
          const localPos = cluster.equipmentPositions.get(eq.uri) || { x: 50, y: 70 };
          equipmentNodes.push(
            createEquipmentNode(eq, localPos, parentGroupId)
          );
        });
      });

      const totalEqCount = fpsoClusters.reduce((sum, c) => sum + c.modEquipments.length, 0);

      fpsoNodes.push({
        id: fpsoParentId,
        type: 'fpsoGroupNode',
        position: { x: fpsoX, y: fpsoY },
        selectable: true,
        draggable: true,
        zIndex: -20,
        style: { width: totalFpsoWidth, height: totalFpsoHeight, zIndex: -20 },
        width: totalFpsoWidth,
        height: totalFpsoHeight,
        data: {
          id: fpso.id,
          code: fpso.code,
          title: fpso.title,
          fieldLocation: fpso.fieldLocation,
          moduleCount: fpsoClusters.length,
          equipmentCount: totalEqCount,
          width: totalFpsoWidth,
          height: totalFpsoHeight,
        },
      });

      fpsoX += totalFpsoWidth + 240;
    });

    if (unassignedClusters.length > 0) {
      let unassignedX = fpsoX;
      let unassignedY = 0;

      unassignedClusters.forEach(cluster => {
        const parentGroupId = `group_${cluster.modCode}`;
        const matchedModObj = modulesList?.find(m => m.code === cluster.modCode);
        const modTitle = cluster.isUnassigned
          ? 'Equipamentos Gerais (Sem Módulo)'
          : matchedModObj?.title || `Módulo ${cluster.modCode}`;

        groupNodes.push({
          id: parentGroupId,
          type: 'moduleGroupNode',
          position: { x: unassignedX, y: unassignedY },
          selectable: true,
          draggable: true,
          zIndex: -10,
          style: { width: cluster.boxWidth, height: cluster.boxHeight, zIndex: -10 },
          width: cluster.boxWidth,
          height: cluster.boxHeight,
          data: {
            code: cluster.isUnassigned ? 'GERAL' : cluster.modCode,
            title: modTitle,
            equipmentCount: cluster.modEquipments.length,
            width: cluster.boxWidth,
            height: cluster.boxHeight,
          },
        });

        cluster.modEquipments.forEach(eq => {
          const localPos = cluster.equipmentPositions.get(eq.uri) || { x: 50, y: 70 };
          equipmentNodes.push(
            createEquipmentNode(eq, localPos, parentGroupId)
          );
        });

        unassignedX += cluster.boxWidth + 120;
      });
    }

    const edges: Edge[] = graph.connections.map(conn =>
      createGraphEdge(conn, graph.equipments)
    );

    return { nodes: [...fpsoNodes, ...groupNodes, ...equipmentNodes], edges };
  }

  // Tile Module Clusters dynamically into a 3-column grid for standard Multi-Module layout
  const groupNodes: Node[] = [];
  const equipmentNodes: Node[] = [];
  const COLS = 3;
  const GAP_X = 240;
  const GAP_Y = 200;

  let currentX = 0;
  let currentY = 0;
  let maxRowHeight = 0;

  clusters.forEach((cluster, idx) => {
    const col = idx % COLS;
    if (col === 0 && idx > 0) {
      currentX = 0;
      currentY += maxRowHeight + GAP_Y;
      maxRowHeight = 0;
    }

    const parentGroupId = `group_${cluster.modCode}`;
    const matchedModObj = modulesList?.find(m => m.code === cluster.modCode);
    const modTitle = cluster.isUnassigned
      ? 'Equipamentos Gerais (Sem Módulo)'
      : matchedModObj?.title || `Módulo ${cluster.modCode}`;

    // Background Module Enclosure Group Node (Draggable & Resizable container!)
    groupNodes.push({
      id: parentGroupId,
      type: 'moduleGroupNode',
      position: { x: currentX, y: currentY },
      selectable: true,
      draggable: true,
      zIndex: -10,
      style: { width: cluster.boxWidth, height: cluster.boxHeight, zIndex: -10 },
      width: cluster.boxWidth,
      height: cluster.boxHeight,
      data: {
        code: cluster.isUnassigned ? 'GERAL' : cluster.modCode,
        title: modTitle,
        equipmentCount: cluster.modEquipments.length,
        width: cluster.boxWidth,
        height: cluster.boxHeight,
      },
    });

    // Add equipment nodes
    cluster.modEquipments.forEach(eq => {
      const localPos = cluster.equipmentPositions.get(eq.uri) || { x: 50, y: 50 };

      equipmentNodes.push(
        createEquipmentNode(eq, {
          x: currentX + localPos.x,
          y: currentY + localPos.y,
        })
      );
    });

    maxRowHeight = Math.max(maxRowHeight, cluster.boxHeight);
    currentX += cluster.boxWidth + GAP_X;
  });

  const edges: Edge[] = graph.connections.map(conn =>
    createGraphEdge(conn, graph.equipments)
  );

  return { nodes: [...groupNodes, ...equipmentNodes], edges };
}

export function layoutComponentSubGraph(parentEquipment: Equipment): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: 'LR',
    nodesep: 60,
    ranksep: 140,
    marginx: 50,
    marginy: 50,
  });

  dagreGraph.setNode(parentEquipment.uri, { width: NODE_WIDTH, height: NODE_HEIGHT });

  parentEquipment.components.forEach(comp => {
    dagreGraph.setNode(comp.uri, { width: 260, height: 100 });
    dagreGraph.setEdge(parentEquipment.uri, comp.uri);
  });

  dagre.layout(dagreGraph);

  const parentPos = dagreGraph.node(parentEquipment.uri);
  const nodes: Node[] = [
    {
      ...createEquipmentNode(
        parentEquipment,
        {
          x: parentPos ? parentPos.x - NODE_WIDTH / 2 : 50,
          y: parentPos ? parentPos.y - NODE_HEIGHT / 2 : 150,
        }
      ),
      data: {
        equipment: parentEquipment,
        label: parentEquipment.label,
        category: parentEquipment.category,
        classLabel: parentEquipment.classLabel,
        hasError: parentEquipment.hasError,
        errorMessage: parentEquipment.errorMessage,
        isRootInSubGraph: true,
      },
    },
  ];

  parentEquipment.components.forEach(comp => {
    const pos = dagreGraph.node(comp.uri);
    nodes.push({
      id: comp.uri,
      type: 'componentNode',
      position: {
        x: pos ? pos.x - 130 : 400,
        y: pos ? pos.y - 50 : 150,
      },
      zIndex: 10,
      data: {
        component: comp,
        parentEquipment,
      },
    });
  });

  const edges: Edge[] = parentEquipment.components.map(comp => ({
    id: `edge_${parentEquipment.uri}_to_${comp.uri}`,
    source: parentEquipment.uri,
    sourceHandle: `${parentEquipment.uri}_out`,
    target: comp.uri,
    targetHandle: `${comp.uri}_target`,
    type: 'customEditableEdge',
    animated: true,
    zIndex: 1,
    style: {
      stroke: '#c084fc',
      strokeWidth: 3,
    },
    label: 'o3po:hasComponent',
    labelStyle: { fill: '#e9d5ff', fontSize: 11, fontWeight: 700 },
    labelBgStyle: { fill: '#581c87', fillOpacity: 0.9 },
  }));

  return { nodes, edges };
}
