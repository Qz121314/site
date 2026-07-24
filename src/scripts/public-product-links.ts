const desktopMedia = window.matchMedia("(min-width: 1100px)");

function normalizeProductCard(link: HTMLAnchorElement): void {
  const existingFrame = link.querySelector<HTMLElement>(":scope > .visual-card-media-frame");
  if (!existingFrame) {
    const media = link.querySelector<HTMLElement>(":scope > .visual-card-media, :scope > .visual-card-placeholder");
    if (media) {
      const frame = document.createElement("span");
      frame.className = "visual-card-media-frame";
      link.insertBefore(frame, media);
      frame.appendChild(media);
    }
  }

  if (desktopMedia.matches) {
    link.target = "_blank";
    link.rel = "noopener";
    link.dataset.desktopNewTab = "1";
  } else {
    link.removeAttribute("target");
    link.removeAttribute("rel");
    delete link.dataset.desktopNewTab;
  }
}

function syncProductCards(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>("[data-product-card]").forEach(normalizeProductCard);
}

syncProductCards();
desktopMedia.addEventListener("change", () => syncProductCards());
document.addEventListener("public:products-appended", (event) => {
  const detail = event instanceof CustomEvent ? event.detail as { grid?: ParentNode } | undefined : undefined;
  syncProductCards(detail?.grid ?? document);
});
