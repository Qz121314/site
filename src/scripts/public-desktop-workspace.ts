const desktopMedia = window.matchMedia("(min-width: 1100px)");
const workspace = document.querySelector<HTMLElement>("[data-desktop-density-workspace]");

if (workspace) {
  const rows = Array.from(workspace.querySelectorAll<HTMLElement>("[data-desktop-filter-row]"));
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-desktop-filter-link]"));

  const setActive = (slug: string): void => {
    links.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.desktopFilterLink === slug);
    });
  };

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!desktopMedia.matches) return;
      const targetUrl = new URL(link.href, window.location.href);
      if (targetUrl.pathname !== window.location.pathname) return;
      const slug = link.dataset.desktopFilterLink || "";
      const row = rows.find((item) => item.dataset.desktopFilterRow === slug);
      if (!row) return;
      event.preventDefault();
      row.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}#filter-${encodeURIComponent(slug)}`);
      setActive(slug);
    });
  });

  if ("IntersectionObserver" in window && rows.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      const slug = visible?.target instanceof HTMLElement ? visible.target.dataset.desktopFilterRow || "" : "";
      if (slug) setActive(slug);
    }, {
      rootMargin: "-18% 0px -62% 0px",
      threshold: [0.05, 0.25, 0.5],
    });
    rows.forEach((row) => observer.observe(row));
  }

  const hashSlug = decodeURIComponent(window.location.hash.replace(/^#filter-/, ""));
  if (hashSlug) setActive(hashSlug);
  else if (rows[0]?.dataset.desktopFilterRow) setActive(rows[0].dataset.desktopFilterRow);
}
