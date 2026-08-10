import { useLayoutEffect } from 'react';
import { parseStorefrontRoute } from './routing';

const NAVIGATION_EVENT = 'storefront:navigate';

type StorefrontPresentationMode = 'root' | 'push';
type StorefrontTransitionMode = 'tab' | 'push' | 'pop';

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
  const element = document.documentElement;
  const previousMode = element.dataset.storefrontPresentation as
    StorefrontPresentationMode | undefined;
  const nextMode = presentationMode(window.location.pathname);
  let transitionMode: StorefrontTransitionMode | null = null;

  if (previousMode === 'root' && nextMode === 'root') transitionMode = 'tab';
  else if (previousMode && nextMode === 'push') transitionMode = 'push';
  else if (previousMode === 'push' && nextMode === 'root') transitionMode = 'pop';

  element.dataset.storefrontPresentation = nextMode;
  if (transitionMode) element.dataset.storefrontTransition = transitionMode;
  else delete element.dataset.storefrontTransition;
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
      delete document.documentElement.dataset.storefrontTransition;
    };
  }, []);

  return null;
}
