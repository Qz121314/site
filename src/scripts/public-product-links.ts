export {};

const desktopMedia = window.matchMedia("(min-width: 1100px)");

function syncProductLink(link: HTMLAnchorElement): void {
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

function syncProductLinks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>("[data-product-card]").forEach(syncProductLink);
}

syncProductLinks();
desktopMedia.addEventListener("change", () => syncProductLinks());
document.addEventListener("public:products-appended", (event) => {
  const detail = event instanceof CustomEvent
    ? event.detail as { grid?: ParentNode } | undefined
    : undefined;
  syncProductLinks(detail?.grid ?? document);
});
