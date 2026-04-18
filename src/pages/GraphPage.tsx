import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { useStore } from '@/store';
import { useJobRealtime } from '@/hooks/useJobRealtime';
import { useGraphData } from '@/hooks/useGraphData';
import { useSearch } from '@/hooks/useSearch';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { RightPanel } from '@/components/layout/RightPanel';
import { ArchGraph } from '@/components/graph/ArchGraph';
import { JobProgress } from '@/components/ingestion/JobProgress';
import { StatsContainer } from '@/components/analytics/StatsContainer';
import { Button } from '@/components/ui/Button';
import { IS_MOCK_MODE, MOCK_JOB } from '@/lib/mockData';

export function GraphPage() {
  const { jobId = '' } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  // Use individual selectors to avoid re-render on unrelated state changes
  // and to be more compliant with React hook rules in complex components.
  const currentJob = useStore((s) => s.currentJob);
  const setJob = useStore((s) => s.setJob);
  const compactMode = useStore((s) => s.compactMode);
  const setIsOffline = useStore((s) => s.setIsOffline);
  const currentView = useStore((s) => s.currentView);

  // Load mock job if in demo mode
  useEffect(() => {
    if (IS_MOCK_MODE && !currentJob) {
      setJob(MOCK_JOB);
    }
  }, [IS_MOCK_MODE, currentJob, setJob]);

  // Realtime subscription
  useJobRealtime(jobId);

  // Fetch graph when job is complete
  const isComplete = currentJob?.status === 'complete';
  useGraphData(jobId, isComplete);

  // Search
  useSearch(jobId);

  // Offline detection
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { 
      window.removeEventListener('online', onOnline); 
      window.removeEventListener('offline', onOffline); 
    };
  }, [setIsOffline]);

  if (currentJob?.status === 'failed') {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="bg-bg-surface border border-accent-red/30 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <AlertTriangle className="w-10 h-10 text-accent-red mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Analysis Failed</h2>
          <p className="text-sm text-text-muted mb-6">
            {currentJob.error_message ?? 'An error occurred while scanning the repository.'}
          </p>
          <Button onClick={() => navigate('/')} icon={<RefreshCw className="w-4 h-4" />}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-base overflow-hidden">
      <Header />

      {/* Large repo warning */}
      <AnimatePresence>
        {compactMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-12 bg-accent-amber/10 border-b border-accent-amber/20 px-4 py-1.5"
          >
            <p className="text-xs text-accent-amber text-center">
              ⚡ Large repo detected — Performance mode enabled (compact labels)
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className={`flex flex-1 overflow-hidden ${compactMode ? '' : 'mt-12'}`} style={{ marginTop: compactMode ? undefined : '48px' }}>
        <ReactFlowProvider>
          {currentView === 'graph' ? (
            <>
              <Sidebar />
              <div className="flex-1 relative overflow-hidden">
                <ArchGraph />
                <JobProgress />
              </div>
              <RightPanel />
            </>
          ) : (
            <StatsContainer />
          )}
        </ReactFlowProvider>
      </div>
    </div>
  );
}
