import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const DISMISSED_KEY = 'storefront:pwa-install-dismissed:v1';

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as NavigatorWithStandalone).standalone);
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/u.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function syncAppMetadata(appName: string) {
  const title = appName.trim();
  if (!title) return;

  const ensureMeta = (name: string) => {
    let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.name = name;
      document.head.append(element);
    }
    element.content = title;
  };

  ensureMeta('application-name');
  ensureMeta('apple-mobile-web-app-title');
}

export function PwaInstallPrompt({ appName }: { appName: string }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    syncAppMetadata(appName);
    if (isStandalone()) return;

    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === '1') return;
    } catch {
      // Storage may be unavailable in private or restricted browsing contexts.
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const handleInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (isIosDevice()) {
      setShowIosHint(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [appName]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // A dismissal only affects presentation, so storage failures are non-fatal.
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
      setInstallEvent(null);
      return;
    }
    dismiss();
  };

  if (!visible || (!installEvent && !showIosHint)) return null;

  return (
    <aside className="pwa-install-card" aria-label="Install app">
      <div className="pwa-install-icon" aria-hidden="true">
        <img src="/icons/app-icon-192.svg" alt="" />
      </div>
      <div className="pwa-install-copy">
        <strong>Install {appName}</strong>
        <span>
          {installEvent
            ? 'Add it to your Home Screen and open it like an app.'
            : 'Tap Share, then choose Add to Home Screen.'}
        </span>
      </div>
      {installEvent ? (
        <button className="pwa-install-action" type="button" onClick={() => void install()}>
          Install
        </button>
      ) : null}
      <button className="pwa-install-dismiss" type="button" aria-label="Dismiss install prompt" onClick={dismiss}>
        ×
      </button>
    </aside>
  );
}
