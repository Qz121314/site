import { parseStorefrontRoute } from './routing';

type StorefrontPresentationMode = 'root' | 'push';
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

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function waitForRouteCommit(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export function shouldUseStorefrontViewTransition(
  fromPathname: string,
  toPathname: string,
): boolean {
  if (fromPathname === toPathname) return false;
  const fromMode = presentationMode(fromPathname);
  const toMode = presentationMode(toPathname);
  return !(fromMode === 'root' && toMode === 'root');
}

export function runStorefrontViewTransition(
  mode: StorefrontViewTransitionMode,
  update: () => void,
): boolean {
  const transitionDocument = document as ViewTransitionDocument;
  const startViewTransition = transitionDocument.startViewTransition?.bind(document);
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

  try {
    root.dataset.storefrontViewTransition = 'active';
    root.dataset.storefrontViewTransitionMode = mode;
    const transition = startViewTransition(async () => {
      runUpdate();
      await waitForRouteCommit();
    });
    void transition.finished.finally(() => {
      if (activeTransitionId !== transitionId) return;
      delete root.dataset.storefrontViewTransition;
      delete root.dataset.storefrontViewTransitionMode;
    });
    return true;
  } catch {
    if (activeTransitionId === transitionId) {
      delete root.dataset.storefrontViewTransition;
      delete root.dataset.storefrontViewTransitionMode;
    }
    runUpdate();
    return false;
  }
}
