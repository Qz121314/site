import { useLayoutEffect } from 'react';
import { parseStorefrontRoute } from './routing';

const NAVIGATION_EVENT = 'storefront:navigate';

type StorefrontPresentationMode = 'root' | 'push';

function presentationMode(pathname: string): StorefrontPresentationMode {
  const route = parseStorefrontRoute(pathname);
  switch (route.type) {
    case 'section':
    case 'product':
    case 'faq-article':
    case 'message':
    case 'message-compose':
      return 'push';
    default:
      return 'root';
  }
}

function applyPresentationMode() {
  document.documentElement.dataset.storefrontPresentation = presentationMode(window.location.pathname);
}

export function StorefrontPresentation() {
  useLayoutEffect(() => {
    applyPresentationMode();
    window.addEventListener('popstate', applyPresentationMode);
    window.addEventListener(NAVIGATION_EVENT, applyPresentationMode);
    return () => {
      window.removeEventListener('popstate', applyPresentationMode);
      window.removeEventListener(NAVIGATION_EVENT, applyPresentationMode);
      delete document.documentElement.dataset.storefrontPresentation;
    };
  }, []);

  return null;
}
