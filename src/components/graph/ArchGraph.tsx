import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '@/store';
import { FileNode } from './FileNode';
import { DependencyEdge } from './DependencyEdge';
import { GraphControls } from './GraphControls';
import { GraphLegend } from './GraphLegend';
import type { FileNodeData } from '@/types/graph';

const nodeTypes: NodeTypes = { fileNode: FileNode };
const edgeTypes: EdgeTypes = { dependency: DependencyEdge };

export function ArchGraph() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const setRightPanelOpen = useStore((s) => s.setRightPanelOpen);

  const onNodeClick = useCallback(
    (_evt: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
      setRightPanelOpen(true);
    },
    [setSelectedNode, setRightPanelOpen],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setRightPanelOpen(false);
  }, [setSelectedNode, setRightPanelOpen]);

  // MiniMap node color
  const minimapNodeColor = useCallback((node: Node): string => {
    const d = node.data as unknown as FileNodeData;
    if (d.composite_importance >= 20) return '#1E3A6E';
    if (d.is_entry_point) return '#1A3A2A';
    return '#1C2030';
  }, []);

  const defaultEdgeOptions = useMemo(
    () => ({ type: 'dependency', animated: false }),
    [],
  );

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: false }}
        minZoom={0.05}
        maxZoom={3}
        defaultEdgeOptions={defaultEdgeOptions}
        className="bg-bg-base"
        deleteKeyCode={null}
        selectionKeyCode={null}
      >
        <Background color="#1E2235" gap={24} variant={BackgroundVariant.Dots} />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(13, 15, 20, 0.7)"
          pannable
          zoomable
          position="bottom-right"
        />
        {/* SVG defs for arrow markers */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#2A2F42" />
            </marker>
          </defs>
        </svg>
        <GraphControls />
        <GraphLegend />
      </ReactFlow>
    </div>
  );
}
