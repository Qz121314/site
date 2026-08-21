export const STOREFRONT_NAVIGATION_EVENT = 'storefront:navigate';

type StorefrontLinkClickEvent = {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  preventDefault(): void;
};

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
  window.history.pushState(null, '', href);
  window.dispatchEvent(new Event(STOREFRONT_NAVIGATION_EVENT));
  return true;
}
