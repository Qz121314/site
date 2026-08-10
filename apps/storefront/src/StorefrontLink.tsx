import {
  type AnchorHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { saveCurrentStorefrontScrollPosition } from './storefront-history';

export const STOREFRONT_NAVIGATION_EVENT = 'storefront:navigate';

export function navigateStorefront(href: string) {
  saveCurrentStorefrontScrollPosition();
  window.history.pushState(null, '', href);
  window.dispatchEvent(new Event(STOREFRONT_NAVIGATION_EVENT));
}

export function StorefrontLink({
  href = '/',
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
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
      return;
    }
    event.preventDefault();
    navigateStorefront(href);
  };

  return <a {...props} href={href} onClick={handleClick} />;
}
