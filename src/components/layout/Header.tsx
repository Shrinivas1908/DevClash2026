import { GitBranch, Wifi, WifiOff, Network } from 'lucide-react';
import { useStore } from '@/store';
import { Badge } from '@/components/ui/Badge';
import { extractRepoName, cn } from '@/lib/utils';
import { AiQueryBar } from '@/components/search/AiQueryBar';

export function Header() {
  const currentJob = useStore((s) => s.currentJob);
  const isOffline = useStore((s) => s.isOffline);
  const currentView = useStore((s) => s.currentView);
  const setCurrentView = useStore((s) => s.setCurrentView);

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-bg-surface border-b border-border z-40 flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20">
          <Network className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-xs text-text-primary tracking-tight leading-none uppercase">RepoMap</span>
          <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Production Beta</span>
        </div>
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
      <div className="flex-1 flex justify-center max-w-lg gap-4">
        <AiQueryBar />
        
        <div className="flex bg-bg-base/50 p-1 rounded-lg border border-border">
          <button
            onClick={() => setCurrentView('graph')}
            className={cn(
              "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
              currentView === 'graph' ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/20" : "text-text-muted hover:text-text-primary"
            )}
          >
            Graph
          </button>
          <button
            onClick={() => setCurrentView('stats')}
            className={cn(
              "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
              currentView === 'stats' ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/20" : "text-text-muted hover:text-text-primary"
            )}
          >
            Stats
          </button>
        </div>
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
