import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type AdminFormSectionProps = {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

export function AdminFormSection({
  title,
  description,
  className,
  children,
}: AdminFormSectionProps) {
  const titleId = useId();
  return (
    <section className={cn('ui-form-section', className)} aria-labelledby={titleId}>
      <header className="ui-form-section-header">
        <h2 id={titleId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="ui-form-section-body">{children}</div>
    </section>
  );
}

type AdminFieldRowProps = {
  label: string;
  description?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
  status?: ReactNode;
};

export function AdminFieldRow({
  label,
  description,
  htmlFor,
  className,
  children,
  status,
}: AdminFieldRowProps) {
  return (
    <div className={cn('ui-field-row', className)}>
      <div className="ui-field-row-copy">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <strong>{label}</strong>}
        {description ? <p>{description}</p> : null}
        {status ? <div className="ui-field-row-status">{status}</div> : null}
      </div>
      <div className="ui-field-row-control">{children}</div>
    </div>
  );
}
