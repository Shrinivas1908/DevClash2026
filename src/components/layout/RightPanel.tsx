import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCommit, ArrowDownToLine, ArrowUpFromLine, Sparkles, ExternalLink, Network } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, importanceBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import type { FileNodeData } from '@/types/graph';
import { truncateSha, getLanguageColor } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { IssueStats } from '@/components/analytics/IssueStats';
import { apiPost } from '@/lib/api';

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
  const repoInsights = useStore((s) => s.repoInsights);
  const aiAnswer = useStore((s) => s.aiAnswer);
  const repoId = useStore((s) => s.repoId);
  const relatedCommits = useStore((s) => s.relatedCommits);

  const [activeTab, setActiveTab] = useState<Tab>('imports');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<'idle' | 'streaming' | 'complete' | 'error' | 'unavailable'>('idle');

  const selectedNode = allNodes.find((n) => n.id === selectedNodeId);
  const fileData = selectedNode?.data as unknown as FileNodeData | undefined;

  // Fetch AI summary for selected file
  useEffect(() => {
    if (!selectedNodeId || !fileData || !repoId) {
      setSummary('');
      setStatus('idle');
      return;
    }

    const fetchFileSummary = async () => {
      try {
        setStatus('streaming');
        const response = await apiPost<{ explanation: string; keywords: string[] }>(`/api/repo/${repoId}/file-query`, {
          filePath: fileData.path
        });
        setSummary(response.explanation || '');
        setStatus('complete');
      } catch (err) {
        console.error('Failed to fetch file summary:', err);
        setSummary('Unable to fetch file summary.');
        setStatus('unavailable');
      }
    };

    fetchFileSummary();
  }, [selectedNodeId, fileData, repoId]);


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
      {rightPanelOpen && (
        <motion.aside
          key="right-panel"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="w-80 flex-shrink-0 h-full bg-bg-surface border-l border-border overflow-y-auto flex flex-col"
        >
          {fileData ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border flex-shrink-0 bg-bg-surface/50 backdrop-blur-sm sticky top-0 z-20">
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
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider"
                    style={{ color: getLanguageColor(fileData.language), borderColor: `${getLanguageColor(fileData.language)}40`, background: `${getLanguageColor(fileData.language)}15` }}
                  >
                    {fileData.language}
                  </span>
                  <Badge variant="muted" className="text-[10px] font-mono">
                    <GitCommit className="w-3 h-3" />
                    {truncateSha(fileData.last_commit_sha)}
                  </Badge>
                  {fileData.is_entry_point && <Badge variant="green" dot className="text-[10px]">Entry Point</Badge>}
                </div>
              </div>

              {/* Importance breakdown */}
              <div className="p-4 border-b border-border bg-bg-base/20">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">Architecture Score</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-bg-elevated/50 border border-border/50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownToLine className="w-3 h-3 text-accent-green" />
                      <span className="text-[10px] text-text-muted uppercase font-bold">Fan-In</span>
                    </div>
                    <p className="text-2xl font-bold text-accent-green tabular-nums">{fileData.fan_in}</p>
                  </div>
                  <div className="bg-bg-elevated/50 border border-border/50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpFromLine className="w-3 h-3 text-accent-blue" />
                      <span className="text-[10px] text-text-muted uppercase font-bold">Fan-Out</span>
                    </div>
                    <p className="text-2xl font-bold text-accent-blue tabular-nums">{fileData.fan_out}</p>
                  </div>
                </div>
                <div className="bg-bg-elevated/30 border border-border/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Importance Rank</span>
                    <Badge variant={importanceBadge(fileData.composite_importance)} className="font-bold">
                      {fileData.composite_importance}
                    </Badge>
                  </div>
                  <ImportanceBar value={fileData.composite_importance} max={maxImportance} />
                </div>
              </div>

              {/* AI Summary */}
              <div className="p-5 border-b border-border bg-gradient-to-b from-bg-surface to-bg-base/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1 rounded-md bg-accent-purple/10">
                    <Sparkles className="w-3.5 h-3.5 text-accent-purple" />
                  </div>
                  <p className="text-[10px] font-bold text-accent-purple uppercase tracking-widest">Architectural Analysis</p>
                  {status === 'streaming' && <Spinner size="sm" className="text-accent-purple" />}
                </div>
                {status === 'unavailable' ? (
                  <div className="bg-bg-elevated/20 rounded-lg p-3 border border-dashed border-border">
                    <p className="text-xs text-text-muted italic">No architectural analysis available for this component.</p>
                  </div>
                ) : status === 'idle' ? (
                  <div className="space-y-3">
                    <SkeletonLine w="w-full" />
                    <SkeletonLine w="w-11/12" />
                    <SkeletonLine w="w-4/5" />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute -left-3 top-0 bottom-0 w-0.5 bg-accent-purple/20 rounded-full" />
                    <p className="text-[13px] text-text-secondary leading-relaxed font-medium">
                      {summary}
                    </p>
                  </div>
                )}
              </div>

              {/* Connections tabs */}
              <div className="flex-1 flex flex-col bg-bg-base/30">
                <div className="flex border-b border-border bg-bg-surface px-2">
                  {(['imports', 'imported-by'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all relative',
                        activeTab === tab
                          ? 'text-accent-blue'
                          : 'text-text-muted hover:text-text-secondary',
                      )}
                    >
                      {tab === 'imports' ? `Imports (${imports.length})` : `Referenced By (${importedBy.length})`}
                      {activeTab === tab && (
                        <motion.div layoutId="tab-underline" className="absolute bottom-0 left-4 right-4 h-0.5 bg-accent-blue rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {(activeTab === 'imports' ? imports : importedBy).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setSelectedNode(f.id); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated/50 rounded-lg transition-all group text-left border border-transparent hover:border-border/50"
                    >
                      <div className="w-6 h-6 rounded bg-bg-elevated flex items-center justify-center flex-shrink-0 group-hover:bg-accent-blue/10 transition-colors">
                        <ExternalLink className="w-3 h-3 text-text-muted group-hover:text-accent-blue" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-text-primary font-bold truncate group-hover:text-accent-blue transition-colors">{f.name}</p>
                        <p className="text-[9px] text-text-muted font-mono truncate">{f.path}</p>
                      </div>
                    </button>
                  ))}
                  {(activeTab === 'imports' ? imports : importedBy).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 opacity-40">
                      <Network className="w-8 h-8 mb-2 text-text-muted" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">No connections</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Global Insights View */
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b border-border bg-gradient-to-br from-bg-surface to-bg-base">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center border border-accent-blue/20">
                    <Network className="w-5 h-5 text-accent-blue" />
                  </div>
                  <button onClick={() => setRightPanelOpen(false)} className="p-2 hover:bg-bg-hover rounded-lg transition-colors">
                    <X className="w-4 h-4 text-text-muted" />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-text-primary leading-tight">Repository Insights</h2>
                <p className="text-xs text-text-muted mt-2 font-medium uppercase tracking-widest">Global Architecture Overview</p>
              </div>

              <div className="p-6 space-y-8 overflow-y-auto">
                {/* AI Answer from search query */}
                {aiAnswer && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-accent-blue" />
                      <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Query Answer</h3>
                    </div>
                    <div className="relative bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-4 pl-5 overflow-hidden mb-4">
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent-blue" />
                      <p className="text-[13px] text-text-secondary leading-relaxed">{aiAnswer}</p>
                    </div>

                    {relatedCommits.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Matched Latest Changes</p>
                        {relatedCommits.map((commit: any) => (
                          <div key={commit.commit_hash} className="bg-bg-elevated/40 border border-border/50 rounded-xl p-3 hover:border-accent-blue/30 transition-all group">
                            <div className="flex items-center gap-2 mb-1.5">
                              <GitCommit className="w-3 h-3 text-accent-blue" />
                              <span className="text-[11px] font-bold text-text-primary truncate">{commit.message}</span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-text-muted">
                              <span>{commit.author}</span>
                              <span className="font-mono opacity-60">{commit.commit_hash.slice(0, 7)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-accent-purple" />
                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Architecture Snapshot</h3>
                  </div>

                  <div className="space-y-6">
                    {repoInsights ? (
                      <div className="prose prose-invert max-w-none">
                        <div className="text-[13px] text-text-secondary leading-relaxed font-medium space-y-4 whitespace-pre-wrap">
                          {repoInsights}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-bg-elevated/30 border border-dashed border-border rounded-xl p-8 text-center">
                        <Spinner size="md" className="mx-auto mb-4 text-accent-blue" />
                        <p className="text-xs text-text-muted font-medium">Crunching architectural data...</p>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4">Project Composition</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-bg-elevated/40 border border-border/50 rounded-xl p-4">
                      <p className="text-[10px] text-text-muted uppercase font-bold mb-1">Files</p>
                      <p className="text-2xl font-black text-text-primary tabular-nums">{allNodes.length}</p>
                    </div>
                    <div className="bg-bg-elevated/40 border border-border/50 rounded-xl p-4">
                      <p className="text-[10px] text-text-muted uppercase font-bold mb-1">Deps</p>
                      <p className="text-2xl font-black text-text-primary tabular-nums">{allEdges.length}</p>
                    </div>
                  </div>
                </section>

                <section className="bg-bg-elevated/10 rounded-2xl border border-border/50">
                   {repoId && <IssueStats repoId={repoId} />}
                </section>
              </div>

              <div className="mt-auto p-6 border-t border-border bg-bg-base/30">
                <p className="text-[10px] text-text-muted text-center leading-relaxed">
                  Select any node in the graph for detailed component analysis.
                </p>
              </div>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
