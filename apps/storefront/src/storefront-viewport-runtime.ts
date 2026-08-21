type ViewportMetrics = {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

let viewportRuntimeInstalled = false;

function roundedPixels(value: number): string {
  const normalized = Math.max(0, Math.round(value * 100) / 100);
  return `${normalized}px`;
}

function currentViewportMetrics(): ViewportMetrics {
  const viewport = window.visualViewport;
  const layoutWidth = window.innerWidth;
  const layoutHeight = window.innerHeight;
  const width = viewport?.width ?? layoutWidth;
  const height = viewport?.height ?? layoutHeight;
  const top = viewport?.offsetTop ?? 0;
  const left = viewport?.offsetLeft ?? 0;

  return {
    width,
    height,
    top,
    left,
    right: Math.max(0, layoutWidth - left - width),
    bottom: Math.max(0, layoutHeight - top - height),
  };
}

function isTextEntryElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }
  if (element instanceof HTMLInputElement) {
    return !element.disabled && !element.readOnly && !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  return element.isContentEditable;
}

function writeTextEntryState(): void {
  document.documentElement.dataset.appTextEntry = isTextEntryElement(document.activeElement)
    ? 'active'
    : 'idle';
}

function writeViewportMetrics(): void {
  const root = document.documentElement;
  const metrics = currentViewportMetrics();
  root.style.setProperty('--app-viewport-width', roundedPixels(metrics.width));
  root.style.setProperty('--app-viewport-height', roundedPixels(metrics.height));
  root.style.setProperty('--app-viewport-top', roundedPixels(metrics.top));
  root.style.setProperty('--app-viewport-right', roundedPixels(metrics.right));
  root.style.setProperty('--app-viewport-bottom', roundedPixels(metrics.bottom));
  root.style.setProperty('--app-viewport-left', roundedPixels(metrics.left));
  root.dataset.visualViewport = window.visualViewport ? 'active' : 'fallback';
  writeTextEntryState();
}

export function installStorefrontViewportRuntime(): void {
  if (viewportRuntimeInstalled) return;
  viewportRuntimeInstalled = true;

  let frame: number | null = null;
  const schedule = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      writeViewportMetrics();
    });
  };

  writeViewportMetrics();

  const visualViewport = window.visualViewport;
  visualViewport?.addEventListener('resize', schedule, { passive: true });
  visualViewport?.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  window.addEventListener('pageshow', schedule, { passive: true });
  document.addEventListener('visibilitychange', schedule, { passive: true });
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
}

function renderedHeight(element: HTMLElement | null): number {
  if (!element || getComputedStyle(element).display === 'none') return 0;
  return element.getBoundingClientRect().height;
}

function writeChromeMetric(name: string, value: number): void {
  document.documentElement.style.setProperty(name, roundedPixels(value));
}

export function observeStorefrontShellChrome(shell: HTMLElement): () => void {
  let frame: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let observedElements: HTMLElement[] = [];

  const currentElements = () => {
    const header = shell.querySelector<HTMLElement>(':scope > .topbar');
    const bottomChrome = shell.querySelector<HTMLElement>(
      ':scope > .storefront-bottom-chrome',
    );
    return { header, bottomChrome };
  };

  const measure = () => {
    frame = null;
    writeViewportMetrics();
    const { header, bottomChrome } = currentElements();
    writeChromeMetric('--app-header-height', renderedHeight(header));
    writeChromeMetric('--app-bottom-chrome-height', renderedHeight(bottomChrome));
  };

  const schedule = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };

  const refreshResizeTargets = () => {
    if (!resizeObserver) {
      schedule();
      return;
    }
    for (const element of observedElements) resizeObserver.unobserve(element);
    observedElements = Object.values(currentElements()).filter(
      (element): element is HTMLElement => element !== null,
    );
    for (const element of observedElements) resizeObserver.observe(element);
    schedule();
  };

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(schedule);
  }

  const mutationObserver = new MutationObserver(refreshResizeTargets);
  mutationObserver.observe(shell, { childList: true });

  window.addEventListener('resize', schedule, { passive: true });
  refreshResizeTargets();
  measure();

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener('resize', schedule);
  };
}
