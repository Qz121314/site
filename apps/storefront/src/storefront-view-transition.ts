import { flushSync } from 'react-dom';
import { storefrontPresentationMode } from './storefront-presentation-mode';

type StorefrontViewTransition = {
  finished: Promise<void>;
};
type ViewTransitionDocument = Document & {
  startViewTransition?: (
    updateCallback: () => void | Promise<void>,
  ) => StorefrontViewTransition;
};

const MOBILE_ROUTE_TRANSITION_QUERY = '(max-width: 767px)';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function usesCompactRouteMotion(): boolean {
  return window.matchMedia(MOBILE_ROUTE_TRANSITION_QUERY).matches;
}

export function shouldUseStorefrontViewTransition(
  fromPathname: string,
  toPathname: string,
): boolean {
  if (fromPathname === toPathname || !usesCompactRouteMotion()) return false;
  const fromMode = storefrontPresentationMode(fromPathname);
  const toMode = storefrontPresentationMode(toPathname);
  return !(fromMode === 'root' && toMode === 'root');
}

export function runStorefrontViewTransition(
  update: () => void,
  afterCommit?: () => void,
): boolean {
  const transitionDocument = document as ViewTransitionDocument;
  const startViewTransition =
    transitionDocument.startViewTransition?.bind(transitionDocument);
  const root = document.documentElement;
  let updateRan = false;
  const commitUpdate = () => {
    if (updateRan) return;
    updateRan = true;
    flushSync(update);
    afterCommit?.();
  };

  if (
    !startViewTransition ||
    prefersReducedMotion() ||
    root.dataset.storefrontViewTransition === 'active'
  ) {
    commitUpdate();
    return false;
  }

  const cleanup = () => {
    delete root.dataset.storefrontViewTransition;
  };

  try {
    root.dataset.storefrontViewTransition = 'active';
    const transition = startViewTransition(commitUpdate);
    void transition.finished.then(cleanup, cleanup);
    return true;
  } catch {
    cleanup();
    commitUpdate();
    return false;
  }
}
