import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { useStore } from '@/store';
import type { JobCreateResponse } from '@/types/job';
import { IS_MOCK_MODE, MOCK_JOB } from '@/lib/mockData';

export function useJobSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setJob, addToast } = useStore();

  const submit = async (repoUrl: string, taskDescription?: string) => {
    setLoading(true);
    setError(null);

    // Demo / mock mode
    if (IS_MOCK_MODE) {
      await new Promise((r) => setTimeout(r, 800));
      setJob({ ...MOCK_JOB, repo_url: repoUrl, id: 'mock-job-001' });
      navigate('/graph/mock-job-001');
      setLoading(false);
      return;
    }

    let retries = 0;
    const maxRetries = 6;

    const attempt = async (): Promise<void> => {
      try {
        const data = await apiPost<JobCreateResponse>('/api/jobs', { 
          repo_url: repoUrl,
          task_description: taskDescription 
        });

        
        // Initialize the job state locally so the GraphPage has something to start with
        setJob({
          id: data.jobId,
          repo_url: repoUrl,
          status: 'pending',
          stages: [
            { stage: 1, name: 'Repo Ingestion', status: 'waiting', started_at: null, completed_at: null },
            { stage: 2, name: 'Static Analysis', status: 'waiting', started_at: null, completed_at: null },
            { stage: 3, name: 'Commit Analysis', status: 'waiting', started_at: null, completed_at: null },
            { stage: 4, name: 'AI Summaries', status: 'waiting', started_at: null, completed_at: null },
          ],
          graph_json: null,
          created_at: new Date().toISOString(),
        });

        navigate(`/graph/${data.jobId}`);
      } catch (err) {
        const e = err as Error;
        if (retries === 0) {
          addToast({ type: 'persistent', message: 'Backend is waking up… retrying in 5s' });
        }
        if (retries < maxRetries) {
          retries++;
          await new Promise((r) => setTimeout(r, 5000));
          return attempt();
        }
        setError(e.message || 'Failed to submit repository');
      }
    };

    await attempt();
    setLoading(false);
  };

  return { submit, loading, error };
}
