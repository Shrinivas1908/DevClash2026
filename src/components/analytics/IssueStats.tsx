import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiGet } from '@/lib/api';
import { BarChart3, Clock, User, GitCommit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

export function IssueStats({ repoId }: { repoId: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['issue-stats', repoId],
    queryFn: () => apiGet<IssueStat[]>(`/api/repo/${repoId}/stats/issues`),
    enabled: !!repoId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-bg-elevated/50 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
        <BarChart3 className="w-8 h-8 mb-2 opacity-20" />
        <p className="text-xs">No issue references found in commits.</p>
        <p className="text-[10px] mt-1 opacity-60">Try adding #issue tags to your commit messages.</p>
      </div>
    );
  }

  const maxCount = Math.max(...stats.map((s) => s.count));

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 text-accent-blue mb-4">
        <BarChart3 className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.15em]">Issue Velocity Analysis</span>
      </div>

      <div className="space-y-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.issue}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group"
          >
            <div className="flex justify-between items-end mb-1.5 px-1">
              <span className="text-xs font-bold text-text-primary group-hover:text-accent-blue transition-colors">
                {stat.issue}
              </span>
              <span className="text-[10px] font-mono text-text-muted">
                {stat.count} commits
              </span>
            </div>
            
            <div className="relative h-2 bg-bg-elevated rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(stat.count / maxCount) * 100}%` }}
                transition={{ duration: 1, delay: idx * 0.1, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-blue/40 to-accent-blue rounded-full shadow-[0_0_12px_rgba(59,130,246,0.3)]"
              />
            </div>

            {stat.latest_commit && (
              <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                className="mt-3 ml-2 pl-3 border-l-2 border-border/50 space-y-2"
              >
                <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                  <GitCommit className="w-3 h-3 text-accent-blue" />
                  <span className="font-medium truncate">{stat.latest_commit.message}</span>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-text-muted">
                  <div className="flex items-center gap-1">
                    <User className="w-2.5 h-2.5" />
                    {stat.latest_commit.author}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatDistanceToNow(new Date(stat.latest_commit.authored_at), { addSuffix: true })}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
