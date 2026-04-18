import { useEffect, useRef } from 'react';
import { apiGet } from '@/lib/api';
import { useStore } from '@/store';
import type { Job } from '@/types/job';
import { IS_MOCK_MODE } from '@/lib/mockData';

export function useJobRealtime(jobId: string) {
  const { updateJob } = useStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = () => {
    if (pollRef.current) return;
    
    const poll = async () => {
      try {
        const job = await apiGet<Job>(`/api/jobs/${jobId}`);
        updateJob(job);
        if (job.status === 'complete' || job.status === 'failed') {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (err) {
        console.warn('[useJobRealtime] Poll failed:', err);
      }
    };

    // Poll immediately on start
    poll();
    pollRef.current = setInterval(poll, 3000);
  };

  useEffect(() => {
    if (IS_MOCK_MODE || !jobId || jobId === 'mock-job-001') {
      // For mock mode, the job is already 'complete' in MOCK_JOB
      // If we wanted to simulate 'processing' -> 'complete', we'd do it here
      return;
    }

    startPolling();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);
}
