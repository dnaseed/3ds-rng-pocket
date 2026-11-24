import { ChevronDown, ChevronUp } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../store/AppContext';

interface SearchWorkspaceProps {
  children: ReactNode;
  results: ReactNode;
  actions: ReactNode;
  collapsed?: boolean;
  collapsible?: boolean;
}

export function SearchWorkspace({ children, results, actions, collapsed, collapsible }: SearchWorkspaceProps) {
  const { i18n } = useApp();
  const [compact, setCompact] = useState(false);
  const paramsId = useId();
  const params = useRef<HTMLDivElement>(null);
  const hideParams = collapsed ?? compact;

  return (
    <div className="search-workspace space-y-3 pb-6">
      <div ref={params} id={paramsId} className={`workspace-params space-y-3 ${hideParams ? 'hidden lg:block' : ''}`}>
        {children}
      </div>
      <div className="workspace-actions !mt-0">{actions}</div>
      <div className="workspace-results">
        {collapsible && <button type="button" aria-controls={paramsId} aria-expanded={!hideParams}
          className="inline-flex items-center gap-2 lg:hidden mb-2 min-h-10 rounded-xl border border-zinc-700 px-3 text-xs font-semibold"
          onClick={() => {
            setCompact(!hideParams);
            if (hideParams) requestAnimationFrame(() => params.current?.scrollIntoView({ block: 'start' }));
          }}>{hideParams ? <ChevronDown size={15} /> : <ChevronUp size={15} />}{i18n.t(hideParams ? 'search.editParams' : 'search.collapseParams')}</button>}
        {results}
      </div>
    </div>
  );
}
