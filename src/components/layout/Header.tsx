import { GitBranch, Wifi, WifiOff, Network } from 'lucide-react';
import { useStore } from '@/store';
import { Badge } from '@/components/ui/Badge';
import { extractRepoName } from '@/lib/utils';
import { AiQueryBar } from '@/components/search/AiQueryBar';

export function Header() {
  const currentJob = useStore((s) => s.currentJob);
  const isOffline = useStore((s) => s.isOffline);

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-bg-surface border-b border-border z-40 flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
          <Network className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-text-primary tracking-tight">RAN</span>
      </div>

      {/* Repo context */}
      {currentJob && (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-border">|</span>
          <span className="text-text-secondary text-sm font-mono truncate">
            {extractRepoName(currentJob.repo_url)}
          </span>
          <Badge variant="muted">
            <GitBranch className="w-3 h-3" />
            main
          </Badge>
          <Badge variant={currentJob.status === 'complete' ? 'green' : currentJob.status === 'failed' ? 'red' : 'blue'} dot>
            {currentJob.status}
          </Badge>
        </div>
      )}

      {/* AI Query Bar - Centered */}
      <div className="flex-1 flex justify-center max-w-lg">
        <AiQueryBar />
      </div>

      <div className="flex-1 flex justify-end">
        {/* Offline indicator */}
        {isOffline ? (
          <div className="flex items-center gap-1.5 text-accent-amber text-xs">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <Wifi className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </header>
  );
}
