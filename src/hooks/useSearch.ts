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
  // Use the real repo UUID stored in graphSlice after graph is loaded
  const repoId = useStore((s) => s.repoId);

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
          setAiAnswer(null);
        } else {
          // Use repoId (from repos table) if available; fallback to jobId
          const targetId = repoId || jobId;
          if (!targetId) {
            setIsSearching(false);
            return;
          }
          const response = await apiPost<{
            files: SearchResult[];
            explanation: string;
            keywords: string[];
            related_commits?: any[];
          }>(`/api/repo/${targetId}/query`, { question: q });

          // Backend now returns SearchResult-compatible objects directly
          results = response.files;
          setAiAnswer(response.explanation || null, response.related_commits || []);
        }
        setSearchResults(results);
      } catch (err) {
        console.error('[useSearch] Error:', err);
        setSearchResults([]);
        setAiAnswer(null);
      } finally {
        setIsSearching(false);
      }
    }, 400),
    [repoId, jobId, setSearchResults, setIsSearching, setAiAnswer],
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  return { searchQuery, setSearchQuery };
}
