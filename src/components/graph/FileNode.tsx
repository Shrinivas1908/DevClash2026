import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStore } from '@/store';
import { Badge, importanceBadge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import type { FileNodeData } from '@/types/graph';
import { cn } from '@/lib/utils';

function getBorderColor(data: FileNodeData, isSelected: boolean): string {
  if (isSelected) return 'border-accent-blue shadow-glow';
  if (data.composite_importance >= 20) return 'border-accent-blue/50';
  if (data.is_entry_point) return 'border-accent-green/50';
  return 'border-border';
}

function getNodeBg(data: FileNodeData): string {
  if (data.composite_importance >= 20) return 'bg-graph-node-central';
  if (data.is_entry_point) return 'bg-graph-node-entry';
  return 'bg-graph-node-default';
}

export const FileNode = memo(({ data, selected }: NodeProps) => {
  const fileData = data as unknown as FileNodeData;
  const compactMode = useStore((s) => s.compactMode);

  const tooltipContent = (
    <div className="space-y-1">
      <p className="font-mono text-xs text-text-primary">{fileData.path}</p>
      <div className="flex gap-3 text-xs text-text-muted">
        <span>↓ Fan-In: <strong className="text-accent-green">{fileData.fan_in}</strong></span>
        <span>↑ Fan-Out: <strong className="text-accent-blue">{fileData.fan_out}</strong></span>
      </div>
      <p className="text-xs text-text-muted">Score: {fileData.composite_importance}</p>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} side="top">
      <div
        className={cn(
          'rounded-lg border-2 transition-all duration-150 cursor-pointer select-none',
          getNodeBg(fileData),
          getBorderColor(fileData, !!selected),
          compactMode ? 'w-28 h-10 px-2 py-1' : 'w-44 h-16 px-3 py-2',
        )}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-border !border-border" />

        {compactMode ? (
          <p className="text-xs font-medium text-text-primary truncate">{fileData.name}</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-text-primary truncate leading-tight">{fileData.name}</p>
            <p className="text-xs text-text-muted font-mono truncate mt-0.5">
              {fileData.path.replace(fileData.name, '').replace(/\/$/, '')}
            </p>
            <div className="mt-1">
              <Badge variant={importanceBadge(fileData.composite_importance)} className="text-[10px] py-0 px-1.5">
                {fileData.composite_importance}
              </Badge>
            </div>
          </>
        )}

        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-border !border-border" />
      </div>
    </Tooltip>
  );
});

FileNode.displayName = 'FileNode';
