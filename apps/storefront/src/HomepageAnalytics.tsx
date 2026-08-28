import { useEffect } from 'react';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
};

const GOOGLE_TAG_SCRIPT_ID = 'storefront-ga4-script';
const GOOGLE_TAG_IDLE_TIMEOUT_MS = 1000;
const initializedMeasurementIds = new Set<string>();
let googleTagLoadScheduled = false;

function dataLayer(): unknown[] {
  const target = window as AnalyticsWindow;
  target.dataLayer ??= [];
  return target.dataLayer;
}

function gtag(...args: unknown[]): void;
function gtag() {
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
  if (typeof target.requestIdleCallback === 'function') {
    target.requestIdleCallback(() => loadGoogleTagScript(measurementId), {
      timeout: GOOGLE_TAG_IDLE_TIMEOUT_MS,
    });
    return;
  }

  window.setTimeout(() => loadGoogleTagScript(measurementId), GOOGLE_TAG_IDLE_TIMEOUT_MS);
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
