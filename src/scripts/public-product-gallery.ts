function initializeProductGallery(gallery: HTMLElement): void {
  if (gallery.dataset.ready === "1") return;
  gallery.dataset.ready = "1";

  const mainImage = gallery.querySelector<HTMLImageElement>("[data-gallery-main]");
  const thumbnails = Array.from(gallery.querySelectorAll<HTMLButtonElement>("[data-gallery-thumbnail]"));
  if (!mainImage || thumbnails.length === 0) return;

  let selectionVersion = 0;
  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", () => {
      if (thumbnail.getAttribute("aria-current") === "true") return;
      const nextUrl = thumbnail.dataset.imageUrl;
      const nextSrcset = thumbnail.dataset.imageSrcset || "";
      if (!nextUrl || mainImage.src === new URL(nextUrl, location.href).href) return;

      const version = ++selectionVersion;
      thumbnails.forEach((item) => {
        item.setAttribute("aria-current", item === thumbnail ? "true" : "false");
      });
      mainImage.classList.add("is-changing");

      const preload = new Image();
      if (nextSrcset) preload.srcset = nextSrcset;
      preload.sizes = mainImage.sizes || "100vw";
      preload.onload = () => {
        if (version !== selectionVersion) return;
        if (nextSrcset) mainImage.srcset = nextSrcset;
        else mainImage.removeAttribute("srcset");
        mainImage.src = nextUrl;
        mainImage.alt = thumbnail.dataset.imageAlt || "";
        requestAnimationFrame(() => mainImage.classList.remove("is-changing"));
      };
      preload.onerror = () => {
        if (version === selectionVersion) mainImage.classList.remove("is-changing");
      };
      preload.src = nextUrl;
    });
  });
}

document.querySelectorAll<HTMLElement>("[data-product-gallery]").forEach(initializeProductGallery);
