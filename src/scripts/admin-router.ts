type ScriptSnapshot = {
  attributes: Array<[string, string]>;
  text: string;
};

type PageSnapshot = {
  url: string;
  title: string;
  mainHtml: string;
  outsideScripts: ScriptSnapshot[];
  createdAt: number;
};

type NavigationOptions = {
  push: boolean;
  force?: boolean;
};

const CACHE_TTL_MS = 45_000;
const MAX_CACHE_ENTRIES = 8;
const pageCache = new Map<string, PageSnapshot>();
const parser = new DOMParser();
const progress = document.querySelector<HTMLElement>("[data-admin-route-progress]");
let activeController: AbortController | null = null;

function canonicalUrl(value: string | URL): string {
  const url = new URL(value, window.location.href);
  url.hash = "";
  return url.href;
}

function snapshotScript(script: HTMLScriptElement): ScriptSnapshot {
  return {
    attributes: Array.from(script.attributes, (attribute) => [attribute.name, attribute.value]),
    text: script.textContent ?? "",
  };
}

function outsideScripts(documentValue: Document, main: Element): ScriptSnapshot[] {
  return Array.from(documentValue.querySelectorAll<HTMLScriptElement>("script"))
    .filter((script) => !script.src && !main.contains(script) && !script.hasAttribute("data-admin-router"))
    .map(snapshotScript);
}

function cleanRuntimeState(main: HTMLElement): HTMLElement {
  const clone = main.cloneNode(true) as HTMLElement;
  clone.removeAttribute("aria-busy");
  clone.querySelectorAll<HTMLElement>("[data-direct-image-upload]").forEach((element) => {
    delete element.dataset.directUploadReady;
    delete element.dataset.uploading;
  });
  clone.querySelectorAll<HTMLFormElement>("form[data-direct-upload-validation]").forEach((form) => {
    delete form.dataset.directUploadValidation;
  });
  clone.querySelectorAll<HTMLElement>("[data-image-picker-ready]").forEach((element) => {
    delete element.dataset.imagePickerReady;
  });
  return clone;
}

function createSnapshot(documentValue: Document, url: string): PageSnapshot | null {
  const main = documentValue.querySelector<HTMLElement>(".admin-content");
  if (!main) return null;

  return {
    url: canonicalUrl(url),
    title: documentValue.title,
    mainHtml: cleanRuntimeState(main).outerHTML,
    outsideScripts: outsideScripts(documentValue, main),
    createdAt: Date.now(),
  };
}

function storeSnapshot(snapshot: PageSnapshot): void {
  pageCache.delete(snapshot.url);
  pageCache.set(snapshot.url, snapshot);
  while (pageCache.size > MAX_CACHE_ENTRIES) {
    const oldest = pageCache.keys().next().value as string | undefined;
    if (!oldest) break;
    pageCache.delete(oldest);
  }
}

function readSnapshot(url: string): PageSnapshot | null {
  const snapshot = pageCache.get(url);
  if (!snapshot) return null;
  if (Date.now() - snapshot.createdAt > CACHE_TTL_MS) {
    pageCache.delete(url);
    return null;
  }
  return snapshot;
}

function executeScript(snapshot: ScriptSnapshot): void {
  const script = document.createElement("script");
  for (const [name, value] of snapshot.attributes) {
    if (name === "src" || name === "data-admin-router") continue;
    script.setAttribute(name, value);
  }
  script.textContent = snapshot.text;
  document.body.appendChild(script);
  script.remove();
}

function activateMainScripts(main: HTMLElement): void {
  main.querySelectorAll<HTMLScriptElement>("script").forEach((oldScript) => {
    const newScript = document.createElement("script");
    for (const attribute of Array.from(oldScript.attributes)) {
      newScript.setAttribute(attribute.name, attribute.value);
    }
    newScript.textContent = oldScript.textContent;
    oldScript.replaceWith(newScript);
  });
}

function styleKey(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return String(hash);
}

function synchronizeStyles(documentValue: Document, responseUrl: string): void {
  documentValue.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((source) => {
    const hrefValue = source.getAttribute("href");
    if (!hrefValue) return;
    const href = new URL(hrefValue, responseUrl).href;
    const exists = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'))
      .some((link) => link.href === href);
    if (exists) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  });

  documentValue.querySelectorAll<HTMLStyleElement>("head style").forEach((source) => {
    const text = source.textContent ?? "";
    if (!text) return;
    const key = styleKey(text);
    if (document.head.querySelector(`[data-admin-dynamic-style="${CSS.escape(key)}"]`)) return;
    const style = document.createElement("style");
    style.dataset.adminDynamicStyle = key;
    style.textContent = text;
    document.head.appendChild(style);
  });
}

function updateSidebar(urlValue: string): void {
  const path = new URL(urlValue).pathname;
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.admin-sidebar a[href^="/admin"]'));
  let best: HTMLAnchorElement | null = null;
  let bestLength = -1;

  for (const link of links) {
    link.removeAttribute("aria-current");
    const linkPath = new URL(link.href).pathname.replace(/\/$/u, "") || "/";
    const exact = path === linkPath || path === `${linkPath}/`;
    const productListMatch = linkPath.endsWith("/products")
      && path.startsWith(`${linkPath}/`)
      && path !== `${linkPath}/new`;
    const nested = linkPath !== "/admin" && path.startsWith(`${linkPath}/`);
    if ((exact || productListMatch || nested) && linkPath.length > bestLength) {
      best = link;
      bestLength = linkPath.length;
    }
  }

  best?.setAttribute("aria-current", "page");
  document.querySelectorAll<HTMLDetailsElement>(".admin-channel-group").forEach((group) => {
    group.open = Boolean(group.querySelector('[aria-current="page"]'));
  });
}

function setLoading(loading: boolean): void {
  if (progress) progress.hidden = !loading;
  document.querySelector<HTMLElement>(".admin-content")?.setAttribute("aria-busy", loading ? "true" : "false");
}

function applySnapshot(snapshot: PageSnapshot, scrollToTop: boolean): void {
  const template = document.createElement("template");
  template.innerHTML = snapshot.mainHtml.trim();
  const nextMain = template.content.firstElementChild;
  const currentMain = document.querySelector<HTMLElement>(".admin-content");
  if (!(nextMain instanceof HTMLElement) || !currentMain) {
    window.location.assign(snapshot.url);
    return;
  }

  currentMain.replaceWith(nextMain);
  document.title = snapshot.title;
  updateSidebar(snapshot.url);
  activateMainScripts(nextMain);
  snapshot.outsideScripts.forEach(executeScript);
  if (scrollToTop) window.scrollTo({ top: 0, behavior: "auto" });
  document.dispatchEvent(new CustomEvent("admin:navigation", { detail: { url: snapshot.url } }));
}

async function fetchSnapshot(url: string, init?: RequestInit): Promise<PageSnapshot> {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

  const headers = new Headers(init?.headers);
  headers.set("Accept", "text/html");
  headers.set("X-Admin-Partial", "1");

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "same-origin",
    signal: controller.signal,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  const nextDocument = parser.parseFromString(html, "text/html");
  const nextMain = nextDocument.querySelector<HTMLElement>(".admin-content");
  if (!nextMain) {
    window.location.assign(response.url || url);
    throw new Error("Missing admin content");
  }

  synchronizeStyles(nextDocument, response.url || url);
  const snapshot = createSnapshot(nextDocument, response.url || url);
  if (!snapshot) throw new Error("Invalid admin response");
  return snapshot;
}

async function navigate(urlValue: string | URL, options: NavigationOptions): Promise<void> {
  const requestedUrl = canonicalUrl(urlValue);
  const cached = options.force ? null : readSnapshot(requestedUrl);
  setLoading(true);

  try {
    const snapshot = cached ?? await fetchSnapshot(requestedUrl);
    storeSnapshot(snapshot);
    applySnapshot(snapshot, true);
    if (options.push) history.pushState({ admin: true }, "", snapshot.url);
    else if (canonicalUrl(window.location.href) !== snapshot.url) history.replaceState({ admin: true }, "", snapshot.url);
  } finally {
    setLoading(false);
  }
}

function appendSubmitter(data: FormData, submitter: HTMLElement | null): void {
  if (!(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement)) return;
  if (!submitter.name) return;
  data.append(submitter.name, submitter.value);
}

async function submitForm(form: HTMLFormElement, submitter: HTMLElement | null): Promise<void> {
  const method = (form.method || "get").toUpperCase();
  const action = new URL(form.action || window.location.href, window.location.href);
  const data = new FormData(form);
  appendSubmitter(data, submitter);

  if (method === "GET") {
    action.search = "";
    for (const [name, value] of data.entries()) {
      if (typeof value === "string" && value) action.searchParams.append(name, value);
    }
    await navigate(action, { push: true, force: true });
    return;
  }

  if (method !== "POST") return;
  setLoading(true);
  try {
    pageCache.clear();
    const snapshot = await fetchSnapshot(action.href, { method: "POST", body: data });
    storeSnapshot(snapshot);
    applySnapshot(snapshot, true);
    history.pushState({ admin: true }, "", snapshot.url);
  } finally {
    setLoading(false);
  }
}

const initialSnapshot = createSnapshot(document, window.location.href);
if (initialSnapshot) storeSnapshot(initialSnapshot);
history.replaceState({ admin: true }, "", window.location.href);
updateSidebar(window.location.href);

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (!link || !link.closest(".admin-frame") || link.target || link.hasAttribute("download")) return;

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) return;
  if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;

  event.preventDefault();
  void navigate(url, { push: true }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error(error);
    window.location.assign(url.href);
  });
});

document.addEventListener("submit", (event) => {
  if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
  const form = event.target;
  if (!form.closest(".admin-content") || form.target) return;
  const method = (form.method || "get").toUpperCase();
  if (method !== "GET" && method !== "POST") return;

  event.preventDefault();
  const submitter = event instanceof SubmitEvent && event.submitter instanceof HTMLElement
    ? event.submitter
    : null;
  void submitForm(form, submitter).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error(error);
    window.alert("操作失败，请重试。");
  });
});

window.addEventListener("popstate", () => {
  void navigate(window.location.href, { push: false }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error(error);
    window.location.reload();
  });
});
