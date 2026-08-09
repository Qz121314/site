import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect } from 'react';

export function NotFoundPage({
  siteName,
  LinkComponent = 'a',
}: {
  siteName: string;
  LinkComponent?: StorefrontLinkComponent;
}) {
  useEffect(() => {
    document.title = `Not found · ${siteName}`;
  }, [siteName]);

  return (
    <div className="standalone-state embedded-state">
      <div className="state-mark">404</div>
      <h1>Page not found</h1>
      <p>
        The service or page you requested is not part of the current published version.
      </p>
      <LinkComponent className="primary-button" href="/">
        Back to home
      </LinkComponent>
    </div>
  );
}
