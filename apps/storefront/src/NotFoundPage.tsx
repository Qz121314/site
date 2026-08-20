import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect } from 'react';
import { SYSTEM_UI } from './system-ui';

function NotFoundIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 5.5h7l3 3v10H7z" />
      <path d="M14 5.5v3h3M9.5 13h5M9.5 16h3" />
    </svg>
  );
}

export function NotFoundPage({
  siteName,
  LinkComponent = 'a',
}: {
  siteName: string;
  LinkComponent?: StorefrontLinkComponent;
}) {
  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  return (
    <div className="standalone-state embedded-state">
      <div className="state-mark" aria-hidden="true">
        <NotFoundIcon />
      </div>
      <h1>{SYSTEM_UI.notFound}</h1>
      <LinkComponent className="primary-button" href="/">
        {SYSTEM_UI.back}
      </LinkComponent>
    </div>
  );
}
