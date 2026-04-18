import { useState } from 'react';
import { Target, Search, FileCode, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import { MOCK_TASK_MAP, MOCK_FILES } from '@/lib/mockData';
import { Badge, importanceBadge } from '@/components/ui/Badge';

export function TaskNavigator() {
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
  const keywords = task.toLowerCase().split(/\s+/);
  const recommendedIds = new Set<string>();
  
  keywords.forEach(kw => {
    Object.entries(MOCK_TASK_MAP).forEach(([key, ids]) => {
      if (kw.includes(key) || key.includes(kw)) {
        ids.forEach(id => recommendedIds.add(id));
      }
    });
  });

  const recommendedFiles = MOCK_FILES.filter(f => recommendedIds.has(f.id));

  return (
    <div className="flex flex-col border-t border-border mt-auto bg-bg-surface">
      <div className="p-3 border-b border-border bg-bg-surface/50">
        <div className="flex items-center gap-2 mb-2 text-accent-blue font-semibold text-[10px] uppercase tracking-wider">
          <Target className="w-3.5 h-3.5" />
          Task Focus Assistant
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
          <input
            type="text"
            value={task}
            onChange={(e) => handleTaskChange(e.target.value)}
            placeholder="Describe your task (e.g. 'Auth changes')"
            className="w-full bg-bg-elevated border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue transition-all"
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {task.trim() && recommendedFiles.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="px-3 py-2 text-[10px] text-text-muted font-medium uppercase tracking-wide">
                Suggested Files ({recommendedFiles.length})
              </p>
              {recommendedFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => { setSelectedNode(file.id); setRightPanelOpen(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover transition-colors group text-left border-b border-border/30 last:border-0"
                >
                  <FileCode className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                      {file.name}
                    </p>
                    <p className="text-[9px] text-text-muted truncate font-mono">
                      {file.path}
                    </p>
                  </div>
                  <Badge variant={importanceBadge(file.composite_importance)} className="scale-75 origin-right">
                    {file.composite_importance}
                  </Badge>
                  <ChevronRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
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
