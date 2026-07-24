export {};

const desktopMedia = window.matchMedia("(min-width: 1100px)");
const workspace = document.querySelector<HTMLElement>("[data-desktop-density-workspace]");

if (workspace) {
  const panels = Array.from(workspace.querySelectorAll<HTMLElement>("[data-desktop-filter-panel]"));
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-desktop-filter-link]"));

  const setActive = (slug: string, updateHistory = false): void => {
    const target = panels.find((panel) => panel.dataset.desktopFilterPanel === slug) ?? panels[0];
    if (!target) return;
    const activeSlug = target.dataset.desktopFilterPanel || "";

    panels.forEach((panel) => {
      const active = panel === target;
      panel.hidden = !active;
      panel.setAttribute("aria-hidden", active ? "false" : "true");
    });

    links.forEach((link) => {
      const active = link.dataset.desktopFilterLink === activeSlug;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });

    if (updateHistory) {
      history.replaceState(
        history.state,
        "",
        `${window.location.pathname}${window.location.search}#filter-${encodeURIComponent(activeSlug)}`,
      );
    }
  };

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!desktopMedia.matches) return;
      const targetUrl = new URL(link.href, window.location.href);
      if (targetUrl.pathname !== window.location.pathname || targetUrl.search !== window.location.search) return;
      const slug = link.dataset.desktopFilterLink || "";
      if (!panels.some((panel) => panel.dataset.desktopFilterPanel === slug)) return;
      event.preventDefault();
      setActive(slug, true);
    });
  });

  const hashSlug = decodeURIComponent(window.location.hash.replace(/^#filter-/, ""));
  setActive(hashSlug || panels[0]?.dataset.desktopFilterPanel || "");
}
