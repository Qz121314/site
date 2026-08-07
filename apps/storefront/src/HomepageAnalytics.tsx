import { useEffect } from 'react';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
};

let initializedMeasurementId: string | null = null;

function dataLayer(): unknown[] {
  const target = window as AnalyticsWindow;
  target.dataLayer ??= [];
  return target.dataLayer;
}

function gtag(...args: unknown[]) {
  dataLayer().push(args);
}

function ensureGoogleTag(measurementId: string) {
  if (initializedMeasurementId === measurementId) return;

  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-ga4-measurement-id="${CSS.escape(measurementId)}"]`,
  );
  if (!existing) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.ga4MeasurementId = measurementId;
    document.head.append(script);
  }

  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: false });
  initializedMeasurementId = measurementId;
}

function trackHomepage(measurementId: string) {
  if (window.location.pathname !== '/') return;
  ensureGoogleTag(measurementId);
  gtag('event', 'page_view', {
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function HomepageAnalytics({ measurementId }: { measurementId: string | null }) {
  useEffect(() => {
    const normalized = measurementId?.trim();
    if (!normalized) return;
    trackHomepage(normalized);
  }, [measurementId]);

  return null;
}
