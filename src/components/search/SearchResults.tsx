import { useStore } from '@/store';
import { Badge, importanceBadge } from '@/components/ui/Badge';
import type { SearchResult } from '@/types/search';

interface SearchResultsProps {
  results: SearchResult[];
}

export function SearchResults({ results }: SearchResultsProps) {
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const setRightPanelOpen = useStore((s) => s.setRightPanelOpen);
  const searchQuery = useStore((s) => s.searchQuery);
  const isSearching = useStore((s) => s.isSearching);

  if (isSearching) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-text-muted">Searching…</p>
      </div>
    );
  }

  if (!searchQuery.trim()) return null;

  if (results.length === 0) {
    return (
      <div className="px-3 py-6 text-center">
        <p className="text-xs text-text-muted">No results for &quot;{searchQuery}&quot;</p>
      </div>
    );
  }

  const handleClick = (result: SearchResult) => {
    setSelectedNode(result.file_id);
    setRightPanelOpen(true);
  };

  return (
    <div>
      <p className="px-3 py-2 text-xs text-text-muted font-medium uppercase tracking-wide">
        {results.length} result{results.length !== 1 ? 's' : ''}
      </p>
      {results.map((result) => (
        <button
          key={result.file_id}
          onClick={() => handleClick(result)}
          className="w-full flex flex-col gap-1 px-3 py-2.5 hover:bg-bg-hover transition-colors text-left border-b border-border/50 last:border-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary truncate flex-1">{result.path}</span>
            <Badge variant={importanceBadge(result.importance)} className="flex-shrink-0">
              {result.importance}
            </Badge>
          </div>
          {/* tsvector highlighted snippet — backend returns <b> tags */}
          <p
            className="text-xs text-text-muted leading-snug"
            dangerouslySetInnerHTML={{ __html: result.headline }}
          />
        </button>
      ))}
    </div>
  );
}
