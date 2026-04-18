import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '@/store';
import { Spinner } from '@/components/ui/Spinner';

export function SearchBar() {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const isSearching = useStore((s) => s.isSearching);
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 w-3.5 h-3.5 text-text-muted pointer-events-none" />
      <input
        ref={inputRef}
        id="search-bar"
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search files, imports…"
        className="w-full bg-bg-elevated border border-border rounded-lg pl-8 pr-8 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-all duration-200"
        aria-label="Search repository files"
      />
      <span className="absolute right-3">
        {isSearching ? (
          <Spinner size="sm" className="text-accent-blue" />
        ) : searchQuery ? (
          <button onClick={clear} aria-label="Clear search">
            <X className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors" />
          </button>
        ) : null}
      </span>
    </div>
  );
}
