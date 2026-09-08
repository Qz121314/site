import type { ReactNode } from 'react';

type AdminWorkspaceProps = {
  children: ReactNode;
  width?: 'narrow' | 'medium' | 'wide' | 'split-pane';
};

export function AdminWorkspace({ children, width = 'wide' }: AdminWorkspaceProps) {
  return (
    <div className={`admin-workspace admin-workspace--${width}`}>
      <div className="admin-workspace-content">{children}</div>
    </div>
  );
}
