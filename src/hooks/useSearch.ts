import { useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { apiGet } from '@/lib/api';
import { debounce } from '@/lib/utils';
import type { SearchResult } from '@/types/search';
import { IS_MOCK_MODE, MOCK_SEARCH_RESULTS } from '@/lib/mockData';

export function useSearch(jobId: string) {
  const { searchQuery, setSearchResults, setIsSearching, setSearchQuery } = useStore();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        setIsSearching(false);
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
          results = await apiGet<SearchResult[]>(
            `/api/search?q=${encodeURIComponent(q)}&jobId=${jobId}`,
          );
        }
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [jobId],
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  return { searchQuery, setSearchQuery };
}
