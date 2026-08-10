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

  function handleBack(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (!config.backHref || !canNavigateStorefrontBack()) return;
    event.preventDefault();
    navigateStorefrontBack();
  }

  return (
    <header className={`topbar storefront-app-header is-page${config.backHref ? ' has-back' : ''}`}>
      <div className="storefront-app-header-side is-left">
        {config.backHref ? (
          <LinkComponent
            className="storefront-app-header-back"
            href={config.backHref}
            onClick={handleBack}
          >
            <span aria-hidden="true">‹</span>
            <small>{config.backLabel ?? ''}</small>
          </LinkComponent>
        ) : null}
      </div>
      <h1 className="storefront-app-header-title" title={config.title}>{config.title}</h1>
      <div className="storefront-app-header-side is-right" aria-hidden="true" />
    </header>
  );
}
