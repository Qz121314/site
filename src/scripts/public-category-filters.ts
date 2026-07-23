const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-category-section]"));

function initializeCategorySection(section: HTMLElement): void {
  const mobileDirectory = section.querySelector<HTMLElement>("[data-category-mobile]");
  const buttons = Array.from(mobileDirectory?.querySelectorAll<HTMLButtonElement>("[data-category-filter]") ?? []);
  const cards = Array.from(mobileDirectory?.querySelectorAll<HTMLElement>("[data-category-card]") ?? []);
  const empty = mobileDirectory?.querySelector<HTMLElement>("[data-category-empty]") ?? null;

  const applyFilter = (filterId: string): void => {
    let visible = 0;
    buttons.forEach((item) => {
      item.setAttribute("aria-pressed", item.dataset.categoryFilter === filterId ? "true" : "false");
    });

    cards.forEach((card) => {
      const filterIds = (card.dataset.filterIds || "").split(",").filter(Boolean);
      const show = !filterId || filterIds.includes(filterId);
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (empty) empty.hidden = visible > 0;
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filterId = button.dataset.categoryFilter || "";
      applyFilter(button.getAttribute("aria-pressed") === "true" ? "" : filterId);
    });
  });

  const groupButtons = Array.from(section.querySelectorAll<HTMLButtonElement>("[data-category-group-filter]"));
  const groupRows = Array.from(section.querySelectorAll<HTMLElement>("[data-category-group-row]"));

  const applyGroupFilter = (filterId: string): void => {
    groupButtons.forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.categoryGroupFilter === filterId ? "true" : "false");
    });

    groupRows.forEach((row) => {
      row.hidden = Boolean(filterId && row.dataset.categoryGroupRow !== filterId);
    });
  };

  groupButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filterId = button.dataset.categoryGroupFilter || "";
      applyGroupFilter(button.getAttribute("aria-pressed") === "true" ? "" : filterId);
    });
  });
}

sections.forEach(initializeCategorySection);
