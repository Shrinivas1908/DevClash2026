import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCommit, ArrowDownToLine, ArrowUpFromLine, Sparkles, ExternalLink } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, importanceBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useFileDetail } from '@/hooks/useFileDetail';
import type { FileNodeData } from '@/types/graph';
import { truncateSha, getLanguageColor } from '@/lib/utils';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function SkeletonLine({ w }: { w: string }) {
  return <div className={cn('skeleton h-3 rounded', w)} />;
}

function ImportanceBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="h-full bg-gradient-to-r from-accent-blue to-accent-purple rounded-full"
      />
    </div>
  );
}

type Tab = 'imports' | 'imported-by';

export function RightPanel() {
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const rightPanelOpen = useStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useStore((s) => s.setRightPanelOpen);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const allNodes = useStore((s) => s.allNodes);
  const allEdges = useStore((s) => s.allEdges);

  const [activeTab, setActiveTab] = useState<Tab>('imports');

  const selectedNode = allNodes.find((n) => n.id === selectedNodeId);
  const fileData = selectedNode?.data as unknown as FileNodeData | undefined;

  const { summary, status } = useFileDetail(fileData?.last_commit_sha ?? null);

  const imports = allEdges
    .filter((e) => e.source === selectedNodeId)
    .map((e) => allNodes.find((n) => n.id === e.target)?.data as unknown as FileNodeData | undefined)
    .filter(Boolean) as FileNodeData[];

  const importedBy = allEdges
    .filter((e) => e.target === selectedNodeId)
    .map((e) => allNodes.find((n) => n.id === e.source)?.data as unknown as FileNodeData | undefined)
    .filter(Boolean) as FileNodeData[];

  const maxImportance = Math.max(...allNodes.map((n) => (n.data as unknown as FileNodeData).composite_importance), 1);

  const close = () => {
    setRightPanelOpen(false);
    setSelectedNode(null);
  };

  return (
    <AnimatePresence>
      {rightPanelOpen && fileData && (
        <motion.aside
          key="right-panel"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="w-80 flex-shrink-0 h-full bg-bg-surface border-l border-border overflow-y-auto flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex-shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary truncate">{fileData.name}</p>
                <p className="text-xs text-text-muted font-mono truncate mt-0.5">{fileData.path}</p>
              </div>
              <button
                onClick={close}
                className="p-1 hover:bg-bg-hover rounded-md transition-colors flex-shrink-0"
                aria-label="Close panel"
              >
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border"
                style={{ color: getLanguageColor(fileData.language), borderColor: `${getLanguageColor(fileData.language)}40`, background: `${getLanguageColor(fileData.language)}15` }}
              >
                {fileData.language}
              </span>
              <Badge variant="muted">
                <GitCommit className="w-3 h-3" />
                {truncateSha(fileData.last_commit_sha)}
              </Badge>
              {fileData.is_entry_point && <Badge variant="green" dot>Entry Point</Badge>}
            </div>
          </div>

          {/* Importance breakdown */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Importance</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-bg-elevated rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowDownToLine className="w-3.5 h-3.5 text-accent-green" />
                  <span className="text-xs text-text-muted">Fan-In</span>
                </div>
                <p className="text-xl font-bold text-accent-green">{fileData.fan_in}</p>
              </div>
              <div className="bg-bg-elevated rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowUpFromLine className="w-3.5 h-3.5 text-accent-blue" />
                  <span className="text-xs text-text-muted">Fan-Out</span>
                </div>
                <p className="text-xl font-bold text-accent-blue">{fileData.fan_out}</p>
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">Composite Score</span>
                <Badge variant={importanceBadge(fileData.composite_importance)}>
                  {fileData.composite_importance}
                </Badge>
              </div>
              <p className="text-xs text-text-muted font-mono mb-2">
                ({fileData.fan_in} × 3) + {fileData.fan_out} = {fileData.composite_importance}
              </p>
              <ImportanceBar value={fileData.composite_importance} max={maxImportance} />
            </div>
          </div>

          {/* AI Summary */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
              <p className="text-xs font-medium text-accent-purple uppercase tracking-wide">AI Analysis</p>
              {status === 'streaming' && <Spinner size="sm" className="text-accent-purple" />}
            </div>
            {status === 'unavailable' ? (
              <p className="text-xs text-text-muted italic">Summary unavailable for this file.</p>
            ) : status === 'idle' ? (
              <div className="space-y-2">
                <SkeletonLine w="w-full" />
                <SkeletonLine w="w-4/5" />
                <SkeletonLine w="w-3/5" />
              </div>
            ) : (
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{summary}</p>
            )}
          </div>

          {/* Connections tabs */}
          <div className="flex-1 flex flex-col">
            <div className="flex border-b border-border">
              {(['imports', 'imported-by'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-1 py-2.5 text-xs font-medium transition-colors',
                    activeTab === tab
                      ? 'text-accent-blue border-b-2 border-accent-blue -mb-px'
                      : 'text-text-muted hover:text-text-secondary',
                  )}
                >
                  {tab === 'imports' ? `Imports (${imports.length})` : `Imported By (${importedBy.length})`}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {(activeTab === 'imports' ? imports : importedBy).map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setSelectedNode(f.id); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg-hover transition-colors group text-left"
                >
                  <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0" />
                  <span className="text-xs text-text-secondary font-mono truncate group-hover:text-accent-blue transition-colors">
                    {f.path}
                  </span>
                </button>
              ))}
              {(activeTab === 'imports' ? imports : importedBy).length === 0 && (
                <p className="px-4 py-6 text-xs text-text-muted text-center">No connections</p>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
