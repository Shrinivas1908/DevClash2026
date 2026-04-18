import { useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Lock, ScanLine, Zap, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useJobSubmit } from '@/hooks/useJobSubmit';
import { validateGithubUrl } from '@/lib/utils';
import { IS_MOCK_MODE } from '@/lib/mockData';

import { useStore } from '@/store';

const FEATURE_BADGES = [
  { icon: Lock, label: 'Zero-Cost Mandate', color: 'text-accent-green' },
  { icon: ScanLine, label: 'Scan-Only · No Full Clone', color: 'text-accent-blue' },
  { icon: Zap, label: 'Monolithic Speed', color: 'text-accent-amber' },
];

export function LandingPage() {
  const [url, setUrl] = useState('');
  const [task, setTask] = useState('');
  const [touched, setTouched] = useState(false);
  const { submit, loading, error } = useJobSubmit();
  const setUserTask = useStore((s) => s.setUserTask);

  const isValid = validateGithubUrl(url);
  const showError = touched && url.length > 0 && !isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    setUserTask(task);
    await submit(url);
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-blue/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent-purple/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Demo mode banner */}
        {IS_MOCK_MODE && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 bg-accent-amber/10 border border-accent-amber/30 rounded-lg px-4 py-2.5 mb-6 text-xs text-accent-amber"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              <strong>Demo mode</strong> — no backend configured. Using realistic mock data.
            </span>
          </motion.div>
        )}

        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-glow">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Repository Architecture Navigator
            </h1>
          </div>
        </div>

        <p className="text-sm text-text-secondary mb-8 leading-relaxed">
          Engineering a Zero-Cost Developer Onboarding System Under Strict Architectural Constraints.
          Transforms any GitHub repository into an interactive dependency graph.
        </p>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              id="repo-url-input"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setTouched(false); }}
              onBlur={() => setTouched(true)}
              placeholder="https://github.com/owner/repository"
              autoComplete="url"
              spellCheck={false}
              className={`
                w-full bg-bg-elevated border rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder-text-muted
                transition-all duration-200 outline-none font-mono
                focus:ring-2 focus:ring-accent-blue/25 focus:border-accent-blue
                ${showError ? 'border-accent-red focus:border-accent-red focus:ring-accent-red/20' : 'border-border hover:border-border'}
              `}
            />
            {showError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-xs text-accent-red flex items-center gap-1.5"
              >
                <AlertCircle className="w-3 h-3" />
                Enter a valid GitHub URL: https://github.com/owner/repo
              </motion.p>
            )}
          </div>

          <div className="relative">
            <input
              id="task-input"
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Your assigned task (e.g., 'Auth cleanup')"
              className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder-text-muted transition-all duration-200 outline-none focus:ring-2 focus:ring-accent-purple/25 focus:border-accent-purple"
            />
            <p className="mt-1.5 text-[10px] text-text-muted px-1">
              Optional: Helps identify the most relevant files for you.
            </p>
          </div>

          <Button
            id="analyze-btn"
            type="submit"
            size="lg"
            loading={loading}
            className="w-full rounded-xl"
            icon={<ArrowRight className="w-4 h-4" />}
          >
            {loading ? 'Submitting…' : 'Analyze Repository'}
          </Button>

          {error && (
            <p className="text-xs text-accent-red text-center">{error}</p>
          )}
        </form>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2 mt-6 justify-center">
          {FEATURE_BADGES.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 bg-bg-elevated border border-border rounded-full px-3 py-1.5 text-xs text-text-secondary"
            >
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              {label}
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-text-muted mt-8">
          Scans only navigation metadata · No source code is stored · Zero cost
        </p>
      </motion.div>
    </div>
  );
}
