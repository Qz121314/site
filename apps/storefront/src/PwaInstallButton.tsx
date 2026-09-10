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
  const installAvailable = Boolean(getPwaInstallEvent());
  const [status, setStatus] = useState<string | null>(null);
  const shouldShow = Boolean(runtime?.appName && !isPwaInstalled() && !isStandalone());

  if (!shouldShow) return null;

  const handleClick = async () => {
    if (installAvailable) {
      const outcome = await requestPwaInstall();
      if (outcome === 'accepted') setStatus('已安装');
      else if (outcome === 'dismissed') setStatus('已取消安装');
      else setStatus('当前浏览器暂不支持一键安装');
      return;
    }
    if (isIosDevice()) {
      window.dispatchEvent(new Event('storefront:pwa-install-request'));
      setStatus('请点击浏览器的分享按钮，再选择“添加到主屏幕”');
      window.setTimeout(() => setStatus(null), 4_000);
      return;
    }
    setStatus('当前浏览器暂不支持一键安装，请使用浏览器菜单添加到主屏幕');
    window.setTimeout(() => setStatus(null), 4_000);
  };

  return (
    <div className="pwa-install-control">
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
      {status ? (
        <span className="pwa-install-status" role="status">
          {status}
        </span>
      ) : null}
    </div>
  );
}
