export {};

type AdminHistoryState = {
  admin?: boolean;
  adminUrl?: string;
  adminScrollX?: number;
  adminScrollY?: number;
};

type PendingRestoration = {
  url: string;
  left: number;
  top: number;
};

let pendingRestoration: PendingRestoration | null = null;

function canonicalUrl(value: string | URL): string {
  const url = new URL(value, window.location.href);
  url.hash = "";
  return url.href;
}

function readHistoryState(value: unknown): AdminHistoryState {
  return value && typeof value === "object" ? value as AdminHistoryState : {};
}

function finitePosition(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function replaceCurrentEntry(urlValue = window.location.href, left = window.scrollX, top = window.scrollY): void {
  const url = canonicalUrl(urlValue);
  const state = readHistoryState(history.state);
  history.replaceState({
    ...state,
    admin: true,
    adminUrl: url,
    adminScrollX: Math.max(0, left),
    adminScrollY: Math.max(0, top),
  }, "", url);
}

function preserveCurrentPosition(): void {
  replaceCurrentEntry(window.location.href, window.scrollX, window.scrollY);
}

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

queueMicrotask(preserveCurrentPosition);

// Capture the page being left before the router pushes or replaces the next entry.
document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (!link || !link.closest(".admin-frame") || link.target || link.hasAttribute("download")) return;

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) return;
  preserveCurrentPosition();
}, true);

document.addEventListener("submit", (event) => {
  if (!(event.target instanceof HTMLFormElement)) return;
  const form = event.target;
  if (!form.closest(".admin-content") || form.target) return;
  const method = (form.method || "get").toUpperCase();
  if (method === "GET" || method === "POST") preserveCurrentPosition();
}, true);

// This listener is registered before the router so cached popstate navigations can
// restore immediately when the router dispatches admin:navigation synchronously.
window.addEventListener("popstate", (event) => {
  const state = readHistoryState(event.state);
  const targetUrl = typeof state.adminUrl === "string"
    ? canonicalUrl(state.adminUrl)
    : canonicalUrl(window.location.href);
  pendingRestoration = {
    url: targetUrl,
    left: finitePosition(state.adminScrollX),
    top: finitePosition(state.adminScrollY),
  };

  // A cancelled dirty-form navigation pushes the current URL back synchronously.
  queueMicrotask(() => {
    if (pendingRestoration?.url === targetUrl && canonicalUrl(window.location.href) !== targetUrl) {
      pendingRestoration = null;
    }
  });
});

document.addEventListener("admin:navigation", (event) => {
  const detail = event instanceof CustomEvent
    ? event.detail as { url?: string } | undefined
    : undefined;
  const navigationUrl = canonicalUrl(detail?.url ?? window.location.href);
  const restoration = pendingRestoration?.url === navigationUrl ? pendingRestoration : null;
  pendingRestoration = null;

  // The router updates history immediately after dispatching this event.
  queueMicrotask(() => {
    replaceCurrentEntry(
      window.location.href,
      restoration?.left ?? window.scrollX,
      restoration?.top ?? window.scrollY,
    );
    if (!restoration) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ left: restoration.left, top: restoration.top, behavior: "auto" });
    });
  });
});

window.addEventListener("pagehide", preserveCurrentPosition);
