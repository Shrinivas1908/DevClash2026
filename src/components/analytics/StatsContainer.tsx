import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { AIInsightsPanel } from './AIInsightsPanel';
import { useStore } from '@/store';
import { BarChart3, Clock, GitCommit, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

interface IssueStat {
  issue: string;
  count: number;
  latest_commit: {
    hash: string;
    message: string;
    author: string;
    authored_at: string;
  } | null;
}

export function StatsContainer() {
  const repoId = useStore((s) => s.repoId);
  const [debouncedRepoId, setDebouncedRepoId] = useState(repoId);

  // Debounce repoId changes (300-500ms as requested)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRepoId(repoId);
    }, 400);
    return () => clearTimeout(timer);
  }, [repoId]);

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['job-detail', debouncedRepoId],
    queryFn: () => apiGet<any>(`/api/jobs/${debouncedRepoId}`),
    enabled: !!debouncedRepoId,
  });

  const realRepoId = job?.repo_id || null;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['issue-stats-full', realRepoId],
    queryFn: () => apiGet<IssueStat[]>(`/api/repo/${realRepoId}/stats/issues`),
    enabled: !!realRepoId,
    refetchInterval: 60000, // Live sync every minute
  });

  if (!repoId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
        <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
        <p>No repository analysis active.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base custom-scrollbar">
      <div className="max-w-6xl mx-auto p-8 space-y-12">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-accent-blue">
            <BarChart3 className="w-5 h-5" />
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">Repository Activity & AI Insights</h1>
          </div>
          <p className="text-text-muted text-sm max-w-2xl">
            Real-time analysis of repository velocity and architectural patterns derived from commit history and AI context.
          </p>
        </header>

        {/* AI Insights Section */}
        <section className="space-y-6">
          <AIInsightsPanel context={job?.ai_context || null} />
        </section>

        {/* Commit Activity Section */}
        <section className="space-y-6">
          <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] px-2 flex items-center gap-2">
            <GitCommit className="w-3 h-3" />
            Active Architectural Hotspots & Latest Commits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {stats?.map((stat, idx) => (
              <motion.div
                key={stat.issue}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-bg-surface border border-border rounded-xl p-5 hover:border-accent-blue/30 transition-all group shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-accent-blue truncate max-w-[70%]">{stat.issue}</span>
                    <span className="text-[10px] font-bold text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">{stat.count} activities</span>
                  </div>
                  {stat.latest_commit && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <GitCommit className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
                        <p className="text-[11px] text-text-primary font-medium line-clamp-2 leading-relaxed">{stat.latest_commit.message}</p>
                      </div>
                    </div>
                  )}
                </div>
                {stat.latest_commit && (
                  <div className="flex items-center justify-between text-[9px] text-text-muted mt-4 pt-4 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-accent-blue/10 flex items-center justify-center text-[8px] font-bold text-accent-blue border border-accent-blue/20">
                        {stat.latest_commit.author[0]}
                      </div>
                      {stat.latest_commit.author}
                    </div>
                    <div className="flex items-center gap-1 opacity-60">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDistanceToNow(new Date(stat.latest_commit.authored_at), { addSuffix: true })}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          {(!stats || stats.length === 0) && !statsLoading && (
            <div className="h-32 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-2xl bg-bg-surface/30">
              <p className="text-xs text-text-muted">No activity data available yet.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
