type DirectoryProduct = {
  title: string;
  slug: string;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
};

function isDirectoryProduct(value: unknown): value is DirectoryProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as Record<string, unknown>;
  return typeof product.title === "string"
    && typeof product.slug === "string"
    && (product.coverUrl === null || typeof product.coverUrl === "string")
    && (product.coverWidth === null || typeof product.coverWidth === "number")
    && (product.coverHeight === null || typeof product.coverHeight === "number");
}

function createProductCard(product: DirectoryProduct, channelSlug: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "visual-card product-card";
  link.href = `/${encodeURIComponent(channelSlug)}/product/${encodeURIComponent(product.slug)}`;
  link.dataset.loadSurface = "";

  if (product.coverUrl) {
    link.setAttribute("aria-busy", "true");
    const image = document.createElement("img");
    image.className = "visual-card-media";
    image.alt = "";
    if (product.coverWidth && product.coverWidth > 0) image.width = product.coverWidth;
    if (product.coverHeight && product.coverHeight > 0) image.height = product.coverHeight;
    image.loading = "lazy";
    image.decoding = "async";
    image.draggable = false;
    image.dataset.loadReveal = "";
    const settle = (state: "is-loaded" | "is-load-error"): void => {
      image.classList.add(state);
      link.classList.add(state);
      link.removeAttribute("aria-busy");
    };
    image.addEventListener("load", () => settle("is-loaded"), { once: true });
    image.addEventListener("error", () => settle("is-load-error"), { once: true });
    image.src = product.coverUrl;
    link.appendChild(image);
  } else {
    link.classList.add("is-loaded");
    const placeholder = document.createElement("span");
    placeholder.className = "visual-card-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = product.title.trim().slice(0, 1).toUpperCase() || "P";
    link.appendChild(placeholder);
  }

  const overlay = document.createElement("span");
  overlay.className = "visual-card-overlay";
  const title = document.createElement("span");
  title.className = "visual-card-title";
  title.textContent = product.title;
  overlay.appendChild(title);
  link.appendChild(overlay);
  return link;
}

function pageHref(page: number, categorySlug: string, preserveCategoryQuery: boolean): string {
  const url = new URL(window.location.href);
  url.search = "";
  if (preserveCategoryQuery && categorySlug) url.searchParams.set("category", categorySlug);
  if (page > 1) url.searchParams.set("page", String(page));
  return `${url.pathname}${url.search}`;
}

function initializeProductDirectory(root: HTMLElement): void {
  if (root.dataset.ready === "1") return;
  root.dataset.ready = "1";
  const nextLink = root.querySelector<HTMLAnchorElement>("[data-load-more]");
  const label = root.querySelector<HTMLElement>("[data-load-more-label]");
  const row = root.querySelector<HTMLElement>("[data-load-more-row]");
  const grid = root.querySelector<HTMLElement>("[data-product-grid]");
  if (!nextLink || !label || !row || !grid) return;

  nextLink.addEventListener("click", async (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (nextLink.dataset.loading === "1") return;

    nextLink.dataset.loading = "1";
    nextLink.setAttribute("aria-busy", "true");
    nextLink.setAttribute("aria-disabled", "true");
    label.textContent = "Loading…";
    const page = Number(root.dataset.nextPage || "2");
    const params = new URLSearchParams({ page: String(page) });
    if (root.dataset.category) params.set("category", root.dataset.category);
    if (root.dataset.query) params.set("q", root.dataset.query);
    if (root.dataset.uncategorized === "1") params.set("uncategorized", "1");

    try {
      const response = await fetch(
        `/api/public/channels/${encodeURIComponent(root.dataset.channel || "")}/products?${params}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object") throw new Error("Invalid response");
      const record = payload as Record<string, unknown>;
      if (!Array.isArray(record.products) || !record.products.every(isDirectoryProduct)) {
        throw new Error("Invalid response");
      }
      record.products.forEach((product) => grid.appendChild(createProductCard(product, root.dataset.channel || "")));
      root.dataset.nextPage = String(page + 1);

      if (record.hasMore !== true) {
        nextLink.remove();
        const end = document.createElement("p");
        end.className = "end-of-results";
        end.textContent = "You’ve reached the end.";
        row.appendChild(end);
      } else {
        nextLink.href = pageHref(
          page + 1,
          root.dataset.category || "",
          root.dataset.preserveCategoryQuery === "1",
        );
        delete nextLink.dataset.loading;
        nextLink.removeAttribute("aria-busy");
        nextLink.removeAttribute("aria-disabled");
        label.textContent = "Load More";
      }
    } catch (error) {
      console.error(error);
      delete nextLink.dataset.loading;
      nextLink.removeAttribute("aria-busy");
      nextLink.removeAttribute("aria-disabled");
      label.textContent = "Try Again";
    }
  });
}

document.querySelectorAll<HTMLElement>("[data-product-directory]").forEach(initializeProductDirectory);
