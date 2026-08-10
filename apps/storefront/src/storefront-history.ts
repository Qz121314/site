const SESSION_STORAGE_KEY = 'storefront:navigation-session';
const MAX_INDEX_STORAGE_PREFIX = 'storefront:navigation-max:';
const STATE_SESSION_KEY = '__storefrontNavigationSession';
const STATE_INDEX_KEY = '__storefrontNavigationIndex';

export type StorefrontNavigationDirection = 'back' | 'forward';

type NavigationMeta = {
  sessionId: string;
  index: number;
  maxIndex: number;
};

let memorySessionId = '';
let memoryMaxIndex = 0;
let lastKnownIndex = 0;

function recordState(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readSessionStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // History still works when sessionStorage is unavailable; memory state is the fallback.
  }
}

function createSessionId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readStateMeta(state: unknown, sessionId: string): Pick<NavigationMeta, 'sessionId' | 'index'> | null {
  const record = recordState(state);
  const stateSession = record[STATE_SESSION_KEY];
  const stateIndex = record[STATE_INDEX_KEY];
  if (stateSession !== sessionId || typeof stateIndex !== 'number' || !Number.isInteger(stateIndex) || stateIndex < 0) {
    return null;
  }
  return { sessionId, index: stateIndex };
}

function maxStorageKey(sessionId: string): string {
  return `${MAX_INDEX_STORAGE_PREFIX}${sessionId}`;
}

function readMaxIndex(sessionId: string): number {
  const stored = Number(readSessionStorage(maxStorageKey(sessionId)));
  if (Number.isInteger(stored) && stored >= 0) return stored;
  return memorySessionId === sessionId ? memoryMaxIndex : 0;
}

function writeMaxIndex(sessionId: string, index: number): void {
  memorySessionId = sessionId;
  memoryMaxIndex = index;
  writeSessionStorage(maxStorageKey(sessionId), String(index));
}

function markNavigationDirection(direction: StorefrontNavigationDirection): void {
  document.documentElement.dataset.storefrontNavDirection = direction;
}

function activeSessionId(): string {
  return readSessionStorage(SESSION_STORAGE_KEY) || memorySessionId;
}

export function ensureStorefrontHistoryState(): NavigationMeta {
  const existingState = recordState(window.history.state);
  const storedSession = readSessionStorage(SESSION_STORAGE_KEY);
  const stateSession = existingState[STATE_SESSION_KEY];
  const reusableSession = typeof stateSession === 'string'
    && stateSession
    && storedSession === stateSession
    ? stateSession
    : null;

  if (!reusableSession) {
    const sessionId = createSessionId();
    window.history.replaceState(
      {
        ...existingState,
        [STATE_SESSION_KEY]: sessionId,
        [STATE_INDEX_KEY]: 0,
      },
      '',
      window.location.href,
    );
    writeSessionStorage(SESSION_STORAGE_KEY, sessionId);
    writeMaxIndex(sessionId, 0);
    lastKnownIndex = 0;
    return { sessionId, index: 0, maxIndex: 0 };
  }

  const current = readStateMeta(existingState, reusableSession);
  const index = current?.index ?? 0;
  const maxIndex = Math.max(index, readMaxIndex(reusableSession));
  if (!current) {
    window.history.replaceState(
      {
        ...existingState,
        [STATE_SESSION_KEY]: reusableSession,
        [STATE_INDEX_KEY]: index,
      },
      '',
      window.location.href,
    );
  }
  writeMaxIndex(reusableSession, maxIndex);
  lastKnownIndex = index;
  return { sessionId: reusableSession, index, maxIndex };
}

/**
 * StorefrontRoot emits `storefront:navigate` immediately after its SPA pushState.
 * Stamp that newly-pushed entry with our lightweight history position so edge
 * gestures can distinguish Back from Forward without changing route ownership.
 */
export function recordStorefrontHistoryPush(): void {
  const sessionId = activeSessionId();
  if (!sessionId) {
    ensureStorefrontHistoryState();
    return;
  }
  const nextIndex = lastKnownIndex + 1;
  window.history.replaceState(
    {
      ...recordState(window.history.state),
      [STATE_SESSION_KEY]: sessionId,
      [STATE_INDEX_KEY]: nextIndex,
    },
    '',
    window.location.href,
  );
  writeMaxIndex(sessionId, nextIndex);
  lastKnownIndex = nextIndex;
  markNavigationDirection('forward');
}

export function syncStorefrontHistoryFromPopState(state: unknown): void {
  const sessionId = activeSessionId();
  if (!sessionId) return;
  const next = readStateMeta(state, sessionId);
  if (!next) return;
  markNavigationDirection(next.index < lastKnownIndex ? 'back' : 'forward');
  lastKnownIndex = next.index;
}

export function canNavigateStorefrontBack(): boolean {
  return ensureStorefrontHistoryState().index > 0;
}

export function canNavigateStorefrontForward(): boolean {
  const current = ensureStorefrontHistoryState();
  return current.index < current.maxIndex;
}

export function navigateStorefrontBack(): boolean {
  if (!canNavigateStorefrontBack()) return false;
  markNavigationDirection('back');
  window.history.back();
  return true;
}

export function navigateStorefrontForward(): boolean {
  if (!canNavigateStorefrontForward()) return false;
  markNavigationDirection('forward');
  window.history.forward();
  return true;
}
