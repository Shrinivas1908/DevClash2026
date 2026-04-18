import { useState } from 'react';
import { motion } from 'framer-motion';
import { Network, Lock, ScanLine, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useJobSubmit } from '@/hooks/useJobSubmit';
import { validateGithubUrl } from '@/lib/utils';
import { IS_MOCK_MODE } from '@/lib/mockData';

import { useStore } from '@/store';

const FEATURE_BADGES = [
  { icon: Lock, label: 'Zero-Cost Mandate', color: 'text-accent-blue' },
  { icon: ScanLine, label: 'Scan-Only · No Full Clone', color: 'text-accent-blue' },
  { icon: Zap, label: 'Monolithic Speed', color: 'text-accent-blue' },
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
    await submit(url, task);
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-start pt-24 md:pt-40 px-4 relative overflow-hidden">
      {/* Background glow and effects */}
      <div className="absolute top-0 left-0 w-full h-full hero-glow pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-accent-blue/5 rounded-[100%] blur-[120px] pointer-events-none" />
      
      {/* Animated "Stars" or particles vibe */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-1 h-1 bg-white rounded-full animate-pulse" />
        <div className="absolute top-40 right-1/3 w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-1/3 left-1/2 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl relative z-10 flex flex-col items-center"
      >
        {/* Optional: Logo or subtle indicator */}
        <div className="flex items-center gap-3 mb-8 opacity-90 hover:opacity-100 transition-opacity">
          <Network className="w-8 h-8 text-accent-blue" />
          <span className="font-bold tracking-tighter text-3xl text-accent-blue">RepoMap</span>
        </div>

        <h1 className="hero-title mb-6 text-white">
          The future of code architecture <br className="hidden md:block" /> happens together
        </h1>

        <p className="hero-subtitle mb-12">
          Tools and trends evolve, but codebase clarity endures. With RepoMap, <br className="hidden md:block" />
          developers, architects, and code come together on one interactive platform.
        </p>

        {/* Professional Input Bar */}
        <div className="w-full max-w-3xl">
          <form onSubmit={handleSubmit} className="relative group">
            <div className={`
              flex flex-col md:flex-row items-stretch gap-2 p-1.5 bg-bg-surface/50 backdrop-blur-xl border rounded-2xl transition-all duration-300
              ${showError ? 'border-accent-red ring-4 ring-accent-red/10' : 'border-border group-hover:border-accent-blue/50 group-focus-within:border-accent-blue group-focus-within:ring-4 group-focus-within:ring-accent-blue/10'}
            `}>
              <div className="relative flex-grow flex items-center px-4 py-3 md:py-0">
                <ScanLine className="w-5 h-5 text-text-muted mr-3" />
                <input
                  id="repo-url-input"
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setTouched(false); }}
                  onBlur={() => setTouched(true)}
                  placeholder="Enter GitHub URL (e.g., https://github.com/owner/repo)"
                  className="w-full bg-transparent text-text-primary placeholder-text-muted outline-none text-base md:text-lg font-medium"
                />
              </div>

              <Button
                id="analyze-btn"
                type="submit"
                size="lg"
                loading={loading}
                className="rounded-xl px-8 py-4 md:py-0 bg-accent-blue hover:bg-blue-500 font-bold text-white shadow-lg shadow-accent-blue/20"
              >
                {loading ? 'Analyzing…' : 'Start Analysis'}
              </Button>
            </div>

            {showError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -bottom-8 left-4 text-sm text-accent-red flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4" />
                Please enter a valid GitHub repository URL
              </motion.div>
            )}
          </form>

          {/* Secondary Task Input */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-12 flex flex-col md:flex-row items-center justify-center gap-6"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted whitespace-nowrap">Assigned task:</span>
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g., 'Fix auth bug' (optional)"
                className="bg-bg-elevated/50 border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-muted transition-all outline-none focus:border-accent-blue/50 w-48 md:w-64"
              />
            </div>

            <div className="hidden md:block w-px h-4 bg-border" />

            {IS_MOCK_MODE && (
              <div className="flex items-center gap-2 text-accent-amber text-xs font-medium bg-accent-amber/10 px-3 py-1.5 rounded-full border border-accent-amber/20">
                <Zap className="w-3.5 h-3.5" />
                Demo Mode Active
              </div>
            )}
          </motion.div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-xs text-accent-red text-center bg-accent-red/10 py-2 px-4 rounded-lg border border-accent-red/20 mx-auto max-w-md"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-6 mt-20 justify-center">
          {FEATURE_BADGES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 group cursor-default"
            >
              <div className="w-12 h-12 rounded-2xl bg-bg-surface border border-border flex items-center justify-center transition-all duration-300 group-hover:border-accent-blue/50 group-hover:bg-bg-elevated group-hover:-translate-y-1">
                <Icon className="w-6 h-6 text-accent-blue" />
              </div>
              <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">{label}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-32 pt-8 border-t border-border w-full flex flex-col md:flex-row items-center justify-between text-[11px] text-text-muted uppercase tracking-widest gap-4">
          <span>Zero Cost · Zero Clone · Instant Architecture</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-accent-blue font-bold text-sm tracking-normal capitalize">QuardForge</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-text-secondary cursor-pointer transition-colors">Documentation</span>
            <span className="hover:text-text-secondary cursor-pointer transition-colors">GitHub</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
