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

let installed = false;
let activeChatInput: HTMLTextAreaElement | null = null;
let settleTimerIds: number[] = [];

export function resolveMobileChatViewportMetrics(
  visualViewport: MobileChatVisualViewport | null | undefined,
  fallbackHeight: number,
): MobileChatViewportMetrics {
  return {
    height: Math.round(visualViewport?.height ?? fallbackHeight),
    offsetTop: Math.max(0, Math.round(visualViewport?.offsetTop ?? 0)),
  };
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

function setMobileChatViewportHeight(page: HTMLElement) {
  const workspace = page.closest<HTMLElement>('.messages-workspace.is-thread-open');
  const detail = page.closest<HTMLElement>('.messages-detail');

  if (!window.matchMedia(MOBILE_CHAT_QUERY).matches) {
    for (const element of [workspace, detail, page]) {
      element?.style.removeProperty('height');
      element?.style.removeProperty('min-height');
    }
    workspace?.style.removeProperty('transform');
    return;
  }

  const { height: viewportHeight, offsetTop } = resolveMobileChatViewportMetrics(
    window.visualViewport,
    window.innerHeight,
  );
  if (viewportHeight <= 0) return;
  const height = `${viewportHeight}px`;

  for (const element of [workspace, detail, page]) {
    if (!element) continue;
    element.style.height = height;
    element.style.minHeight = height;
  }

  if (workspace) {
    if (offsetTop > 0) {
      workspace.style.transform = `translate3d(0, ${offsetTop}px, 0)`;
    } else {
      workspace.style.removeProperty('transform');
    }
  }
}

function scrollChatToLatest(page: HTMLElement) {
  const timeline = page.querySelector<HTMLElement>(CHAT_TIMELINE_SELECTOR);
  if (!timeline) return;
  timeline.scrollTop = timeline.scrollHeight;
}

function syncChatViewport(page: HTMLElement | null, forceLatest: boolean) {
  if (!page) return;
  setMobileChatViewportHeight(page);
  if (forceLatest) scrollChatToLatest(page);
}

function clearSettleTimers() {
  for (const timerId of settleTimerIds) window.clearTimeout(timerId);
  settleTimerIds = [];
}

function settleChatViewport(page: HTMLElement | null, forceLatest = true) {
  if (!page) return;
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
