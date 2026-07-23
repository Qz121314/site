const ACTIVATION_WINDOW_MS = 650;
const SEARCH_REQUIRED_MESSAGE = "Please enter a search term.";

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!(event.target instanceof Element)) return;

  const control = event.target.closest<HTMLElement>('a[href], button[type="submit"]');
  if (!control) return;
  if (control.closest("[data-hero-track]") || control.matches('[target="_blank"], [download]')) return;

  const now = performance.now();
  const lastActivation = Number(control.dataset.lastActivation || "0");
  if (now - lastActivation < ACTIVATION_WINDOW_MS) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  control.dataset.lastActivation = String(now);
  window.setTimeout(() => delete control.dataset.lastActivation, ACTIVATION_WINDOW_MS);
}, true);

function bindSearchValidation(
  form: HTMLFormElement,
  searchInput: HTMLInputElement,
): () => void {
  const syncValidity = (): void => {
    searchInput.setCustomValidity(searchInput.value.trim() ? "" : SEARCH_REQUIRED_MESSAGE);
  };

  syncValidity();
  searchInput.addEventListener("invalid", syncValidity);
  searchInput.addEventListener("input", syncValidity);
  form.addEventListener("submit", (event) => {
    searchInput.value = searchInput.value.trim();
    syncValidity();
    if (searchInput.checkValidity()) return;

    event.preventDefault();
    searchInput.reportValidity();
    searchInput.focus({ preventScroll: true });
  });
  return syncValidity;
}

const searchValidity = new WeakMap<HTMLInputElement, () => void>();
document.querySelectorAll<HTMLFormElement>("[data-public-search-form]").forEach((form) => {
  const searchInput = form.querySelector<HTMLInputElement>("[data-public-search-input]");
  if (!searchInput) return;
  searchValidity.set(searchInput, bindSearchValidation(form, searchInput));
});

const header = document.querySelector<HTMLElement>("[data-public-header]");
const headerDefault = header?.querySelector<HTMLElement>("[data-header-default]");
const searchLayer = header?.querySelector<HTMLElement>("[data-header-search-layer]");
const searchOpen = header?.querySelector<HTMLButtonElement>("[data-header-search-open]");
const searchClose = header?.querySelector<HTMLButtonElement>("[data-header-search-close]");
const overlaySearchInput = header?.querySelector<HTMLInputElement>("[data-header-search-input]");
const publicMenu = header?.querySelector<HTMLDetailsElement>("[data-public-menu]");

if (header && headerDefault && searchLayer && searchOpen && searchClose && overlaySearchInput) {
  let isSearchOpen = false;
  const syncSearchValidity = searchValidity.get(overlaySearchInput) ?? (() => {});

  const setSearchOpen = (nextOpen: boolean): void => {
    if (isSearchOpen === nextOpen) return;
    isSearchOpen = nextOpen;

    header.dataset.searchOpen = String(nextOpen);
    searchOpen.setAttribute("aria-expanded", String(nextOpen));
    searchLayer.setAttribute("aria-hidden", String(!nextOpen));
    searchLayer.inert = !nextOpen;
    headerDefault.inert = nextOpen;

    if (nextOpen) {
      if (publicMenu) publicMenu.open = false;
      syncSearchValidity();
      window.requestAnimationFrame(() => {
        overlaySearchInput.focus({ preventScroll: true });
        try {
          const end = overlaySearchInput.value.length;
          overlaySearchInput.setSelectionRange(end, end);
        } catch {
          // Some browsers can reject selection changes on search inputs.
        }
      });
      return;
    }

    window.requestAnimationFrame(() => searchOpen.focus({ preventScroll: true }));
  };

  searchOpen.addEventListener("click", () => setSearchOpen(true));
  searchClose.addEventListener("click", () => setSearchOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if (isSearchOpen) {
      event.preventDefault();
      setSearchOpen(false);
      return;
    }

    if (publicMenu?.open) publicMenu.open = false;
  });

  const desktopMedia = window.matchMedia("(min-width: 768px)");
  desktopMedia.addEventListener("change", (event) => {
    if (event.matches && isSearchOpen) setSearchOpen(false);
  });
}

if (publicMenu) {
  document.addEventListener("pointerdown", (event) => {
    if (!publicMenu.open || !(event.target instanceof Node) || publicMenu.contains(event.target)) return;
    publicMenu.open = false;
  });
}

const gate = document.querySelector<HTMLElement>("[data-adult-gate]");
const accept = document.querySelector<HTMLButtonElement>("[data-adult-accept]");
const exit = document.querySelector<HTMLButtonElement>("[data-adult-exit]");

if (gate && accept && exit) {
  const background = Array.from(document.body.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement && element !== gate,
  );
  if (!document.documentElement.classList.contains("adult-confirmed")) {
    document.documentElement.style.overflow = "hidden";
    background.forEach((element) => { element.inert = true; });
    window.requestAnimationFrame(() => accept.focus());
  }

  accept.addEventListener("click", () => {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `site_adult_confirmed=1; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    document.documentElement.classList.add("adult-confirmed");
    gate.remove();
    background.forEach((element) => { element.inert = false; });
    document.documentElement.style.overflow = "";
  });

  exit.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.replace("about:blank");
  });
}
