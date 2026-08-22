import { useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  ensureStorefrontHistoryState,
  recordStorefrontHistoryPush,
  restoreStorefrontScrollPosition,
  syncStorefrontHistoryFromPopState,
  type StorefrontNavigationDirection,
} from './storefront-history';
import { publishStorefrontLocationChange } from './storefront-location-runtime';
import {
  STOREFRONT_NAVIGATION_EVENT,
  STOREFRONT_REPLACE_EVENT,
} from './storefront-navigation-runtime';
import {
  storefrontPresentationMode,
  type StorefrontPresentationMode,
} from './storefront-presentation-mode';
import {
  runStorefrontViewTransition,
  shouldUseStorefrontViewTransition,
} from './storefront-view-transition';

type StorefrontTransitionMode = 'tab' | 'push' | 'pop';

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

function applyPresentationMode(
  direction: StorefrontNavigationDirection | null = null,
  animate = true,
) {
  const element = document.documentElement;
  const previousMode = element.dataset.storefrontPresentation as
    StorefrontPresentationMode | undefined;
  const previousPathname = element.dataset.storefrontPathname;
  const nextPathname = window.location.pathname;
  const nextMode = storefrontPresentationMode(nextPathname);
  const transitionMode =
    animate && previousPathname && previousPathname !== nextPathname
      ? transitionModeForNavigation(previousMode, nextMode, direction)
      : null;

  element.dataset.storefrontPresentation = nextMode;
  element.dataset.storefrontPathname = nextPathname;
  if (transitionMode) element.dataset.storefrontTransition = transitionMode;
  else delete element.dataset.storefrontTransition;
}

function commitStorefrontLocation(
  direction: StorefrontNavigationDirection | null,
  animate = true,
) {
  applyPresentationMode(direction, animate);
  publishStorefrontLocationChange();
}

export function StorefrontPresentation() {
  useLayoutEffect(() => {
    ensureStorefrontHistoryState();
    applyPresentationMode();

    function handleStorefrontNavigation() {
      recordStorefrontHistoryPush();
      commitStorefrontLocation('forward');
    }

    function handleStorefrontReplace() {
      flushSync(() => commitStorefrontLocation(null, false));
    }

    function handlePopState(event: PopStateEvent) {
      const previousPathname = document.documentElement.dataset.storefrontPathname;
      const direction = syncStorefrontHistoryFromPopState(event.state);
      const nextPathname = window.location.pathname;
      const update = () => commitStorefrontLocation(direction);
      const restore = direction
        ? () => restoreStorefrontScrollPosition(event.state)
        : undefined;

      if (
        direction &&
        previousPathname &&
        shouldUseStorefrontViewTransition(previousPathname, nextPathname)
      ) {
        runStorefrontViewTransition(update, restore);
      } else {
        flushSync(update);
        restore?.();
      }
    }

    window.addEventListener('popstate', handlePopState);
    window.addEventListener(STOREFRONT_NAVIGATION_EVENT, handleStorefrontNavigation);
    window.addEventListener(STOREFRONT_REPLACE_EVENT, handleStorefrontReplace);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(STOREFRONT_NAVIGATION_EVENT, handleStorefrontNavigation);
      window.removeEventListener(STOREFRONT_REPLACE_EVENT, handleStorefrontReplace);
      delete document.documentElement.dataset.storefrontPresentation;
      delete document.documentElement.dataset.storefrontPathname;
      delete document.documentElement.dataset.storefrontTransition;
    };
  }, []);

  return null;
}
