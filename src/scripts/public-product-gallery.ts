function initializeProductGallery(gallery: HTMLElement): void {
  if (gallery.dataset.ready === "1") return;
  gallery.dataset.ready = "1";

  const mainImage = gallery.querySelector<HTMLImageElement>("[data-gallery-main]");
  const thumbnails = Array.from(gallery.querySelectorAll<HTMLButtonElement>("[data-gallery-thumbnail]"));
  if (!mainImage || thumbnails.length === 0) return;

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", () => {
      const nextUrl = thumbnail.dataset.imageUrl;
      if (!nextUrl || mainImage.src === new URL(nextUrl, location.href).href) return;

      thumbnails.forEach((item) => {
        item.setAttribute("aria-current", item === thumbnail ? "true" : "false");
      });
      mainImage.classList.add("is-changing");

      const preload = new Image();
      preload.onload = () => {
        mainImage.src = nextUrl;
        mainImage.alt = thumbnail.dataset.imageAlt || "";
        requestAnimationFrame(() => mainImage.classList.remove("is-changing"));
      };
      preload.onerror = () => mainImage.classList.remove("is-changing");
      preload.src = nextUrl;
    });
  });
}

document.querySelectorAll<HTMLElement>("[data-product-gallery]").forEach(initializeProductGallery);
