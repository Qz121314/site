import { storefrontPresentationMode } from './storefront-presentation-mode';

type StorefrontViewTransitionMode = 'push' | 'pop';
type StorefrontViewTransition = {
  finished: Promise<void>;
};
type ViewTransitionDocument = Document & {
  startViewTransition?: (
    updateCallback: () => void | Promise<void>,
  ) => StorefrontViewTransition;
};

let activeTransitionId = 0;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function waitForRouteCommit(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export function shouldUseStorefrontViewTransition(
  fromPathname: string,
  toPathname: string,
): boolean {
  if (fromPathname === toPathname) return false;
  const fromMode = storefrontPresentationMode(fromPathname);
  const toMode = storefrontPresentationMode(toPathname);
  return !(fromMode === 'root' && toMode === 'root');
}

export function runStorefrontViewTransition(
  mode: StorefrontViewTransitionMode,
  update: () => void,
): boolean {
  const transitionDocument = document as ViewTransitionDocument;
  const startViewTransition = transitionDocument.startViewTransition?.bind(transitionDocument);
  if (!startViewTransition || prefersReducedMotion()) {
    update();
    return false;
  }

  const transitionId = ++activeTransitionId;
  const root = document.documentElement;
  let updateRan = false;
  const runUpdate = () => {
    if (updateRan) return;
    updateRan = true;
    update();
  };
  const cleanup = () => {
    if (activeTransitionId !== transitionId) return;
    delete root.dataset.storefrontViewTransition;
    delete root.dataset.storefrontViewTransitionMode;
  };

  try {
    root.dataset.storefrontViewTransition = 'active';
    root.dataset.storefrontViewTransitionMode = mode;
    const transition = startViewTransition(async () => {
      runUpdate();
      await waitForRouteCommit();
    });
    void transition.finished.then(cleanup, cleanup);
    return true;
  } catch {
    cleanup();
    runUpdate();
    return false;
  }
}
