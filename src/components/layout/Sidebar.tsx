import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Filter, Sparkles } from 'lucide-react';
import { useStore } from '@/store';
import { Badge, importanceBadge } from '@/components/ui/Badge';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { TaskNavigator } from '@/components/layout/TaskNavigator';
import type { FilterType } from '@/store/graphSlice';
import type { FileNodeData } from '@/types/graph';
import { cn } from '@/lib/utils';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'high-importance', label: 'High' },
  { key: 'entry', label: 'Entry' },
  { key: 'config', label: 'Config' },
];

function getFileIcon(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return '🟦';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return '🟨';
  if (path.endsWith('.py')) return '🐍';
  if (path.endsWith('.json')) return '📋';
  if (path.endsWith('.css')) return '🎨';
  if (path.endsWith('.md')) return '📝';
  return '📄';
}

export function Sidebar() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const searchQuery = useStore((s) => s.searchQuery);
  const searchResults = useStore((s) => s.searchResults);
  const activeFilter = useStore((s) => s.activeFilter);
  const setFilter = useStore((s) => s.setFilter);
  const allNodes = useStore((s) => s.allNodes);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const setRightPanelOpen = useStore((s) => s.setRightPanelOpen);
  const aiAnswer = useStore((s) => s.aiAnswer);

  const sortedFiles = [...allNodes]
    .map((n) => n.data as unknown as FileNodeData)
    .sort((a, b) => b.composite_importance - a.composite_importance)
    .slice(0, 20);

  const handleFileClick = (id: string) => {
    setSelectedNode(id);
    setRightPanelOpen(true);
  };

  return (
    <div className="relative flex h-full">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex-shrink-0 h-full bg-bg-surface border-r border-border overflow-hidden flex flex-col"
          >
            <div className="flex flex-col h-full overflow-hidden">
              {/* Search */}
              <div className="p-3 border-b border-border">
                <SearchBar />
              </div>

              {/* Filter chips */}
              <div className="px-3 py-2 flex gap-1.5 border-b border-border flex-shrink-0">
                <Filter className="w-3.5 h-3.5 text-text-muted mt-0.5 flex-shrink-0" />
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-xs font-medium transition-colors',
                      activeFilter === f.key
                        ? 'bg-accent-blue text-white'
                        : 'bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Content: search results or file list */}
              <div className="flex-1 overflow-y-auto">
                {searchQuery.trim() ? (
                  <div>
                    {/* AI Answer */}
                    {aiAnswer && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mx-3 mt-3 mb-1 p-3 bg-accent-purple/10 border border-accent-purple/20 rounded-xl"
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="w-3 h-3 text-accent-purple" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-accent-purple">AI Answer</span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed">{aiAnswer}</p>
                      </motion.div>
                    )}
                    <SearchResults results={searchResults} />
                  </div>
                ) : (
                  <div>
                    <p className="px-3 py-2 text-xs text-text-muted font-medium uppercase tracking-wide">
                      Top Files by Importance
                    </p>
                    {sortedFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleFileClick(file.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors group text-left"
                      >
                        <span className="flex-shrink-0 text-sm">{getFileIcon(file.path)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                            {file.name}
                          </p>
                          <p className="text-xs text-text-muted truncate font-mono">
                            {file.path.replace(file.name, '')}
                          </p>
                        </div>
                        <Badge variant={importanceBadge(file.composite_importance)} className="flex-shrink-0">
                          {file.composite_importance}
                        </Badge>
                      </button>
                    ))}

                    {sortedFiles.length === 0 && (
                      <div className="px-3 py-8 text-center">
                        <p className="text-text-muted text-sm">No files loaded yet</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Task Focus Assistant at the bottom */}
              <TaskNavigator />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-10 bg-bg-elevated border border-border rounded-r-lg flex items-center justify-center hover:bg-bg-hover transition-colors"
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <motion.div animate={{ rotate: sidebarOpen ? 0 : 180 }}>
          <ChevronLeft className="w-3 h-3 text-text-muted" />
        </motion.div>
      </button>
    </div>
  );
}
