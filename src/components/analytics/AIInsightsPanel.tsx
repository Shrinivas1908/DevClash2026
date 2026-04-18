import { Sparkles, Info, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

interface AIContext {
  summary: string;
  role: string;
  issues: string[];
}

export function AIInsightsPanel({ context }: { context: AIContext | null }) {
  if (!context) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-2 bg-gradient-to-br from-bg-surface to-bg-base border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-purple/5 blur-3xl -mr-16 -mt-16" />
        
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-accent-purple" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-[0.2em]">Architectural Context</h3>
        </div>
        
        <p className="text-[14px] text-text-secondary leading-relaxed font-medium whitespace-pre-wrap">
          {context.summary}
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col gap-6"
      >
        <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-accent-blue" />
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Project Role</h3>
          </div>
          <p className="text-xl font-bold text-text-primary capitalize">{context.role}</p>
          <p className="text-xs text-text-muted mt-1">Primary architectural responsibility</p>
        </div>

        <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-xl flex-1">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-accent-green" />
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Identified Themes</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {context.issues.map((issue, idx) => (
              <span 
                key={idx}
                className="px-2.5 py-1 rounded-full bg-accent-green/10 border border-accent-green/20 text-[11px] font-bold text-accent-green"
              >
                {issue}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
