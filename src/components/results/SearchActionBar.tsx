import { Filter, Play, Square } from 'lucide-react';
import { useApp } from '../../store/AppContext';

interface SearchActionBarProps {
  activeFilters: number;
  onOpenFilters?: () => void;
  isRunning: boolean;
  progress: number;
  onSearch: () => void;
  onAbort: () => void;
  searchLabel?: string;
}

export function SearchActionBar({
  activeFilters,
  onOpenFilters,
  isRunning,
  progress,
  onSearch,
  onAbort,
  searchLabel,
}: SearchActionBarProps) {
  const { i18n } = useApp();

  return (
    <div className="search-action-bar fixed inset-x-0 z-20 max-w-xl mx-auto px-3 py-2 bg-zinc-950">
      <div className="flex items-center gap-2">
        {onOpenFilters && (
          <button
            type="button"
            onClick={onOpenFilters}
            className="h-12 px-4 rounded-2xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-zinc-100 flex items-center gap-2 active:scale-95 transition shrink-0"
          >
            <Filter className="w-4 h-4 text-amber-400" />
            <span>{i18n.t('search.filters')}</span>
            {activeFilters > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/50 text-amber-200 font-mono text-[11px] font-bold">
                {activeFilters}
              </span>
            )}
          </button>
        )}

        {isRunning ? (
          <button
            type="button"
            onClick={onAbort}
            className="flex-1 h-12 rounded-2xl bg-rose-500 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>
              {i18n.t('app.stop')} ({progress}%)
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSearch}
            className="flex-1 h-12 rounded-2xl bg-amber-500 text-zinc-950 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition shadow-lg shadow-amber-500/15"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{searchLabel ?? i18n.t('app.search')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
