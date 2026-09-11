import { lazy, Suspense, useEffect, useState } from 'react';
import { parseStorefrontRoute } from './routing';

const PwaInstallPrompt = lazy(() =>
  import('./PwaInstallPrompt').then((module) => ({ default: module.PwaInstallPrompt })),
);

export function DeferredPwaInstallPrompt() {
  const isLanding = parseStorefrontRoute(window.location.pathname).type === 'landing';
  const [ready, setReady] = useState(
    () => new URLSearchParams(window.location.search).get('pwa-install') === '1',
  );

  useEffect(() => {
    if (ready || isLanding) return;
    const activate = () => {
      const schedule =
        window.requestIdleCallback ??
        ((callback: IdleRequestCallback) => window.setTimeout(callback, 2_000));
      schedule(() => setReady(true));
    };
    if (document.readyState === 'complete') activate();
    else window.addEventListener('load', activate, { once: true });
    return () => window.removeEventListener('load', activate);
  }, [isLanding, ready]);

  return !isLanding && ready ? (
    <Suspense fallback={null}>
      <PwaInstallPrompt />
    </Suspense>
  ) : null;
}
