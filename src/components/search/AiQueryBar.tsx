import { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { askAiMock } from '@/lib/mockData';

export function AiQueryBar() {
  const [query, setQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close answer on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAnswer(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsAsking(true);
    setAnswer(null);

    // Simulated AI thinking
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setAnswer(askAiMock(query));
    setIsAsking(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-sm ml-4">
      <form onSubmit={handleAsk} className="relative flex items-center group">
        <Sparkles className="absolute left-3 w-3.5 h-3.5 text-accent-purple group-focus-within:text-accent-blue transition-colors" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask AI where code is handled..."
          className="w-full bg-bg-elevated border border-border rounded-full pl-9 pr-10 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-all"
        />
        <div className="absolute right-1 flex items-center gap-1">
          {query && !isAsking && (
            <button
              id="clear-query-btn"
              type="button"
              onClick={() => { setQuery(''); setAnswer(null); }}
              className="p-1 hover:bg-bg-hover rounded-full transition-colors"
            >
              <X className="w-3 h-3 text-text-muted" />
            </button>
          )}
          <button
            type="submit"
            disabled={!query.trim() || isAsking}
            className="p-1 px-2 bg-gradient-to-r from-accent-blue to-accent-purple text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:grayscale transition-all"
          >
            {isAsking ? <Loader className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {answer && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full mt-2 left-0 right-0 bg-bg-surface border border-accent-purple/30 rounded-xl p-4 shadow-panel z-50 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-accent-purple" />
            <div className="flex items-center gap-2 mb-2 text-accent-purple font-semibold text-[10px] uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              AI Insights
            </div>
            <p className="text-xs text-text-secondary leading-relaxed bg-accent-purple/5 p-2 rounded">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
