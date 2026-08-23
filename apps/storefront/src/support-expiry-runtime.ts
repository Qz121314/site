import type { SupportGateway } from './support-contract';

const NAVIGATION_EVENT = 'storefront:navigate';
const COUNTDOWN_CLASS = 'chat-expiry-countdown';
const EXPIRED_CLASS = 'is-expired';

let installed = false;
let routeVersion = 0;
let countdownTimer: number | null = null;
let expiryRedirectTimer: number | null = null;
let supportGatewayPromise: Promise<SupportGateway> | null = null;

function activeConversationRef(): string | null {
  const match = window.location.pathname.match(/^\/messages\/([^/]+)\/?$/u);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function loadSupportGateway(): Promise<SupportGateway> {
  if (!supportGatewayPromise) {
    supportGatewayPromise = import('./support-gateway')
      .then((module) => module.siteSupportGateway)
      .catch((error: unknown) => {
        supportGatewayPromise = null;
        throw error;
      });
  }
  return supportGatewayPromise;
}

function clearTimers() {
  if (countdownTimer !== null) window.clearInterval(countdownTimer);
  if (expiryRedirectTimer !== null) window.clearTimeout(expiryRedirectTimer);
  countdownTimer = null;
  expiryRedirectTimer = null;
}

function removeCountdown() {
  document.querySelector(`.${COUNTDOWN_CLASS}`)?.remove();
}

function countdownHost(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(
      '.messages-workspace.is-thread-open .chat-header-copy',
    ) ??
    document.querySelector<HTMLElement>('.messages-workspace.is-thread-open .chat-header')
  );
}

function ensureCountdown(): HTMLSpanElement | null {
  const host = countdownHost();
  if (!host) return null;
  const existing = host.querySelector<HTMLSpanElement>(`.${COUNTDOWN_CLASS}`);
  if (existing) return existing;
  const countdown = document.createElement('span');
  countdown.className = COUNTDOWN_CLASS;
  countdown.setAttribute('aria-live', 'off');
  countdown.setAttribute('role', 'timer');
  host.append(countdown);
  return countdown;
}

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function disableExpiredComposer() {
  const composer = document.querySelector<HTMLElement>(
    '.messages-workspace.is-thread-open .chat-composer',
  );
  composer?.classList.add('is-disabled');
  composer?.setAttribute('aria-disabled', 'true');
  for (const control of composer?.querySelectorAll<
    HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement
  >('button, input, textarea') ?? []) {
    control.disabled = true;
  }
}

function renderCountdown(expiresAt: number) {
  const countdown = ensureCountdown();
  if (!countdown) return;
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    countdown.classList.add(EXPIRED_CLASS);
    countdown.textContent = 'Conversation expired · deleting…';
    disableExpiredComposer();
    if (expiryRedirectTimer === null) {
      expiryRedirectTimer = window.setTimeout(() => {
        window.location.replace('/messages/');
      }, 900);
    }
    return;
  }
  countdown.classList.remove(EXPIRED_CLASS);
  countdown.textContent = `Deletes in ${formatRemaining(remaining)}`;
}

async function syncConversationExpiry() {
  const version = ++routeVersion;
  clearTimers();
  removeCountdown();
  const conversationRef = activeConversationRef();
  if (!conversationRef) return;

  try {
    const siteSupportGateway = await loadSupportGateway();
    const conversation = await siteSupportGateway.getConversation(conversationRef);
    if (version !== routeVersion) return;
    if (!conversation) {
      window.location.replace('/messages/');
      return;
    }
    const expiresAt = Date.parse(conversation.expiresAt);
    if (!Number.isFinite(expiresAt)) return;

    const mountAndRender = () => renderCountdown(expiresAt);
    mountAndRender();
    window.requestAnimationFrame(mountAndRender);
    window.setTimeout(mountAndRender, 120);
    countdownTimer = window.setInterval(mountAndRender, 1000);
  } catch {
    // The normal Messages data flow owns request errors. The countdown is optional UI.
  }
}

export function installSupportExpiryRuntime() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined')
    return;
  installed = true;

  const sync = () => void syncConversationExpiry();
  window.addEventListener(NAVIGATION_EVENT, sync);
  window.addEventListener('popstate', sync);
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync();
  });

  const root = document.getElementById('root');
  if (root) {
    const observer = new MutationObserver(() => {
      if (!activeConversationRef()) return;
      const countdown = document.querySelector(`.${COUNTDOWN_CLASS}`);
      if (!countdown && countdownTimer !== null) sync();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  sync();
}
