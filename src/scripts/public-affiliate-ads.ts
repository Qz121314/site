export {};

type AffiliateAdSurface = "channel" | "catalog" | "channel-catalog" | "search";
type DisplayType = "banner" | "vertical" | "modal";
type CreativeType = "uploaded_image" | "external_media" | "embed_code";

type AffiliateAdContext = {
  channelSlug: string;
  surface: AffiliateAdSurface;
};

type AffiliateAdvertisement = {
  id: string;
  name: string;
  displayType: DisplayType;
  creativeType: CreativeType;
  imageUrl: string | null;
  mediaUrl: string;
  embedCode: string;
  targetUrl: string;
  width: number;
  height: number;
  openMode: "same" | "new";
};

type AffiliateCandidates = {
  banners: AffiliateAdvertisement[];
  verticals: AffiliateAdvertisement[];
  modals: AffiliateAdvertisement[];
};

type LoadedCreative = {
  advertisement: AffiliateAdvertisement;
  element: HTMLElement;
};

const initializedContexts = new WeakSet<HTMLScriptElement>();
const candidatePromises = new Map<string, Promise<AffiliateCandidates>>();
const userEvents = ["pointerdown", "keydown", "scroll"] as const;
let userInteracted = false;

function validAdvertisement(value: unknown): value is AffiliateAdvertisement {
  if (!value || typeof value !== "object") return false;
  const ad = value as Record<string, unknown>;
  return typeof ad.id === "string"
    && typeof ad.name === "string"
    && ["banner", "vertical", "modal"].includes(String(ad.displayType))
    && ["uploaded_image", "external_media", "embed_code"].includes(String(ad.creativeType))
    && (ad.imageUrl === null || typeof ad.imageUrl === "string")
    && typeof ad.mediaUrl === "string"
    && typeof ad.embedCode === "string"
    && typeof ad.targetUrl === "string"
    && typeof ad.width === "number"
    && ad.width > 0
    && typeof ad.height === "number"
    && ad.height > 0
    && (ad.openMode === "same" || ad.openMode === "new");
}

function parseContext(node: HTMLScriptElement): AffiliateAdContext | null {
  try {
    const value: unknown = JSON.parse(node.textContent || "null");
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.channelSlug !== "string" || !record.channelSlug) return null;
    if (!["channel", "catalog", "channel-catalog", "search"].includes(String(record.surface))) return null;
    return {
      channelSlug: record.channelSlug,
      surface: record.surface as AffiliateAdSurface,
    };
  } catch {
    return null;
  }
}

function currentDevice(): "mobile" | "desktop" {
  return window.matchMedia("(min-width: 1100px)").matches ? "desktop" : "mobile";
}

function waitForAdvertisementStart(): Promise<void> {
  if (document.readyState === "complete" && userInteracted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timer = 0;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      userEvents.forEach((eventName) => window.removeEventListener(eventName, onInteraction));
      window.removeEventListener("load", scheduleFallback);
      resolve();
    };
    const onInteraction = (): void => {
      userInteracted = true;
      finish();
    };
    const scheduleFallback = (): void => {
      timer = window.setTimeout(finish, 2500);
    };

    userEvents.forEach((eventName) => window.addEventListener(eventName, onInteraction, { once: true, passive: true }));
    if (document.readyState === "complete") scheduleFallback();
    else window.addEventListener("load", scheduleFallback, { once: true });
  });
}

function loadCandidates(channelSlug: string, device: "mobile" | "desktop"): Promise<AffiliateCandidates> {
  const key = `${channelSlug}:${device}`;
  const existing = candidatePromises.get(key);
  if (existing) return existing;

  const promise = fetch(
    `/api/public/channels/${encodeURIComponent(channelSlug)}/ads?device=${encodeURIComponent(device)}`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  ).then(async (response) => {
    if (!response.ok) throw new Error(`Advertisement request failed: ${response.status}`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("Invalid advertisement response");
    const candidates = (payload as Record<string, unknown>).candidates;
    if (!candidates || typeof candidates !== "object") throw new Error("Invalid advertisement candidates");
    const record = candidates as Record<string, unknown>;
    const banners = Array.isArray(record.banners) ? record.banners.filter(validAdvertisement) : [];
    const verticals = Array.isArray(record.verticals) ? record.verticals.filter(validAdvertisement) : [];
    const modals = Array.isArray(record.modals) ? record.modals.filter(validAdvertisement) : [];
    return { banners, verticals, modals };
  }).catch((error) => {
    console.error(error);
    return { banners: [], verticals: [], modals: [] };
  });

  candidatePromises.set(key, promise);
  return promise;
}

function waitForImage(source: string, width: number, height: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => reject(new Error("Advertisement image timed out")), 8000);
    image.alt = "";
    image.width = width;
    image.height = height;
    image.decoding = "async";
    image.draggable = false;
    image.addEventListener("load", () => {
      window.clearTimeout(timeout);
      resolve(image);
    }, { once: true });
    image.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Advertisement image failed"));
    }, { once: true });
    image.src = source;
  });
}

function embedDocument(code: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{display:grid;place-items:center;min-height:100vh}img,video,iframe{display:block;max-width:100%;height:auto}</style></head><body>${code}</body></html>`;
}

function waitForEmbed(advertisement: AffiliateAdvertisement): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    const timeout = window.setTimeout(() => {
      frame.remove();
      reject(new Error("Advertisement code timed out"));
    }, 8000);
    frame.title = advertisement.name || "Sponsored content";
    frame.width = String(advertisement.width);
    frame.height = String(advertisement.height);
    frame.loading = "eager";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.sandbox.add("allow-scripts", "allow-forms", "allow-popups", "allow-popups-to-escape-sandbox");
    frame.className = "affiliate-ad-embed";
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.visibility = "hidden";
    frame.addEventListener("load", () => {
      window.clearTimeout(timeout);
      frame.style.position = "";
      frame.style.left = "";
      frame.style.top = "";
      frame.style.visibility = "";
      resolve(frame);
    }, { once: true });
    frame.srcdoc = embedDocument(advertisement.embedCode);
    document.body.appendChild(frame);
  });
}

async function loadCreative(advertisement: AffiliateAdvertisement): Promise<LoadedCreative | null> {
  try {
    if (advertisement.creativeType === "embed_code") {
      return { advertisement, element: await waitForEmbed(advertisement) };
    }

    const source = advertisement.creativeType === "external_media"
      ? advertisement.mediaUrl
      : advertisement.imageUrl ?? "";
    if (!source || !advertisement.targetUrl) return null;
    const image = await waitForImage(source, advertisement.width, advertisement.height);
    image.className = "affiliate-ad-image";

    const link = document.createElement("a");
    link.className = "affiliate-ad-link";
    link.href = advertisement.targetUrl;
    link.rel = "sponsored noopener noreferrer";
    if (advertisement.openMode === "new") link.target = "_blank";
    link.appendChild(image);
    return { advertisement, element: link };
  } catch (error) {
    console.error(error);
    return null;
  }
}

function createShell(loaded: LoadedCreative, placement: "top" | "inline" | "vertical" | "modal"): HTMLElement {
  const shell = document.createElement(placement === "modal" ? "div" : "section");
  shell.className = `affiliate-ad affiliate-ad-${placement}`;
  shell.dataset.affiliateAd = loaded.advertisement.id;
  shell.dataset.affiliateAdType = loaded.advertisement.displayType;
  shell.setAttribute("aria-label", "Sponsored advertisement");

  const label = document.createElement("span");
  label.className = "affiliate-ad-label";
  label.textContent = "Ad";

  const frame = document.createElement("div");
  frame.className = "affiliate-ad-frame";
  frame.style.setProperty("--affiliate-ad-width", `${loaded.advertisement.width}px`);
  frame.style.setProperty("--affiliate-ad-height", `${loaded.advertisement.height}px`);
  frame.appendChild(loaded.element);

  shell.appendChild(label);
  shell.appendChild(frame);
  return shell;
}

async function loadFirstAvailable(
  candidates: AffiliateAdvertisement[],
  used: Set<string>,
  allowReuse = false,
): Promise<LoadedCreative | null> {
  const unused = candidates.filter((candidate) => !used.has(candidate.id));
  const queue = unused.length > 0 ? unused : allowReuse ? candidates : [];
  for (const candidate of queue) {
    const loaded = await loadCreative(candidate);
    if (!loaded) continue;
    used.add(candidate.id);
    return loaded;
  }
  return null;
}

function productInterval(): number {
  if (window.matchMedia("(min-width: 1400px)").matches) return 15;
  if (window.matchMedia("(min-width: 1100px)").matches) return 12;
  if (window.matchMedia("(min-width: 768px)").matches) return 9;
  return 6;
}

async function mountTopBanner(candidates: AffiliateAdvertisement[], used: Set<string>): Promise<void> {
  const main = document.querySelector<HTMLElement>(".public-main");
  if (!main || main.querySelector(".affiliate-ad-top")) return;
  const loaded = await loadFirstAvailable(candidates, used, true);
  if (!loaded) return;
  main.insertBefore(createShell(loaded, "top"), main.firstChild);
}

async function mountInlineBanners(candidates: AffiliateAdvertisement[], used: Set<string>): Promise<void> {
  const grids = Array.from(document.querySelectorAll<HTMLElement>(".product-grid"));
  for (const grid of grids) {
    const products = Array.from(grid.querySelectorAll<HTMLElement>(":scope > [data-product-card]"));
    if (products.length === 0) continue;
    const interval = productInterval();
    const boundaries: number[] = [];
    for (let index = interval; index <= products.length; index += interval) boundaries.push(index);
    const directory = grid.closest<HTMLElement>("[data-product-directory]");
    const hasMore = Boolean(directory?.querySelector("[data-load-more]"));
    if (boundaries.length === 0 && !hasMore) boundaries.push(products.length);

    for (const boundary of boundaries) {
      const anchor = products[boundary - 1];
      if (!anchor || anchor.dataset.affiliateAdBoundary === "1") continue;
      anchor.dataset.affiliateAdBoundary = "1";
      const loaded = await loadFirstAvailable(candidates, used, true);
      if (!loaded) continue;
      anchor.insertAdjacentElement("afterend", createShell(loaded, "inline"));
    }
  }
}

function mountInlineVertical(shell: HTMLElement): void {
  const grid = document.querySelector<HTMLElement>(".product-grid");
  if (grid) {
    shell.classList.add("affiliate-ad-inline");
    const products = Array.from(grid.querySelectorAll<HTMLElement>(":scope > [data-product-card]"));
    const anchor = products[Math.min(productInterval(), products.length) - 1];
    if (anchor) anchor.insertAdjacentElement("afterend", shell);
    else grid.appendChild(shell);
    return;
  }
  document.querySelector<HTMLElement>(".public-main")?.appendChild(shell);
}

function tryMountDesktopRail(shell: HTMLElement, advertisement: AffiliateAdvertisement): boolean {
  const main = document.querySelector<HTMLElement>(".public-main");
  if (!main) return false;
  const initialRect = main.getBoundingClientRect();
  const railWidth = Math.min(advertisement.width, 320);
  if (window.innerWidth - initialRect.right < railWidth + 24) return false;

  shell.classList.add("affiliate-ad-rail");
  document.body.appendChild(shell);

  let animationFrame = 0;
  const update = (): void => {
    animationFrame = 0;
    const currentRect = main.getBoundingClientRect();
    const headerBottom = document.querySelector<HTMLElement>(".public-header")?.getBoundingClientRect().bottom ?? 76;
    const footerTop = document.querySelector<HTMLElement>(".public-footer")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
    const shellBottom = shell.getBoundingClientRect().bottom;
    const space = window.innerWidth - currentRect.right;

    shell.hidden = space < railWidth + 24;
    shell.style.left = `${Math.round(currentRect.right + 16)}px`;
    shell.style.top = `${Math.max(76, Math.round(headerBottom) + 12)}px`;
    shell.classList.toggle("is-footer-overlap", footerTop < shellBottom + 12);
  };
  const scheduleUpdate = (): void => {
    if (animationFrame) return;
    animationFrame = window.requestAnimationFrame(update);
  };

  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  update();
  return true;
}

async function mountVertical(candidates: AffiliateAdvertisement[], used: Set<string>, device: "mobile" | "desktop"): Promise<void> {
  const loaded = await loadFirstAvailable(candidates, used, true);
  if (!loaded) return;
  const shell = createShell(loaded, "vertical");
  if (device === "desktop" && tryMountDesktopRail(shell, loaded.advertisement)) return;
  mountInlineVertical(shell);
}

function interactionPromise(): Promise<void> {
  if (userInteracted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = (): void => {
      userInteracted = true;
      userEvents.forEach((eventName) => window.removeEventListener(eventName, finish));
      resolve();
    };
    userEvents.forEach((eventName) => window.addEventListener(eventName, finish, { once: true, passive: true }));
  });
}

async function mountModal(
  candidates: AffiliateAdvertisement[],
  used: Set<string>,
  channelSlug: string,
  device: "mobile" | "desktop",
): Promise<void> {
  if (candidates.length === 0) return;
  const storageKey = `affiliate-ad-modal-dismissed:${channelSlug}:${device}`;
  try {
    if (sessionStorage.getItem(storageKey) === "1") return;
  } catch {
    // Storage can be unavailable in restricted browsers; keep the per-page guard below.
  }

  await Promise.all([
    interactionPromise(),
    new Promise((resolve) => window.setTimeout(resolve, 8000)),
  ]);
  if (document.hidden || document.querySelector("[data-affiliate-ad-modal]")) return;

  // Do not create an iframe, execute affiliate JavaScript, or request modal media
  // until every display condition has been satisfied.
  const loaded = await loadFirstAvailable(candidates, used, true);
  if (!loaded || document.hidden || document.querySelector("[data-affiliate-ad-modal]")) return;

  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const backdrop = document.createElement("div");
  backdrop.className = "affiliate-ad-modal-backdrop";
  backdrop.dataset.affiliateAdModal = "";
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", "Sponsored advertisement");

  const card = createShell(loaded, "modal");
  const close = document.createElement("button");
  close.className = "affiliate-ad-modal-close";
  close.type = "button";
  close.setAttribute("aria-label", "Close advertisement");
  close.textContent = "×";
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && backdrop.isConnected) dismiss();
  };
  const dismiss = (): void => {
    document.removeEventListener("keydown", onKeydown);
    backdrop.remove();
    try { sessionStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    previouslyFocused?.focus();
  };
  close.addEventListener("click", dismiss);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) dismiss(); });
  document.addEventListener("keydown", onKeydown);

  card.insertBefore(close, card.firstChild);
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);
  close.focus();
}

async function initializeContext(node: HTMLScriptElement): Promise<void> {
  if (initializedContexts.has(node)) return;
  initializedContexts.add(node);
  const context = parseContext(node);
  if (!context) return;

  await waitForAdvertisementStart();
  const device = currentDevice();
  const candidates = await loadCandidates(context.channelSlug, device);
  const used = new Set<string>();
  const showsChannelTop = context.surface === "channel" || context.surface === "channel-catalog";
  const showsCatalogInline = context.surface === "catalog" || context.surface === "channel-catalog" || context.surface === "search";

  if (showsChannelTop) await mountTopBanner(candidates.banners, used);
  if (showsCatalogInline) await mountInlineBanners(candidates.banners, used);
  await mountVertical(candidates.verticals, used, device);

  document.addEventListener("public:products-appended", () => {
    void mountInlineBanners(candidates.banners, used);
  });
  void mountModal(candidates.modals, used, context.channelSlug, device);
}

function initializeAffiliateAds(root: ParentNode = document): void {
  root.querySelectorAll<HTMLScriptElement>("script[data-affiliate-ad-context]").forEach((node) => {
    void initializeContext(node);
  });
}

initializeAffiliateAds();
