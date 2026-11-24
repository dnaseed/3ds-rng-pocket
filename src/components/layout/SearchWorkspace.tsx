import type { ReactNode } from 'react';

interface SearchWorkspaceProps {
  children: ReactNode;
  results: ReactNode;
  actions: ReactNode;
  collapsed: boolean;
}

export function SearchWorkspace({ children, results, actions, collapsed }: SearchWorkspaceProps) {
  return (
    <div className="search-workspace space-y-3 pb-6">
      <div className={`workspace-params space-y-3 ${collapsed ? 'hidden lg:block' : ''}`}>
        {children}
      </div>
      <div className="workspace-actions !mt-0">{actions}</div>
      <div className="workspace-results">{results}</div>
    </div>
  );
}
