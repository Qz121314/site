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

type AdminNavigationOptions = {
  push: boolean;
  force?: boolean;
};

const CACHE_TTL_MS = 45_000;
const MAX_CACHE_ENTRIES = 8;
const pageCache = new Map<string, PageSnapshot>();
const parser = new DOMParser();
const progress = document.querySelector<HTMLElement>("[data-admin-route-progress]");
let activeController: AbortController | null = null;
let currentUrl = canonicalUrl(window.location.href);

function canonicalUrl(value: string | URL): string {
  const url = new URL(value, window.location.href);
  url.hash = "";
  return url.href;
}

function snapshotScript(script: HTMLScriptElement, responseUrl: string): ScriptSnapshot {
  return {
    attributes: Array.from(script.attributes, (attribute): [string, string] => [
      attribute.name,
      attribute.name === "src" ? new URL(attribute.value, responseUrl).href : attribute.value,
    ]),
    text: script.textContent ?? "",
  };
}

function outsideScripts(documentValue: Document, main: Element, responseUrl: string): ScriptSnapshot[] {
  return Array.from(documentValue.querySelectorAll<HTMLScriptElement>("script"))
    .filter((script) => !main.contains(script) && !script.hasAttribute("data-admin-router"))
    .map((script) => snapshotScript(script, responseUrl));
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
  clone.querySelectorAll<HTMLElement>("[data-product-editor-ready]").forEach((element) => {
    delete element.dataset.productEditorReady;
  });
  clone.querySelectorAll<HTMLFormElement>("form[data-admin-dirty-form]").forEach((form) => {
    delete form.dataset.adminDirtyReady;
    form.dataset.adminDirty = "0";
  });
  return clone;
}

function createSnapshot(documentValue: Document, url: string): PageSnapshot | null {
  const main = documentValue.querySelector<HTMLElement>(".admin-content");
  if (!main) return null;

  const responseUrl = canonicalUrl(url);
  return {
    url: responseUrl,
    title: documentValue.title,
    mainHtml: cleanRuntimeState(main).outerHTML,
    outsideScripts: outsideScripts(documentValue, main, responseUrl),
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

function scriptSource(snapshot: ScriptSnapshot): string {
  return snapshot.attributes.find(([name]) => name === "src")?.[1] ?? "";
}

function hasLoadedScript(src: string): boolean {
  return Boolean(src) && Array.from(document.scripts).some((script) => script.src === src);
}

function executeScript(snapshot: ScriptSnapshot): void {
  const src = scriptSource(snapshot);
  if (src && hasLoadedScript(src)) return;

  const script = document.createElement("script");
  for (const [name, value] of snapshot.attributes) {
    if (name === "data-admin-router") continue;
    script.setAttribute(name, value);
  }
  script.textContent = snapshot.text;
  if (src) script.dataset.adminDynamicScript = "1";
  document.body.appendChild(script);
  if (!src) script.remove();
}

function activateMainScripts(main: HTMLElement, responseUrl: string): void {
  main.querySelectorAll<HTMLScriptElement>("script").forEach((oldScript) => {
    const snapshot = snapshotScript(oldScript, responseUrl);
    oldScript.remove();
    executeScript(snapshot);
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
  const desiredLinks = new Set<string>();
  documentValue.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((source) => {
    const hrefValue = source.getAttribute("href");
    if (hrefValue) desiredLinks.add(new URL(hrefValue, responseUrl).href);
  });

  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((link) => {
    if (!desiredLinks.has(link.href)) link.remove();
  });

  for (const href of desiredLinks) {
    const exists = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'))
      .some((link) => link.href === href);
    if (exists) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  const desiredInlineStyles = new Map<string, string>();
  documentValue.querySelectorAll<HTMLStyleElement>("head style").forEach((source) => {
    const text = source.textContent ?? "";
    if (text) desiredInlineStyles.set(styleKey(text), text);
  });

  document.querySelectorAll<HTMLStyleElement>("head style").forEach((style) => {
    const text = style.textContent ?? "";
    const key = styleKey(text);
    if (!desiredInlineStyles.has(key)) {
      style.remove();
      return;
    }
    style.dataset.adminDynamicStyle = key;
  });

  for (const [key, text] of desiredInlineStyles) {
    if (document.head.querySelector(`[data-admin-dynamic-style="${CSS.escape(key)}"]`)) continue;
    const style = document.createElement("style");
    style.dataset.adminDynamicStyle = key;
    style.textContent = text;
    document.head.appendChild(style);
  }
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
  const main = document.querySelector<HTMLElement>(".admin-content");
  if (!main) return;
  if (loading) main.setAttribute("aria-busy", "true");
  else main.removeAttribute("aria-busy");
}

function hasDirtyForm(): boolean {
  return Boolean(document.querySelector('form[data-admin-dirty-form][data-admin-dirty="1"]'));
}

function clearDirtyForms(): void {
  document.querySelectorAll<HTMLFormElement>("form[data-admin-dirty-form]").forEach((form) => {
    form.dataset.adminDirty = "0";
  });
}

function confirmDiscardChanges(): boolean {
  if (!hasDirtyForm()) return true;
  const confirmed = window.confirm("当前页面有未保存的修改，确定离开？");
  if (confirmed) clearDirtyForms();
  return confirmed;
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
  currentUrl = snapshot.url;
  updateSidebar(snapshot.url);
  activateMainScripts(nextMain, snapshot.url);
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

async function navigate(urlValue: string | URL, options: AdminNavigationOptions): Promise<void> {
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

function requiresShellRefresh(action: URL): boolean {
  return action.pathname === "/api/admin/channels/create"
    || /^\/api\/admin\/channels\/[^/]+\/(?:update|delete)$/u.test(action.pathname);
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
  const wasDirty = form.dataset.adminDirty === "1";
  form.dataset.adminDirty = "0";
  setLoading(true);
  try {
    pageCache.clear();
    const snapshot = await fetchSnapshot(action.href, { method: "POST", body: data });
    if (requiresShellRefresh(action)) {
      window.location.assign(snapshot.url);
      return;
    }
    storeSnapshot(snapshot);
    applySnapshot(snapshot, true);
    history.pushState({ admin: true }, "", snapshot.url);
  } catch (error) {
    if (wasDirty) form.dataset.adminDirty = "1";
    throw error;
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
  if (canonicalUrl(url) !== currentUrl && !confirmDiscardChanges()) return;

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

window.addEventListener("beforeunload", (event) => {
  if (!hasDirtyForm()) return;
  event.preventDefault();
  event.returnValue = "";
});

window.addEventListener("popstate", () => {
  const requestedUrl = canonicalUrl(window.location.href);
  if (!confirmDiscardChanges()) {
    history.pushState({ admin: true }, "", currentUrl);
    return;
  }
  void navigate(requestedUrl, { push: false }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error(error);
    window.location.reload();
  });
});
