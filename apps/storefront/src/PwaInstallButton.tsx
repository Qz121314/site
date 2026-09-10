import { StorefrontIconButton } from '@site/storefront-ui/icon-button';
import { Download } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import {
  getPwaInstallEvent,
  getPwaInstallRuntime,
  isPwaInstalled,
  requestPwaInstall,
  subscribePwaInstallRuntime,
} from './pwa-install-runtime';

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/u.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function PwaInstallButton() {
  const runtime = useSyncExternalStore(
    subscribePwaInstallRuntime,
    getPwaInstallRuntime,
    getPwaInstallRuntime,
  );
  const [status, setStatus] = useState<string | null>(null);
  const shouldShow = Boolean(runtime?.appName && !isPwaInstalled() && !isStandalone());

  if (!shouldShow) return null;

  const handleClick = async () => {
    // The browser can dispatch beforeinstallprompt after this component renders.
    // Read the runtime at click time so we never use a stale availability value.
    if (getPwaInstallEvent()) {
      const outcome = await requestPwaInstall();
      if (outcome === 'accepted') setStatus('App installed');
      else if (outcome === 'dismissed') setStatus('Installation canceled');
      else setStatus('Installation is not available right now. Please try again');
      return;
    }
    if (isIosDevice()) {
      window.dispatchEvent(new Event('storefront:pwa-install-request'));
      setStatus('Tap your browser’s Share button, then select “Add to Home Screen”');
      window.setTimeout(() => setStatus(null), 4_000);
      return;
    }
    setStatus('Open your browser menu to add this site to your home screen');
    window.setTimeout(() => setStatus(null), 4_000);
  };

  return (
    <div className="pwa-install-control">
      <StorefrontIconButton
        aria-label="Install app"
        className="pwa-install-button"
        onClick={() => void handleClick()}
        size="small"
        title="Install app"
        variant="soft"
      >
        <Download aria-hidden="true" />
      </StorefrontIconButton>
      {status ? (
        <span className="pwa-install-status" role="status">
          {status}
        </span>
      ) : null}
    </div>
  );
}
