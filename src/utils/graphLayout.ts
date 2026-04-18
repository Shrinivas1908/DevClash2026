import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

interface GraphLayoutOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  ranksep?: number;
  nodesep?: number;
}

/**
 * Apply dagre layout algorithm to organize graph nodes and edges
 * This creates a clean, hierarchical layout with proper spacing
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: GraphLayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'TB',
    nodeWidth = 200,
    nodeHeight = 60,
    ranksep = 150,
    nodesep = 100,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep,
    ranksep,
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Apply force-directed layout for more organic clustering
 * Useful for showing related files grouped together
 */
export function applyForceLayout(
  nodes: Node[],
  edges: Edge[],
  options: { width?: number; height?: number } = {}
): { nodes: Node[]; edges: Edge[] } {
  const { width = 2000, height = 2000 } = options;

  // Simple force-directed layout implementation
  const nodePositions = new Map<string, { x: number; y: number }>();
  
  // Initialize random positions
  nodes.forEach((node) => {
    nodePositions.set(node.id, {
      x: Math.random() * width,
      y: Math.random() * height,
    });
  });

  // Simulation iterations
  const iterations = 100;
  for (let i = 0; i < iterations; i++) {
    const k = Math.sqrt((width * height) / nodes.length); // optimal distance
    
    // Repulsion between all nodes
    nodes.forEach((node1) => {
      const pos1 = nodePositions.get(node1.id)!;
      nodes.forEach((node2) => {
        if (node1.id === node2.id) return;
        const pos2 = nodePositions.get(node2.id)!;
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (k * k) / distance;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        pos1.x += fx;
        pos1.y += fy;
      });
    });

    // Attraction along edges
    edges.forEach((edge) => {
      const pos1 = nodePositions.get(edge.source)!;
      const pos2 = nodePositions.get(edge.target)!;
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (distance * distance) / k;
      const fx = (dx / distance) * force * 0.01;
      const fy = (dy / distance) * force * 0.01;
      pos1.x += fx;
      pos1.y += fy;
      pos2.x -= fx;
      pos2.y -= fy;
    });

    // Center the graph
    const centerX = width / 2;
    const centerY = height / 2;
    nodes.forEach((node) => {
      const pos = nodePositions.get(node.id)!;
      pos.x += (centerX - pos.x) * 0.01;
      pos.y += (centerY - pos.y) * 0.01;
    });
  }

  // Apply positions to nodes
  const layoutedNodes = nodes.map((node) => ({
    ...node,
    position: nodePositions.get(node.id)!,
  }));

  return { nodes: layoutedNodes, edges };
}

/**
 * Apply hierarchical layout with entry points at the top
 * This organizes the graph by importance and entry points
 */
export function applyHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  options: GraphLayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  // Separate entry points from regular nodes
  const entryPoints = nodes.filter((n) => (n.data as any)?.is_entry_point);
  const regularNodes = nodes.filter((n) => !(n.data as any)?.is_entry_point);

  // Layout entry points at the top
  const entryPointLayout = applyDagreLayout(entryPoints, [], {
    ...options,
    direction: 'TB',
    ranksep: 100,
  });

  // Layout regular nodes below
  const regularLayout = applyDagreLayout(regularNodes, edges, {
    ...options,
    direction: 'TB',
    ranksep: 120,
    nodesep: 80,
  });

  // Calculate offset for regular nodes
  const maxY = Math.max(...entryPointLayout.nodes.map((n) => n.position.y || 0));

  // Shift regular nodes below entry points
  const shiftedRegularNodes = regularLayout.nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x,
      y: (node.position.y || 0) + maxY + 150,
    },
  }));

  return {
    nodes: [...entryPointLayout.nodes, ...shiftedRegularNodes],
    edges,
  };
}
