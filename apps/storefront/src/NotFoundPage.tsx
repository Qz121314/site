import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect } from 'react';
import { SYSTEM_UI } from './system-ui';

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
      <div className="state-mark">404</div>
      <h1>{SYSTEM_UI.notFound}</h1>
      <LinkComponent className="primary-button" href="/">
        {SYSTEM_UI.back}
      </LinkComponent>
    </div>
  );
}
