const MOBILE_CHAT_QUERY = '(max-width: 767px)';
const CHAT_PAGE_SELECTOR = '.messages-workspace.is-thread-open .chat-page';
const CHAT_INPUT_SELECTOR = '.chat-composer textarea';
const CHAT_TIMELINE_SELECTOR = '.chat-timeline';
const NAVIGATION_EVENT = 'storefront:navigate';

type MobileChatVisualViewport = Pick<VisualViewport, 'height' | 'offsetTop'>;

export type MobileChatViewportMetrics = {
  height: number;
  offsetTop: number;
};

type MobileChatSurfaces = {
  main: HTMLElement | null;
  route: HTMLElement | null;
  pushHost: HTMLElement | null;
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

export function shouldUseMobileChatVisualViewportFallback(
  visualViewportHeight: number,
  layoutViewportHeight: number,
): boolean {
  return Math.abs(Math.round(visualViewportHeight) - Math.round(layoutViewportHeight)) > 1;
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

function findMobileChatSurfaces(page: HTMLElement): MobileChatSurfaces {
  return {
    main: page.closest<HTMLElement>('main'),
    route: page.closest<HTMLElement>('.storefront-route-view'),
    pushHost: page.closest<HTMLElement>('.messages-push-host'),
    workspace: page.closest<HTMLElement>('.messages-workspace.is-thread-open'),
    detail: page.closest<HTMLElement>('.messages-detail'),
    page,
  };
}

function clearNestedViewportStyles(surfaces: MobileChatSurfaces) {
  const { route, pushHost, workspace, detail, page } = surfaces;
  for (const element of [route, pushHost, workspace, detail, page]) {
    element?.style.removeProperty('height');
    element?.style.removeProperty('min-height');
    element?.style.removeProperty('transform');
  }
}

function clearOuterViewportStyles(main: HTMLElement | null) {
  main?.style.removeProperty('height');
  main?.style.removeProperty('min-height');
  main?.style.removeProperty('transform');
}

function clearMobileChatViewportStyles(surfaces = managedSurfaces) {
  if (!surfaces) return;
  clearNestedViewportStyles(surfaces);
  clearOuterViewportStyles(surfaces.main);
  if (managedSurfaces === surfaces) managedSurfaces = null;
}

function setMobileChatViewportHeight(page: HTMLElement) {
  if (!window.matchMedia(MOBILE_CHAT_QUERY).matches) {
    clearMobileChatViewportStyles();
    return;
  }

  const visualViewport = window.visualViewport;
  const { height: viewportHeight, offsetTop } = resolveMobileChatViewportMetrics(
    visualViewport,
    window.innerHeight,
  );
  if (viewportHeight <= 0) return;

  const nextSurfaces = findMobileChatSurfaces(page);
  if (managedSurfaces && managedSurfaces.page !== page) {
    clearMobileChatViewportStyles(managedSurfaces);
  }
  managedSurfaces = nextSurfaces;

  // Nested chat layers never receive their own pixel viewport heights. They form
  // one 100%-height chain so the composer has a single containing block.
  clearNestedViewportStyles(nextSurfaces);
  const main = nextSurfaces.main;
  if (!main) return;

  const layoutViewportHeight = Math.round(
    document.documentElement.clientHeight || window.innerHeight,
  );
  const needsVisualViewportFallback =
    Boolean(visualViewport) &&
    shouldUseMobileChatVisualViewportFallback(viewportHeight, layoutViewportHeight);

  if (!needsVisualViewportFallback) {
    // Modern Android Chrome with interactive-widget=resizes-content already
    // resizes the layout viewport above the software keyboard. Let 100dvh own
    // that geometry instead of applying a second JavaScript resize.
    clearOuterViewportStyles(main);
    return;
  }

  // Browsers whose layout viewport does not follow the visual viewport (notably
  // some iOS/legacy cases) get one fallback pixel height on the outer main only.
  main.style.height = `${viewportHeight}px`;
  main.style.minHeight = '0px';
  if (offsetTop > 0) {
    main.style.transform = `translate3d(0, ${offsetTop}px, 0)`;
  } else {
    main.style.removeProperty('transform');
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
