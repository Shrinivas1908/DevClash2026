import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useStore } from '@/store';
import type { GraphData } from '@/types/graph';
import { IS_MOCK_MODE, MOCK_GRAPH_DATA } from '@/lib/mockData';

export function useGraphData(jobId: string, enabled: boolean) {
  const { setGraphData, addToast, nodes } = useStore();

  const query = useQuery({
    queryKey: ['graph', jobId],
    queryFn: async (): Promise<GraphData> => {
      if (IS_MOCK_MODE) return MOCK_GRAPH_DATA;
      return apiGet<GraphData>(`/api/graph/${jobId}`);
    },
    enabled: enabled && !!jobId,
    staleTime: Infinity,
    retry: 2,
  });

  useEffect(() => {
    if (query.data) {
      setGraphData(query.data);
      if (query.data.nodes.length > 500) {
        addToast({ type: 'warning', message: `Large repo (${query.data.nodes.length} files) — performance mode enabled` });
      }
    }
  }, [query.data, setGraphData, addToast]);

  return { isLoading: query.isLoading, error: query.error, nodeCount: nodes.length };
}
