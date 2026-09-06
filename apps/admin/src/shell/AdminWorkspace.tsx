import type { ReactNode } from 'react';

type AdminWorkspaceProps = {
  children: ReactNode;
  width?: 'narrow' | 'medium' | 'full';
};

export function AdminWorkspace({ children, width = 'full' }: AdminWorkspaceProps) {
  return (
    <div className={`admin-workspace admin-workspace--${width}`}>
      <div className="admin-workspace-content">{children}</div>
    </div>
  );
}
