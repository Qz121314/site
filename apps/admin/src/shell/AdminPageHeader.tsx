import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  status,
  primaryAction,
  secondaryAction,
}: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-copy">
        {eyebrow ? <p className="admin-page-eyebrow">{eyebrow}</p> : null}
        <div className="admin-page-title-row">
          <h1>{title}</h1>
          {status ? <div className="admin-page-status">{status}</div> : null}
        </div>
        {description ? <p className="admin-page-description">{description}</p> : null}
      </div>
      {primaryAction || secondaryAction ? (
        <div className="admin-page-actions">
          {secondaryAction}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}
