import { lazy, Suspense, useEffect, useState } from 'react';

const PwaInstallPrompt = lazy(() =>
  import('./PwaInstallPrompt').then((module) => ({ default: module.PwaInstallPrompt })),
);

export function DeferredPwaInstallPrompt() {
  const [ready, setReady] = useState(
    () => new URLSearchParams(window.location.search).get('pwa-install') === '1',
  );

  useEffect(() => {
    if (ready) return;
    const activate = () => {
      const schedule =
        window.requestIdleCallback ??
        ((callback: IdleRequestCallback) => window.setTimeout(callback, 2_000));
      schedule(() => setReady(true));
    };
    if (document.readyState === 'complete') activate();
    else window.addEventListener('load', activate, { once: true });
    return () => window.removeEventListener('load', activate);
  }, [ready]);

  return ready ? (
    <Suspense fallback={null}>
      <PwaInstallPrompt />
    </Suspense>
  ) : null;
}
