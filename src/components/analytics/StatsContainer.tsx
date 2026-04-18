import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { IssueBarChart } from './IssueBarChart';
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
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">Issue Statistics & AI Insights</h1>
          </div>
          <p className="text-text-muted text-sm max-w-2xl">
            Real-time analysis of repository velocity and architectural patterns derived from commit history and AI context.
          </p>
        </header>

        {/* AI Insights Section */}
        <section className="space-y-6">
          <AIInsightsPanel context={job?.ai_context || null} />
        </section>

        {/* Charts Section */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <IssueBarChart data={stats?.map(s => ({ issue: s.issue, count: s.count })) || []} />
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] px-2">Latest Commit Match-Making</h3>
            <div className="space-y-3">
              {stats?.slice(0, 5).map((stat, idx) => (
                <motion.div
                  key={stat.issue}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-bg-surface border border-border rounded-xl p-4 hover:border-accent-blue/30 transition-all group shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-accent-blue">{stat.issue}</span>
                    <span className="text-[10px] font-bold text-text-muted">{stat.count} commits</span>
                  </div>
                  {stat.latest_commit && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <GitCommit className="w-3 h-3 text-text-muted" />
                        <p className="text-[11px] text-text-primary font-medium truncate">{stat.latest_commit.message}</p>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-text-muted">
                        <div className="flex items-center gap-1">
                          <User className="w-2.5 h-2.5" />
                          {stat.latest_commit.author}
                        </div>
                        <div className="flex items-center gap-1 opacity-60">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDistanceToNow(new Date(stat.latest_commit.authored_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
