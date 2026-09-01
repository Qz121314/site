let chatKeyboardAnchorRuntimeInstalled = false;

function resolveChatTimeline(element: Element | null): HTMLElement | null {
  if (!(element instanceof HTMLTextAreaElement)) return null;
  const composer = element.closest<HTMLElement>(
    '.messages-workspace.is-thread-open .chat-composer',
  );
  if (!composer) return null;
  return (
    composer
      .closest<HTMLElement>('.chat-page')
      ?.querySelector<HTMLElement>('.chat-timeline') ?? null
  );
}

export function installChatKeyboardAnchorRuntime(): void {
  if (chatKeyboardAnchorRuntimeInstalled) return;
  chatKeyboardAnchorRuntimeInstalled = true;

  let activeTimeline: HTMLElement | null = null;
  let frame: number | null = null;
  let timelineResizeObserver: ResizeObserver | null = null;

  const pinLatestMessage = () => {
    frame = null;
    const target = activeTimeline;
    if (!target) return;
    target.scrollTop = target.scrollHeight;
  };

  const schedulePin = () => {
    if (!activeTimeline) return;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(pinLatestMessage);
  };

  const stopTracking = () => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    timelineResizeObserver?.disconnect();
    timelineResizeObserver = null;
    activeTimeline = null;
  };

  const startTracking = (element: Element | null) => {
    const timeline = resolveChatTimeline(element);
    if (!timeline) return false;
    if (activeTimeline !== timeline) {
      stopTracking();
      activeTimeline = timeline;
      if ('ResizeObserver' in window) {
        timelineResizeObserver = new ResizeObserver(schedulePin);
        timelineResizeObserver.observe(timeline);
      }
    }
    schedulePin();
    return true;
  };

  document.addEventListener('focusin', (event) => {
    startTracking(event.target instanceof Element ? event.target : null);
  });

  document.addEventListener('focusout', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!resolveChatTimeline(target)) return;
    requestAnimationFrame(() => {
      if (startTracking(document.activeElement)) return;
      stopTracking();
    });
  });

  const visualViewport = window.visualViewport;
  visualViewport?.addEventListener('resize', schedulePin, { passive: true });
  visualViewport?.addEventListener('scroll', schedulePin, { passive: true });
  window.addEventListener('resize', schedulePin, { passive: true });
  window.addEventListener('orientationchange', schedulePin, { passive: true });
}
