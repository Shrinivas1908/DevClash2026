import { useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { apiPost } from '@/lib/api';
import { debounce } from '@/lib/utils';
import type { SearchResult } from '@/types/search';
import { IS_MOCK_MODE, MOCK_SEARCH_RESULTS } from '@/lib/mockData';

export function useSearch(jobId: string) {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchResults = useStore((s) => s.setSearchResults);
  const setIsSearching = useStore((s) => s.setIsSearching);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const setAiAnswer = useStore((s) => s.setAiAnswer);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        setAiAnswer(null);
        return;
      }
      setIsSearching(true);
      try {
        let results: SearchResult[];
        if (IS_MOCK_MODE) {
          await new Promise((r) => setTimeout(r, 200));
          results = MOCK_SEARCH_RESULTS.filter((r) =>
            r.path.toLowerCase().includes(q.toLowerCase()),
          );
        } else {
          const response = await apiPost<{
            files: any[];
            explanation: string;
            keywords: string[];
          }>(`/api/repo/${jobId}/query`, { question: q });
          
          results = response.files.map((f: any) => ({
            id: f.id,
            path: f.file_path,
            rank: f.rank,
            summary: f.summary
          })) as SearchResult[];
          
          setAiAnswer(response.explanation);
        }
        setSearchResults(results);
      } catch (err) {
        console.error('[useSearch] Error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [jobId, setSearchResults, setIsSearching, setAiAnswer],
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  return { searchQuery, setSearchQuery };
}
