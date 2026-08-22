import { saveCurrentStorefrontScrollPosition } from './storefront-history';

export const STOREFRONT_NAVIGATION_EVENT = 'storefront:navigate';
export const STOREFRONT_REPLACE_EVENT = 'storefront:replace';

type StorefrontLinkClickEvent = {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  preventDefault(): void;
};

function normalizedLocationKey(url: URL): string {
  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/u, '');
  return `${pathname}${url.search}${url.hash}`;
}

export function replaceStorefrontLocation(href: string): void {
  const target = new URL(href, window.location.href);
  const current = new URL(window.location.href);
  if (normalizedLocationKey(target) === normalizedLocationKey(current)) return;

  window.history.replaceState(window.history.state, '', href);
  window.dispatchEvent(new Event(STOREFRONT_REPLACE_EVENT));
}

export function handleStorefrontLinkClick(
  event: StorefrontLinkClickEvent,
  href: string,
): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !href.startsWith('/') ||
    href.startsWith('/go/')
  ) {
    return false;
  }

  event.preventDefault();
  const target = new URL(href, window.location.href);
  const current = new URL(window.location.href);
  if (normalizedLocationKey(target) === normalizedLocationKey(current)) return true;

  saveCurrentStorefrontScrollPosition();
  window.history.pushState(null, '', href);
  window.dispatchEvent(new Event(STOREFRONT_NAVIGATION_EVENT));
  return true;
}
