import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type AdminFeedbackKind = 'empty' | 'loading' | 'error';

type AdminFeedbackStateProps = {
  kind: AdminFeedbackKind;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function AdminFeedbackState({
  kind,
  title,
  description,
  action,
  compact = false,
}: AdminFeedbackStateProps) {
  const Icon = kind === 'loading' ? LoaderCircle : kind === 'error' ? AlertCircle : Inbox;
  return (
    <section
      className={cn(
        'ui-feedback-state',
        `ui-feedback-state--${kind}`,
        compact && 'is-compact',
      )}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'loading' ? 'polite' : undefined}
    >
      <Icon
        className={kind === 'loading' ? 'ui-feedback-state-spinner' : undefined}
        aria-hidden="true"
        size={18}
      />
      <div className="ui-feedback-state-copy">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="ui-feedback-state-action">{action}</div> : null}
    </section>
  );
}
