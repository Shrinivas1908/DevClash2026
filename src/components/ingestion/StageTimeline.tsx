import { motion } from 'framer-motion';
import { CheckCircle, Loader, Clock, XCircle } from 'lucide-react';
import type { PipelineStage, StageStatus } from '@/types/job';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function stageDuration(stage: PipelineStage): string {
  if (!stage.started_at) return '';
  const end = stage.completed_at ? new Date(stage.completed_at) : new Date();
  const start = new Date(stage.started_at);
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === 'complete') return <CheckCircle className="w-4 h-4 text-accent-green" />;
  if (status === 'running') return <Loader className="w-4 h-4 text-accent-blue animate-spin" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-accent-red" />;
  return <Clock className="w-4 h-4 text-text-muted" />;
}

const statusStyles: Record<StageStatus, string> = {
  complete: 'text-accent-green',
  running: 'text-accent-blue',
  failed: 'text-accent-red',
  waiting: 'text-text-muted',
};

const chipStyles: Record<StageStatus, string> = {
  complete: 'bg-accent-green/15 text-accent-green border-accent-green/30',
  running: 'bg-accent-blue/15 text-accent-blue border-accent-blue/30',
  failed: 'bg-accent-red/15 text-accent-red border-accent-red/30',
  waiting: 'bg-bg-hover text-text-muted border-border',
};

export function StageTimeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => (
        <motion.div
          key={stage.stage}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.08 }}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl border transition-all duration-300',
            stage.status === 'running'
              ? 'border-accent-blue/40 bg-accent-blue/5 animate-pulse-glow'
              : 'border-border bg-bg-elevated',
          )}
        >
          {/* Stage number dot */}
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0',
              stage.status === 'complete' ? 'border-accent-green bg-accent-green/20 text-accent-green' :
              stage.status === 'running' ? 'border-accent-blue bg-accent-blue/20 text-accent-blue' :
              stage.status === 'failed' ? 'border-accent-red bg-accent-red/20 text-accent-red' :
              'border-border bg-bg-hover text-text-muted',
            )}
          >
            {stage.stage}
          </div>

          <StatusIcon status={stage.status} />

          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium truncate', statusStyles[stage.status])}>
              {stage.name}
            </p>
            {stage.started_at && stage.status !== 'waiting' && (
              <p className="text-[10px] text-text-muted mt-0.5">
                {stage.status === 'running' ? 'Started ' + formatDistanceToNow(new Date(stage.started_at), { addSuffix: true }) : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {stage.status !== 'waiting' && (
              <span className="text-xs text-text-muted font-mono">{stageDuration(stage)}</span>
            )}
            <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-medium border', chipStyles[stage.status])}>
              {stage.status === 'running' ? 'Running' :
               stage.status === 'complete' ? '✓ Done' :
               stage.status === 'failed' ? '✗ Failed' : 'Waiting'}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
