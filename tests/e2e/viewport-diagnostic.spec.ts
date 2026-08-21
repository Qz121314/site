import { test } from '@playwright/test';
import { findPublishedProductRoute } from './published-storefront-fixtures';

type GeometrySnapshot = {
  label: string;
  scrollY: number;
  innerWidth: number;
  innerHeight: number;
  documentHeight: number;
  visualViewport: null | {
    width: number;
    height: number;
    offsetTop: number;
    offsetLeft: number;
    pageTop: number;
    pageLeft: number;
    scale: number;
  };
  runtime: Record<string, string>;
  header: null | {
    position: string;
    top: string;
    bottom: string;
    rect: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  };
  bottomChrome: null | {
    position: string;
    top: string;
    bottom: string;
    rect: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  };
  routeAction: null | {
    rect: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  };
  cta: null | {
    rect: { top: number; right: number; bottom: number; left: number; width: number; height: number };
  };
};

async function snapshot(page: import('@playwright/test').Page, label: string) {
  return page.evaluate((snapshotLabel): GeometrySnapshot => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const rect = (element: Element | null) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        left: value.left,
        width: value.width,
        height: value.height,
      };
    };
    const headerElement = document.querySelector<HTMLElement>('.storefront-detail-topbar');
    const bottomChromeElement = document.querySelector<HTMLElement>('.storefront-bottom-chrome');
    const routeActionElement = bottomChromeElement?.querySelector<HTMLElement>(
      '.product-detail-route-action',
    );
    const ctaElement = routeActionElement?.querySelector<HTMLElement>('.cta-button');
    const headerStyle = headerElement ? getComputedStyle(headerElement) : null;
    const chromeStyle = bottomChromeElement ? getComputedStyle(bottomChromeElement) : null;
    return {
      label: snapshotLabel,
      scrollY: window.scrollY,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentHeight: root.scrollHeight,
      visualViewport: viewport
        ? {
            width: viewport.width,
            height: viewport.height,
            offsetTop: viewport.offsetTop,
            offsetLeft: viewport.offsetLeft,
            pageTop: viewport.pageTop,
            pageLeft: viewport.pageLeft,
            scale: viewport.scale,
          }
        : null,
      runtime: {
        viewportWidth: root.style.getPropertyValue('--app-viewport-width'),
        viewportHeight: root.style.getPropertyValue('--app-viewport-height'),
        viewportTop: root.style.getPropertyValue('--app-viewport-top'),
        viewportRight: root.style.getPropertyValue('--app-viewport-right'),
        viewportBottom: root.style.getPropertyValue('--app-viewport-bottom'),
        viewportLeft: root.style.getPropertyValue('--app-viewport-left'),
        headerHeight: root.style.getPropertyValue('--app-header-height'),
        bottomChromeHeight: root.style.getPropertyValue('--app-bottom-chrome-height'),
        mode: root.dataset.visualViewport ?? '',
      },
      header: headerElement
        ? {
            position: headerStyle!.position,
            top: headerStyle!.top,
            bottom: headerStyle!.bottom,
            rect: rect(headerElement)!,
          }
        : null,
      bottomChrome: bottomChromeElement
        ? {
            position: chromeStyle!.position,
            top: chromeStyle!.top,
            bottom: chromeStyle!.bottom,
            rect: rect(bottomChromeElement)!,
          }
        : null,
      routeAction: routeActionElement ? { rect: rect(routeActionElement)! } : null,
      cta: ctaElement ? { rect: rect(ctaElement)! } : null,
    };
  }, label);
}

test('diagnose production mobile visual viewport geometry', async ({ page, request }) => {
  const publishedRoute = await findPublishedProductRoute(request);
  if (!publishedRoute) throw new Error('No published product is available for viewport diagnosis.');

  await page.goto(publishedRoute.productHref);
  await page.locator('.storefront-detail-topbar').waitFor({ state: 'visible' });
  await page.locator('.storefront-bottom-chrome .cta-button').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);

  const initial = await snapshot(page, 'initial');
  console.log(`VIEWPORT_DIAGNOSTIC_INITIAL=${JSON.stringify(initial)}`);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(750);

  const scrolled = await snapshot(page, 'scrolled');
  console.log(`VIEWPORT_DIAGNOSTIC_SCROLLED=${JSON.stringify(scrolled)}`);
});
