import { useLayoutEffect } from 'react';
import { parseStorefrontRoute } from './routing';
import {
  ensureStorefrontHistoryState,
  recordStorefrontHistoryPush,
  syncStorefrontHistoryFromPopState,
  type StorefrontNavigationDirection,
} from './storefront-history';

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

function transitionModeForNavigation(
  previousMode: StorefrontPresentationMode | undefined,
  nextMode: StorefrontPresentationMode,
  direction: StorefrontNavigationDirection | null,
): StorefrontTransitionMode | null {
  if (!previousMode) return null;
  if (previousMode === 'root' && nextMode === 'root') return 'tab';
  if (direction === 'back') return 'pop';
  if (direction === 'forward') return 'push';
  if (nextMode === 'push') return 'push';
  if (previousMode === 'push' && nextMode === 'root') return 'pop';
  return null;
}

function applyPresentationMode(direction: StorefrontNavigationDirection | null = null) {
  const element = document.documentElement;
  const previousMode = element.dataset.storefrontPresentation as
    StorefrontPresentationMode | undefined;
  const nextMode = presentationMode(window.location.pathname);
  const transitionMode = transitionModeForNavigation(previousMode, nextMode, direction);

  element.dataset.storefrontPresentation = nextMode;
  if (transitionMode) element.dataset.storefrontTransition = transitionMode;
  else delete element.dataset.storefrontTransition;
}

export function StorefrontPresentation() {
  useLayoutEffect(() => {
    ensureStorefrontHistoryState();
    applyPresentationMode();

    function handleStorefrontNavigation() {
      recordStorefrontHistoryPush();
      applyPresentationMode('forward');
    }

    function handlePopState(event: PopStateEvent) {
      const direction = syncStorefrontHistoryFromPopState(event.state);
      applyPresentationMode(direction);
    }

    window.addEventListener('popstate', handlePopState);
    window.addEventListener(NAVIGATION_EVENT, handleStorefrontNavigation);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(NAVIGATION_EVENT, handleStorefrontNavigation);
      delete document.documentElement.dataset.storefrontPresentation;
      delete document.documentElement.dataset.storefrontTransition;
    };
  }, []);

  return null;
}
