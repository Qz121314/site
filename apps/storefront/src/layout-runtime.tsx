import type { ReactNode } from 'react';
import type { StorefrontLayoutPage } from '@site/shared';
import type { StorefrontBootstrap } from './content';
import { layoutForPage } from './layout-config';

export function StorefrontPageLayout({
  bootstrap,
  page,
  children,
}: {
  bootstrap: StorefrontBootstrap;
  page: StorefrontLayoutPage;
  children: ReactNode;
}) {
  return (
    <div
      className="storefront-page-layout"
      data-layout-page={page}
      data-layout-variant={layoutForPage(bootstrap, page)}
    >
      {children}
    </div>
  );
}
