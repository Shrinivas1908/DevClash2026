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

  const importanceColor = fileData.composite_importance >= 20
    ? 'text-accent-blue'
    : fileData.is_entry_point
      ? 'text-accent-green'
      : 'text-text-muted';

  const tooltipContent = (
    <div className="space-y-1.5 p-1">
      <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-1.5 mb-1.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">{fileData.language}</span>
        <Badge variant={importanceBadge(fileData.composite_importance)}>Score {fileData.composite_importance}</Badge>
      </div>
      <p className="font-mono text-[11px] text-text-primary break-all">{fileData.path}</p>
      <div className="flex gap-4 pt-1 text-[10px] font-medium uppercase tracking-tighter">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-accent-green" /> {fileData.fan_in} incoming</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-accent-blue" /> {fileData.fan_out} outgoing</span>
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} side="top">
      <div
        className={cn(
          'relative rounded-xl border transition-all duration-300 group',
          'bg-bg-surface/80 backdrop-blur-md shadow-lg',
          selected
            ? 'border-accent-blue ring-4 ring-accent-blue/10 scale-105 shadow-glow z-50'
            : 'border-border/50 hover:border-accent-blue/40 hover:shadow-xl hover:-translate-y-0.5',
          compactMode ? 'w-32 h-12 px-3 py-2' : 'w-48 h-20 px-4 py-3',
        )}
      >
        {/* Glow effect for high importance */}
        {fileData.composite_importance >= 25 && !selected && (
          <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-blue/20 to-accent-purple/20 rounded-xl blur opacity-50 group-hover:opacity-100 transition-opacity" />
        )}

        <Handle
          type="target"
          position={Position.Top}
          className="!w-2.5 !h-2.5 !bg-bg-base !border-2 !border-accent-blue/30 !-top-1.5"
        />

        <div className="flex flex-col h-full relative z-10">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              "font-bold text-text-primary truncate",
              compactMode ? "text-xs" : "text-[13px] leading-tight"
            )}>
              {fileData.name}
            </p>
            {fileData.is_entry_point && (
              <div className="w-2 h-2 rounded-full bg-accent-green shadow-[0_0_8px_rgba(74,222,128,0.5)] flex-shrink-0 mt-1" title="Entry Point" />
            )}
          </div>

          {!compactMode && (
            <>
              <p className="text-[10px] text-text-muted font-mono truncate mt-0.5 opacity-70">
                {fileData.path.replace(fileData.name, '').replace(/\/$/, '') || '/'}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-text-muted/50 uppercase tracking-widest">{fileData.language}</span>
                </div>
                <Badge variant={importanceBadge(fileData.composite_importance)} className="text-[9px] py-0 px-1.5 font-bold tabular-nums">
                  {fileData.composite_importance}
                </Badge>
              </div>
            </>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2.5 !h-2.5 !bg-bg-base !border-2 !border-accent-blue/30 !-bottom-1.5"
        />
      </div>
    </Tooltip>
  );
});

FileNode.displayName = 'FileNode';
