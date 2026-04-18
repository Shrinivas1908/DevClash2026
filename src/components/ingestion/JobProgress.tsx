import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import { StageTimeline } from './StageTimeline';
import { Spinner } from '@/components/ui/Spinner';
import { extractRepoName } from '@/lib/utils';

export function JobProgress() {
  const currentJob = useStore((s) => s.currentJob);
  const isVisible = currentJob && (currentJob.status === 'pending' || currentJob.status === 'processing');

  const completedStages = currentJob?.stages.filter((s) => s.status === 'complete').length ?? 0;
  const totalStages = 4;
  const progress = (completedStages / totalStages) * 100;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="job-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(13,15,20,0.92)', backdropFilter: 'blur(4px)' }}
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-bg-elevated">
            <motion.div
              className="h-full bg-gradient-to-r from-accent-blue to-accent-purple"
              initial={{ width: '0%' }}
              animate={{ width: progress > 0 ? `${progress}%` : '15%' }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="bg-bg-surface border border-border rounded-2xl p-8 shadow-panel w-full max-w-md mx-4"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-accent-blue/30 flex items-center justify-center">
                <Spinner size="md" className="text-accent-blue" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">Scanning Repository</h2>
                <p className="text-xs text-text-muted font-mono truncate max-w-[240px]">
                  {currentJob ? extractRepoName(currentJob.repo_url) : ''}
                </p>
              </div>
            </div>

            <StageTimeline stages={currentJob?.stages ?? []} />

            <p className="mt-5 text-xs text-text-muted text-center">
              Extracting only structural metadata · No source code is read
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
