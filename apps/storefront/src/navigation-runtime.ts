export type NavigationDirection = 'forward' | 'backward';

type NavigationSnapshot = {
  key: string;
  direction: NavigationDirection;
  scrollY: number;
};

const NAVIGATION_STATE_KEY = 'storefront:navigation-state';

let currentDirection: NavigationDirection = 'forward';

export function getNavigationDirection(): NavigationDirection {
  return currentDirection;
}

export function markNavigation(
  from: string,
  to: string,
  direction?: NavigationDirection,
) {
  currentDirection =
    direction ?? (to.length >= from.length ? 'forward' : 'backward');

  saveNavigationSnapshot({
    key: from,
    direction: currentDirection,
    scrollY: window.scrollY,
  });
}

export function saveNavigationSnapshot(snapshot: NavigationSnapshot) {
  try {
    const current = JSON.parse(
      sessionStorage.getItem(NAVIGATION_STATE_KEY) ?? '{}',
    ) as Record<string, NavigationSnapshot>;

    sessionStorage.setItem(
      NAVIGATION_STATE_KEY,
      JSON.stringify({
        ...current,
        [snapshot.key]: snapshot,
      }),
    );
  } catch {
    // Ignore storage failures. Navigation should continue normally.
  }
}

export function restoreNavigationScroll(key: string) {
  try {
    const current = JSON.parse(
      sessionStorage.getItem(NAVIGATION_STATE_KEY) ?? '{}',
    ) as Record<string, NavigationSnapshot>;

    const snapshot = current[key];
    if (!snapshot) return;

    requestAnimationFrame(() => {
      window.scrollTo({
        top: snapshot.scrollY,
        behavior: 'instant' as ScrollBehavior,
      });
    });
  } catch {
    // Ignore storage failures.
  }
}
