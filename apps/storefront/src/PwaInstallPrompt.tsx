import { StorefrontIconButton } from '@site/storefront-ui/icon-button';
import { X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getPwaInstallRuntime, subscribePwaInstallRuntime } from './pwa-install-runtime';
import { parseStorefrontRoute } from './routing';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const NAVIGATION_EVENT = 'storefront:navigate';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1_000;
const DISMISSED_KEY = 'storefront:pwa-install-dismissed:v3';
const SESSION_PROMPTED_KEY = 'storefront:pwa-install-presented:v1';
const ENGAGEMENT_SCROLL_PX = 420;
const ENGAGEMENT_ROUTE_COUNT = 2;

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

function hasSessionPrompted(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_PROMPTED_KEY) === '1';
  } catch {
    return false;
  }
}

function markSessionPrompted(): void {
  try {
    window.sessionStorage.setItem(SESSION_PROMPTED_KEY, '1');
  } catch {
    // Session-level suppression is optional when storage is unavailable.
  }
}

function clearDismissal(): void {
  try {
    window.localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // Installation success remains authoritative even if storage is unavailable.
  }
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

function routeSignalsStrongIntent(pathname: string): boolean {
  const route = parseStorefrontRoute(pathname);
  return (
    route.type === 'product' ||
    route.type === 'faq-article' ||
    route.type === 'message' ||
    route.type === 'message-compose'
  );
}

function routeCountsAsBrowsing(pathname: string): boolean {
  const route = parseStorefrontRoute(pathname);
  return route.type !== 'home' && route.type !== 'not-found';
}

function scrollDepthFromEvent(event: Event): number {
  const target = event.target;
  if (target instanceof HTMLElement) return target.scrollTop;
  return Math.max(window.scrollY, document.documentElement.scrollTop);
}

export function PwaInstallPrompt() {
  const runtime = useSyncExternalStore(
    subscribePwaInstallRuntime,
    getPwaInstallRuntime,
    getPwaInstallRuntime,
  );
  const appName = runtime?.appName ?? null;
  const config = runtime?.config ?? null;
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [delayComplete, setDelayComplete] = useState(false);
  const [engaged, setEngaged] = useState(() =>
    routeSignalsStrongIntent(window.location.pathname),
  );
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [sessionSuppressed] = useState(hasSessionPrompted);

  useEffect(() => {
    if (appName) syncAppMetadata(appName);
  }, [appName]);

  useEffect(() => {
    if (installed || sessionSuppressed || hasActiveDismissal()) return;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      clearDismissal();
      setInstalled(true);
      setInstallEvent(null);
      setShowIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (isIosDevice()) {
      setShowIosHint(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [installed, sessionSuppressed]);

  useEffect(() => {
    if (engaged || installed || sessionSuppressed || hasActiveDismissal()) return;

    const visitedPaths = new Set<string>();
    const recordCurrentRoute = () => {
      const pathname = window.location.pathname;
      if (routeSignalsStrongIntent(pathname)) {
        setEngaged(true);
        return;
      }
      if (!routeCountsAsBrowsing(pathname)) return;
      visitedPaths.add(pathname);
      if (visitedPaths.size >= ENGAGEMENT_ROUTE_COUNT) setEngaged(true);
    };
    const handleScroll = (event: Event) => {
      if (scrollDepthFromEvent(event) >= ENGAGEMENT_SCROLL_PX) setEngaged(true);
    };

    recordCurrentRoute();
    window.addEventListener(NAVIGATION_EVENT, recordCurrentRoute);
    window.addEventListener('popstate', recordCurrentRoute);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener(NAVIGATION_EVENT, recordCurrentRoute);
      window.removeEventListener('popstate', recordCurrentRoute);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [engaged, installed, sessionSuppressed]);

  useEffect(() => {
    if (!config?.enabled || installed || sessionSuppressed || hasActiveDismissal())
      return;
    setDelayComplete(false);
    let remainingMs = config.delaySeconds * 1_000;
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
        if (remainingMs === 0) setDelayComplete(true);
        else scheduleDelay();
      } else {
        clearDelayTimer();
      }
    };

    scheduleDelay();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearDelayTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [config, installed, sessionSuppressed]);

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
        clearDismissal();
        setInstalled(true);
        setInstallEvent(null);
        return;
      }
      dismiss();
    } catch {
      setInstallEvent(null);
    }
  };

  const shouldShow = Boolean(
    config?.enabled &&
    appName &&
    delayComplete &&
    engaged &&
    !sessionSuppressed &&
    !dismissed &&
    !installed &&
    (installEvent || showIosHint),
  );

  useEffect(() => {
    if (shouldShow) markSessionPrompted();
  }, [shouldShow]);

  if (!shouldShow || !config || !appName) return null;

  return (
    <aside
      className={`pwa-install-card${showIosHint && !installEvent ? ' is-guidance' : ''}`}
      aria-label={config.title}
      aria-live="polite"
    >
      <span className="pwa-install-handle" aria-hidden="true" />
      <div className="pwa-install-icon" aria-hidden="true">
        <img src="/api/public/pwa/icon/192" alt="" />
      </div>
      <div className="pwa-install-copy">
        <strong>{config.title || appName}</strong>
        <span>{installEvent ? config.description : config.iosDescription}</span>
      </div>
      {installEvent ? (
        <button
          className="pwa-install-action"
          type="button"
          onClick={() => void install()}
        >
          {config.installLabel}
        </button>
      ) : null}
      <StorefrontIconButton
        className="pwa-install-dismiss"
        size="small"
        aria-label={config.dismissLabel}
        title={config.dismissLabel}
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </StorefrontIconButton>
    </aside>
  );
}
