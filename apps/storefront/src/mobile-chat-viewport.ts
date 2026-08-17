const MOBILE_CHAT_QUERY = '(max-width: 767px)';
const CHAT_PAGE_SELECTOR = '.messages-workspace.is-thread-open .chat-page';
const CHAT_INPUT_SELECTOR = '.chat-composer textarea';
const CHAT_TIMELINE_SELECTOR = '.chat-timeline';
const NAVIGATION_EVENT = 'storefront:navigate';

export const MOBILE_CHAT_KEYBOARD_CLEARANCE_PX = 14;

type MobileChatVisualViewport = Pick<VisualViewport, 'height' | 'offsetTop'>;

export type MobileChatViewportMetrics = {
  height: number;
  offsetTop: number;
};

type MobileChatSurfaces = {
  main: HTMLElement | null;
  route: HTMLElement | null;
  workspace: HTMLElement | null;
  detail: HTMLElement | null;
  page: HTMLElement;
};

let installed = false;
let activeChatInput: HTMLTextAreaElement | null = null;
let settleTimerIds: number[] = [];
let managedSurfaces: MobileChatSurfaces | null = null;

export function resolveMobileChatViewportMetrics(
  visualViewport: MobileChatVisualViewport | null | undefined,
  fallbackHeight: number,
): MobileChatViewportMetrics {
  return {
    height: Math.round(visualViewport?.height ?? fallbackHeight),
    offsetTop: Math.max(0, Math.round(visualViewport?.offsetTop ?? 0)),
  };
}

export function resolveMobileChatSurfaceHeight(
  viewportHeight: number,
  inputFocused: boolean,
): number {
  return Math.max(
    1,
    Math.round(viewportHeight) - (inputFocused ? MOBILE_CHAT_KEYBOARD_CLEARANCE_PX : 0),
  );
}

function isChatInput(target: EventTarget | null): target is HTMLTextAreaElement {
  return target instanceof HTMLTextAreaElement && target.matches(CHAT_INPUT_SELECTOR);
}

function findChatPage(target: Element | null = null): HTMLElement | null {
  return (
    target?.closest<HTMLElement>('.chat-page') ??
    document.querySelector<HTMLElement>(CHAT_PAGE_SELECTOR)
  );
}

function isChatInputFocused(page: HTMLElement): boolean {
  const activeElement = document.activeElement;
  return (
    activeElement instanceof HTMLTextAreaElement &&
    activeElement.matches(CHAT_INPUT_SELECTOR) &&
    page.contains(activeElement)
  );
}

function findMobileChatSurfaces(page: HTMLElement): MobileChatSurfaces {
  return {
    main: page.closest<HTMLElement>('main'),
    route: page.closest<HTMLElement>('.storefront-route-view'),
    workspace: page.closest<HTMLElement>('.messages-workspace.is-thread-open'),
    detail: page.closest<HTMLElement>('.messages-detail'),
    page,
  };
}

function clearMobileChatViewportStyles(surfaces = managedSurfaces) {
  if (!surfaces) return;
  const { main, route, workspace, detail, page } = surfaces;
  for (const element of [main, route, workspace, detail, page]) {
    element?.style.removeProperty('height');
    element?.style.removeProperty('min-height');
  }
  main?.style.removeProperty('transform');
  workspace?.style.removeProperty('transform');
  if (managedSurfaces === surfaces) managedSurfaces = null;
}

function setMobileChatViewportHeight(page: HTMLElement) {
  if (!window.matchMedia(MOBILE_CHAT_QUERY).matches) {
    clearMobileChatViewportStyles();
    return;
  }

  const { height: viewportHeight, offsetTop } = resolveMobileChatViewportMetrics(
    window.visualViewport,
    window.innerHeight,
  );
  if (viewportHeight <= 0) return;

  // Android browsers can keep the focused control flush with, or partially under,
  // the software keyboard even when visualViewport itself has resized. Reserve a
  // real slice of viewport outside the chat surface while the textarea is focused
  // instead of faking clearance with composer padding inside the same surface.
  const surfaceHeight = resolveMobileChatSurfaceHeight(
    viewportHeight,
    isChatInputFocused(page),
  );
  const height = `${surfaceHeight}px`;
  const nextSurfaces = findMobileChatSurfaces(page);

  if (managedSurfaces && managedSurfaces.page !== page) {
    clearMobileChatViewportStyles(managedSurfaces);
  }
  managedSurfaces = nextSurfaces;

  const { main, route, workspace, detail } = nextSurfaces;
  for (const element of [main, route, workspace, detail, page]) {
    if (!element) continue;
    element.style.height = height;
    element.style.minHeight = height;
  }

  // Keep the entire chat surface aligned to the visual viewport. Applying the
  // offset to the outer main container avoids mixing a 100dvh parent with a
  // translated child when mobile browser chrome or the virtual keyboard moves
  // the visual viewport.
  workspace?.style.removeProperty('transform');
  if (main) {
    if (offsetTop > 0) {
      main.style.transform = `translate3d(0, ${offsetTop}px, 0)`;
    } else {
      main.style.removeProperty('transform');
    }
  }
}

function scrollChatToLatest(page: HTMLElement) {
  const timeline = page.querySelector<HTMLElement>(CHAT_TIMELINE_SELECTOR);
  if (!timeline) return;
  timeline.scrollTop = timeline.scrollHeight;
}

function syncChatViewport(page: HTMLElement | null, forceLatest: boolean) {
  if (!page) {
    clearMobileChatViewportStyles();
    return;
  }
  setMobileChatViewportHeight(page);
  if (forceLatest) scrollChatToLatest(page);
}

function clearSettleTimers() {
  for (const timerId of settleTimerIds) window.clearTimeout(timerId);
  settleTimerIds = [];
}

function settleChatViewport(page: HTMLElement | null, forceLatest = true) {
  if (!page) {
    clearSettleTimers();
    clearMobileChatViewportStyles();
    return;
  }
  clearSettleTimers();
  syncChatViewport(page, forceLatest);

  window.requestAnimationFrame(() => syncChatViewport(page, forceLatest));
  for (const delay of [80, 180, 360]) {
    settleTimerIds.push(
      window.setTimeout(() => syncChatViewport(page, forceLatest), delay),
    );
  }
}

function syncFromActiveInput(forceLatest = false) {
  const input =
    activeChatInput && document.contains(activeChatInput) ? activeChatInput : null;
  if (!input) activeChatInput = null;
  syncChatViewport(findChatPage(input), forceLatest && Boolean(input));
}

function observeMountedChats() {
  const root = document.getElementById('root');
  if (!root) return;

  const observer = new MutationObserver((records) => {
    if (managedSurfaces && !document.contains(managedSurfaces.page)) {
      clearMobileChatViewportStyles();
    }

    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        const page = node.matches('.chat-page')
          ? (node as HTMLElement)
          : node.querySelector<HTMLElement>('.chat-page');
        if (!page) continue;
        settleChatViewport(page, true);
        return;
      }
    }
  });

  observer.observe(root, { childList: true, subtree: true });
}

export function installMobileChatViewportRuntime() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined')
    return;
  installed = true;

  document.addEventListener('focusin', (event) => {
    if (!isChatInput(event.target)) return;
    activeChatInput = event.target;
    settleChatViewport(findChatPage(event.target), true);
  });

  document.addEventListener('focusout', (event) => {
    if (!isChatInput(event.target)) return;
    window.setTimeout(() => {
      if (isChatInput(document.activeElement)) {
        activeChatInput = document.activeElement;
        return;
      }
      activeChatInput = null;
      settleChatViewport(findChatPage(), true);
    }, 0);
  });

  const handleViewportChange = () => {
    const inputFocused = Boolean(
      activeChatInput &&
      document.contains(activeChatInput) &&
      document.activeElement === activeChatInput,
    );
    const page = findChatPage(activeChatInput);
    syncChatViewport(page, inputFocused);
    if (inputFocused) {
      window.requestAnimationFrame(() => syncChatViewport(page, true));
    }
  };

  window.visualViewport?.addEventListener('resize', handleViewportChange);
  window.visualViewport?.addEventListener('scroll', handleViewportChange);
  window.addEventListener('resize', handleViewportChange);

  const handleNavigation = () => {
    window.requestAnimationFrame(() => settleChatViewport(findChatPage(), true));
  };
  window.addEventListener(NAVIGATION_EVENT, handleNavigation);
  window.addEventListener('popstate', handleNavigation);
  window.addEventListener('pageshow', handleNavigation);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') handleNavigation();
  });

  observeMountedChats();
  settleChatViewport(findChatPage(), true);
  syncFromActiveInput(true);
}
