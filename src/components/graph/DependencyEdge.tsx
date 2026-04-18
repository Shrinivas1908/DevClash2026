import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

interface DependencyEdgeData {
  import_type: 'static' | 'dynamic' | 'reexport';
  highlighted?: boolean;
  [key: string]: unknown;
}

export const DependencyEdge = memo(
  ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) => {
    const edgeData = data as DependencyEdgeData | undefined;
    const highlighted = edgeData?.highlighted ?? false;
    const importType = edgeData?.import_type ?? 'static';

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
    });

    const strokeColor = highlighted ? '#4D8EF7' : '#2A2F42';
    const strokeWidth = highlighted ? 2 : 1.5;
    const isDynamic = importType === 'dynamic';

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: strokeColor,
            strokeWidth,
            strokeDasharray: isDynamic ? '6 3' : undefined,
            animation: isDynamic ? 'dashFlow 1.2s linear infinite' : undefined,
            transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
          }}
          markerEnd="url(#arrowhead)"
        />
        {highlighted && importType === 'reexport' && (
          <EdgeLabelRenderer>
            <div
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
              className="absolute pointer-events-none px-1.5 py-0.5 rounded text-[9px] bg-bg-elevated border border-border text-text-muted"
            >
              re-export
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  },
);

DependencyEdge.displayName = 'DependencyEdge';
