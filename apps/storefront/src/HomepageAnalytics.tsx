import { useEffect } from 'react';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
};

const GOOGLE_TAG_SCRIPT_ID = 'storefront-ga4-script';
const GOOGLE_TAG_IDLE_TIMEOUT_MS = 3000;
const GOOGLE_TAG_INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;
const initializedMeasurementIds = new Set<string>();
let googleTagLoadScheduled = false;

function dataLayer(): unknown[] {
  const target = window as AnalyticsWindow;
  target.dataLayer ??= [];
  return target.dataLayer;
}

function gtag(..._args: unknown[]) {
  // Google gtag.js requires the Arguments object rather than a rest-parameter array.
  // eslint-disable-next-line prefer-rest-params
  dataLayer().push(arguments);
}

function loadGoogleTagScript(measurementId: string) {
  if (document.getElementById(GOOGLE_TAG_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = GOOGLE_TAG_SCRIPT_ID;
  script.async = true;
  script.fetchPriority = 'low';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}

function scheduleGoogleTagScript(measurementId: string) {
  if (googleTagLoadScheduled || document.getElementById(GOOGLE_TAG_SCRIPT_ID)) return;
  googleTagLoadScheduled = true;

  const target = window as AnalyticsWindow;
  let settled = false;
  const cleanup = () => {
    for (const event of GOOGLE_TAG_INTERACTION_EVENTS) {
      window.removeEventListener(event, loadAfterInteraction);
    }
  };
  const load = () => {
    if (settled) return;
    settled = true;
    cleanup();
    loadGoogleTagScript(measurementId);
  };
  function loadAfterInteraction() {
    load();
  }
  for (const event of GOOGLE_TAG_INTERACTION_EVENTS) {
    window.addEventListener(event, loadAfterInteraction, { once: true, passive: true });
  }

  window.setTimeout(() => {
    if (typeof target.requestIdleCallback === 'function') {
      target.requestIdleCallback(load, { timeout: 1000 });
      return;
    }
    load();
  }, GOOGLE_TAG_IDLE_TIMEOUT_MS);
}

function ensureGoogleTag(measurementId: string) {
  scheduleGoogleTagScript(measurementId);

  if (initializedMeasurementIds.has(measurementId)) return;
  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: false });
  initializedMeasurementIds.add(measurementId);
}

function trackPageView(measurementId: string, pathname: string) {
  ensureGoogleTag(measurementId);
  gtag('event', 'page_view', {
    page_location: window.location.href,
    page_path: pathname,
    page_title: document.title,
  });
}

export function HomepageAnalytics({
  measurementId,
  pathname,
}: {
  measurementId: string | null;
  pathname: string;
}) {
  useEffect(() => {
    const normalized = measurementId?.trim();
    if (!normalized) return;
    trackPageView(normalized, pathname);
  }, [measurementId, pathname]);

  return null;
}
