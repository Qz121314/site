import type { ReactNode } from 'react';

export type StorefrontNoAgentNoticeProps = {
  message: string;
  format: 'plain' | 'markdown';
  children?: ReactNode;
};

export function StorefrontNoAgentNotice({
  children,
  format,
  message,
}: StorefrontNoAgentNoticeProps) {
  return (
    <section
      className="storefront-no-agent-notice"
      data-format={format}
      role="status"
      aria-live="polite"
    >
      <span className="storefront-no-agent-notice-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <div className="storefront-no-agent-notice-content">
        {children ?? <p>{message}</p>}
      </div>
    </section>
  );
}
