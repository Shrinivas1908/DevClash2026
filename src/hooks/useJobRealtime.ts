import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import type { Job, PipelineStage } from '@/types/job';
import { IS_MOCK_MODE } from '@/lib/mockData';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export function useJobRealtime(jobId: string) {
  const updateJob = useStore((s) => s.updateJob);
  const setIsLiveConnected = useStore((s) => s.setIsLiveConnected);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (IS_MOCK_MODE || !jobId || jobId === 'mock-job-001') {
      return;
    }

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      console.log(`[useJobRealtime] Connecting to SSE: /api/jobs/${jobId}/stream`);
      const es = new EventSource(`${API_BASE}/api/jobs/${jobId}/stream`);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[useJobRealtime] SSE Connected');
        setIsLiveConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[useJobRealtime] Received update:', data);

          // Map backend job status to frontend types
          const statusMap: Record<string, string> = {
            pending: 'pending',
            running: 'processing',
            done: 'complete',
            error: 'failed',
          };

          // Reconstruct the stages array
          const stages: PipelineStage[] = [1, 2, 3, 4].map((stageNum) => ({
            stage: stageNum,
            name: ['Repo Ingestion', 'Static Analysis', 'Commit Analysis', 'AI Summaries'][stageNum - 1],
            status:
              data.stage > stageNum
                ? 'complete'
                : data.stage === stageNum
                ? data.status === 'error'
                  ? 'failed'
                  : 'running'
                : 'waiting',
            started_at: null,
            completed_at: null,
          }));

          updateJob({
            id: data.id,
            status: (statusMap[data.status] || data.status) as any,
            stages,
            progress: data.progress,
            error_message: data.error_message,
            updated_at: data.updated_at,
          } as Partial<Job> as Job);

          if (data.status === 'done' || data.status === 'error') {
            console.log('[useJobRealtime] Job finished, closing SSE');
            es.close();
            setIsLiveConnected(false);
          }
        } catch (err) {
          console.error('[useJobRealtime] Error parsing SSE message:', err);
        }
      };

      es.onerror = (err) => {
        console.warn('[useJobRealtime] SSE Error:', err);
        setIsLiveConnected(false);
        es.close();

        // Auto-reconnect after 3 seconds if not finished
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setIsLiveConnected(false);
    };
  }, [jobId, updateJob, setIsLiveConnected]);
}
