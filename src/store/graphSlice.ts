import type { StateCreator } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { GraphData, FileNodeData } from '@/types/graph';
import dagre from '@dagrejs/dagre';

export type LayoutType = 'dagre-v' | 'dagre-h' | 'force';
export type FilterType = 'all' | 'high-importance' | 'entry' | 'config';

export interface GraphSlice {
  nodes: Node[];
  edges: Edge[];
  allNodes: Node[];
  allEdges: Edge[];
  selectedNodeId: string | null;
  layout: LayoutType;
  activeFilter: FilterType;
  compactMode: boolean;
  setGraphData: (data: GraphData) => void;
  setSelectedNode: (id: string | null) => void;
  setLayout: (layout: LayoutType) => void;
  setFilter: (filter: FilterType) => void;
  setCompactMode: (compact: boolean) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 64;

function applyDagreLayout(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR'): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
}

function fileNodeToFlowNode(f: FileNodeData): Node {
  return {
    id: f.id,
    type: 'fileNode',
    position: { x: 0, y: 0 },
    data: f as unknown as Record<string, unknown>,
  };
}

export const createGraphSlice: StateCreator<GraphSlice> = (set, get) => ({
  nodes: [],
  edges: [],
  allNodes: [],
  allEdges: [],
  selectedNodeId: null,
  layout: 'dagre-v',
  activeFilter: 'all',
  compactMode: false,

  setGraphData: (data) => {
    const rawNodes = data.nodes.map(fileNodeToFlowNode);
    const rawEdges: Edge[] = data.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      type: 'dependency',
      data: { import_type: e.import_type },
    }));

    const direction = get().layout === 'dagre-h' ? 'LR' : 'TB';
    const laidOut = applyDagreLayout(rawNodes, rawEdges, direction);
    const compact = data.nodes.length > 500;

    set({ nodes: laidOut, edges: rawEdges, allNodes: laidOut, allEdges: rawEdges, compactMode: compact });
  },

  setSelectedNode: (id) => {
    set({ selectedNodeId: id });
    // Highlight connected edges
    set((state) => ({
      edges: state.allEdges.map((e) => ({
        ...e,
        data: {
          ...(e.data as Record<string, unknown>),
          highlighted: id ? e.source === id || e.target === id : false,
        },
      })),
    }));
  },

  setLayout: (layout) => {
    set({ layout });
    const { allNodes, allEdges } = get();
    if (allNodes.length === 0) return;
    const direction = layout === 'dagre-h' ? 'LR' : 'TB';
    const laidOut = applyDagreLayout(allNodes, allEdges, direction);
    set({ nodes: laidOut });
  },

  setFilter: (filter) => {
    set({ activeFilter: filter });
    const { allNodes, allEdges } = get();
    if (filter === 'all') {
      set({ nodes: allNodes, edges: allEdges });
      return;
    }
    const filtered = allNodes.filter((n) => {
    const d = n.data as unknown as FileNodeData;
      if (filter === 'high-importance') return d.composite_importance >= 20;
      if (filter === 'entry') return d.is_entry_point;
      if (filter === 'config') return d.path.includes('config') || d.path.includes('.json') || d.path.includes('.yaml');
      return true;
    });
    const filteredIds = new Set(filtered.map((n) => n.id));
    const filteredEdges = allEdges.filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target));
    set({ nodes: filtered, edges: filteredEdges });
  },

  setCompactMode: (compact) => set({ compactMode: compact }),
});
