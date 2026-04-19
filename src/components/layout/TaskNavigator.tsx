import { useState } from 'react';
import { Target, Search, FileCode, } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import { IS_MOCK_MODE, MOCK_TASK_MAP, MOCK_FILES } from '@/lib/mockData';
import { Badge, importanceBadge } from '@/components/ui/Badge';

export function TaskNavigator() {
  const _currentJob = useStore((s) => s.currentJob);
  const userTask = useStore((s) => s.userTask);
  const setUserTask = useStore((s) => s.setUserTask);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const setRightPanelOpen = useStore((s) => s.setRightPanelOpen);

  const [task, setTask] = useState(userTask);

  const handleTaskChange = (val: string) => {
    setTask(val);
    setUserTask(val);
  };

  // Find recommendations based on keywords in task
  const keywords = task.toLowerCase().split(/\s+/).filter(Boolean);

  const allNodes = useStore((s) => s.allNodes);

  let recommendedFiles: any[] = [];

  if (IS_MOCK_MODE) {
    const recommendedIds = new Set<string>();
    keywords.forEach(kw => {
      Object.entries(MOCK_TASK_MAP).forEach(([key, ids]) => {
        if (kw.includes(key) || key.includes(kw)) {
          ids.forEach(id => recommendedIds.add(id));
        }
      });
    });
    recommendedFiles = MOCK_FILES.filter(f => recommendedIds.has(f.id));
  } else {
    // Pull from the graph store which is populated by useGraphData hook
    const realFiles = allNodes.map(n => n.data as any) || [];
    if (keywords.length > 0) {
      recommendedFiles = realFiles.filter(f =>
        keywords.some(kw => f.path.toLowerCase().includes(kw) || f.name.toLowerCase().includes(kw))
      ).slice(0, 15);
    } else {
      // If no task is entered, show top 10 most important files
      recommendedFiles = [...realFiles].sort((a, b) => b.composite_importance - a.composite_importance).slice(0, 10);
    }
  }

  return (
    <div className="flex flex-col border-t border-border mt-auto bg-bg-surface shadow-[0_-8px_16px_rgba(0,0,0,0.2)]">
      <div className="p-4 border-b border-border bg-bg-surface/50">
        <div className="flex items-center gap-2 mb-3 text-accent-blue">
          <Target className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.15em]">Task Navigator</span>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted group-focus-within:text-accent-blue transition-colors" />
          <input
            type="text"
            value={task}
            onChange={(e) => handleTaskChange(e.target.value)}
            placeholder="Search files or describe task..."
            className="w-full bg-bg-base border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-blue/50 focus:ring-4 focus:ring-accent-blue/5 focus:bg-bg-elevated transition-all"
          />
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {task.trim() && recommendedFiles.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-2 space-y-1"
            >
              <div className="px-2 py-2 mb-1">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Recommended Components</span>
              </div>
              {recommendedFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => { setSelectedNode(file.id); setRightPanelOpen(true); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover rounded-xl transition-all group text-left relative overflow-hidden"
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0 group-hover:bg-accent-blue/10 transition-colors">
                    <FileCode className="w-4 h-4 text-text-muted group-hover:text-accent-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-text-primary truncate group-hover:text-accent-blue transition-colors">
                      {file.name}
                    </p>
                    <p className="text-[9px] text-text-muted truncate font-mono opacity-60">
                      {file.path}
                    </p>
                  </div>
                  <Badge variant={importanceBadge(file.composite_importance)} className="scale-90 origin-right font-bold tabular-nums">
                    {file.composite_importance}
                  </Badge>
                </button>
              ))}
            </motion.div>
          ) : task.trim() ? (
            <div className="p-4 text-center">
              <p className="text-[11px] text-text-muted">No specific files identified for this task keywords.</p>
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-[11px] text-text-muted italic">Enter your task above to get file recommendations.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
