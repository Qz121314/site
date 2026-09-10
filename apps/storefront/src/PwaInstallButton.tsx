import { StorefrontIconButton } from '@site/storefront-ui/icon-button';
import { Download } from 'lucide-react';
import { useSyncExternalStore } from 'react';
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
  const installAvailable = Boolean(getPwaInstallEvent());
  const shouldShow = Boolean(
    runtime?.config.enabled &&
    !isPwaInstalled() &&
    !isStandalone() &&
    (installAvailable || isIosDevice()),
  );

  if (!shouldShow) return null;

  const handleClick = async () => {
    if (installAvailable) {
      await requestPwaInstall();
      return;
    }
    window.dispatchEvent(new Event('storefront:pwa-install-request'));
  };

  return (
    <StorefrontIconButton
      aria-label="安装应用"
      className="pwa-install-button"
      onClick={() => void handleClick()}
      size="small"
      title="安装应用"
      variant="soft"
    >
      <Download aria-hidden="true" />
      <span>安装</span>
    </StorefrontIconButton>
  );
}
