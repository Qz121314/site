import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type PwaManifest = {
  name?: unknown;
};

const INSTALL_PROMPT_DELAY_MS = 30_000;
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000;
const DISMISSED_KEY = 'storefront:pwa-install-dismissed:v2';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as NavigatorWithStandalone).standalone)
  );
}

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/u.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function hasActiveDismissal(): boolean {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY));
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
    if (Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return true;
    window.localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // Storage may be unavailable in private or restricted browsing contexts.
  }
  return false;
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

export function PwaInstallPrompt() {
  const [appName, setAppName] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [delayComplete, setDelayComplete] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/manifest.webmanifest', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<PwaManifest>;
      })
      .then((manifest) => {
        if (!manifest || typeof manifest.name !== 'string' || !manifest.name.trim())
          return;
        const name = manifest.name.trim();
        setAppName(name);
        syncAppMetadata(name);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isStandalone() || hasActiveDismissal()) return;

    let remainingMs = INSTALL_PROMPT_DELAY_MS;
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    let timer: number | null = null;

    const clearDelayTimer = () => {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    };

    const scheduleDelay = () => {
      clearDelayTimer();
      if (visibleSince === null) return;
      if (remainingMs <= 0) {
        setDelayComplete(true);
        return;
      }
      timer = window.setTimeout(() => {
        timer = null;
        remainingMs = 0;
        setDelayComplete(true);
      }, remainingMs);
    };

    const handleVisibilityChange = () => {
      const now = Date.now();
      if (visibleSince !== null) {
        remainingMs = Math.max(0, remainingMs - (now - visibleSince));
        visibleSince = null;
      }
      if (document.visibilityState === 'visible') {
        visibleSince = now;
        scheduleDelay();
      } else {
        clearDelayTimer();
      }
    };

    scheduleDelay();

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (isIosDevice()) {
      setShowIosHint(true);
    }

    return () => {
      clearDelayTimer();
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // A dismissal only affects presentation, so storage failures are non-fatal.
    }
  };

  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setInstallEvent(null);
        return;
      }
      dismiss();
    } catch {
      setInstallEvent(null);
    }
  };

  if (
    !appName ||
    !delayComplete ||
    dismissed ||
    installed ||
    (!installEvent && !showIosHint)
  )
    return null;

  return (
    <aside
      className={`pwa-install-card${showIosHint && !installEvent ? ' is-guidance' : ''}`}
      aria-label="Install app"
      aria-live="polite"
    >
      <span className="pwa-install-handle" aria-hidden="true" />
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
        <button
          className="pwa-install-action"
          type="button"
          onClick={() => void install()}
        >
          Install
        </button>
      ) : null}
      <button
        className="pwa-install-dismiss"
        type="button"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  );
}
