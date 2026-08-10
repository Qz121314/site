import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';

export type StorefrontHeaderConfig =
  | { kind: 'home' }
  | {
      kind: 'page';
      title: string;
      backHref?: string;
      backLabel?: string;
    };

export function StorefrontAppHeader({
  config,
  LinkComponent,
  logo,
  siteName,
}: {
  config: StorefrontHeaderConfig;
  LinkComponent: StorefrontLinkComponent;
  logo: ReactNode;
  siteName: string;
}) {
  if (config.kind === 'home') {
    return (
      <header className="topbar storefront-app-header is-home">
        <LinkComponent className="storefront-home-brand" href="/" aria-label={siteName}>
          {logo ? <span className="storefront-home-logo">{logo}</span> : <strong>{siteName}</strong>}
        </LinkComponent>
      </header>
    );
  }

  const pageConfig = config;

  function handleBack(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (!pageConfig.backHref || !canNavigateStorefrontBack()) return;
    event.preventDefault();
    navigateStorefrontBack();
  }

  return (
    <header className={`topbar storefront-app-header is-page${pageConfig.backHref ? ' has-back' : ''}`}>
      <div className="storefront-app-header-side is-left">
        {pageConfig.backHref ? (
          <LinkComponent
            className="storefront-app-header-back"
            href={pageConfig.backHref}
            onClick={handleBack}
          >
            <span aria-hidden="true">‹</span>
            <small>{pageConfig.backLabel ?? ''}</small>
          </LinkComponent>
        ) : null}
      </div>
      <h1 className="storefront-app-header-title" title={pageConfig.title}>{pageConfig.title}</h1>
      <div className="storefront-app-header-side is-right" aria-hidden="true" />
    </header>
  );
}
