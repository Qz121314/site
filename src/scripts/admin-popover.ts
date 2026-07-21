type PopoverPanel = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

const initializedPopovers = new WeakSet<HTMLElement>();
const activePopovers = new Set<HTMLElement>();
const VIEWPORT_GAP = 8;
const TRIGGER_GAP = 6;

function supportsPopover(panel: PopoverPanel): boolean {
  return typeof panel.showPopover === "function" && typeof panel.hidePopover === "function";
}

function panelIsOpen(panel: HTMLElement): boolean {
  try {
    return panel.matches(":popover-open") || panel.dataset.adminPopoverFallbackOpen === "1";
  } catch {
    return panel.dataset.adminPopoverFallbackOpen === "1";
  }
}

function positionPopover(trigger: HTMLElement, panel: HTMLElement): void {
  if (!panelIsOpen(panel)) return;

  const triggerRect = trigger.getBoundingClientRect();
  panel.style.setProperty("--admin-popover-width", `${Math.round(triggerRect.width)}px`);

  const panelRect = panel.getBoundingClientRect();
  const maxLeft = Math.max(VIEWPORT_GAP, window.innerWidth - panelRect.width - VIEWPORT_GAP);
  const left = Math.min(Math.max(triggerRect.left, VIEWPORT_GAP), maxLeft);

  const belowTop = triggerRect.bottom + TRIGGER_GAP;
  const aboveTop = triggerRect.top - TRIGGER_GAP - panelRect.height;
  const fitsBelow = belowTop + panelRect.height <= window.innerHeight - VIEWPORT_GAP;
  const top = fitsBelow
    ? belowTop
    : Math.max(VIEWPORT_GAP, aboveTop);

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function setExpanded(trigger: HTMLElement, panel: HTMLElement, expanded: boolean): void {
  trigger.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (expanded) {
    activePopovers.add(panel);
    requestAnimationFrame(() => positionPopover(trigger, panel));
  } else {
    activePopovers.delete(panel);
    panel.style.removeProperty("left");
    panel.style.removeProperty("top");
    panel.style.removeProperty("--admin-popover-width");
  }
}

function openPopover(trigger: HTMLElement, panel: PopoverPanel): void {
  if (supportsPopover(panel)) {
    panel.showPopover?.();
    setExpanded(trigger, panel, true);
    return;
  }

  panel.dataset.adminPopoverFallbackOpen = "1";
  setExpanded(trigger, panel, true);
}

function closePopover(trigger: HTMLElement, panel: PopoverPanel): void {
  if (supportsPopover(panel)) {
    if (panelIsOpen(panel)) panel.hidePopover?.();
  } else {
    delete panel.dataset.adminPopoverFallbackOpen;
  }
  setExpanded(trigger, panel, false);
}

function initializePopover(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-admin-popover]").forEach((container) => {
    if (initializedPopovers.has(container)) return;

    const trigger = container.querySelector<HTMLElement>("[data-admin-popover-trigger]");
    const panel = container.querySelector<PopoverPanel>("[data-admin-popover-panel]");
    if (!trigger || !panel) return;

    trigger.addEventListener("click", () => {
      if (panelIsOpen(panel)) closePopover(trigger, panel);
      else openPopover(trigger, panel);
    });

    panel.addEventListener("toggle", () => {
      setExpanded(trigger, panel, panelIsOpen(panel));
    });

    initializedPopovers.add(container);
  });
}

function pruneDetachedPopovers(): void {
  for (const panel of activePopovers) {
    if (!panel.isConnected) activePopovers.delete(panel);
  }
}

function closeFallbackPopoversOutside(target: EventTarget | null): void {
  if (!(target instanceof Node)) return;
  document.querySelectorAll<HTMLElement>("[data-admin-popover]").forEach((container) => {
    const panel = container.querySelector<PopoverPanel>("[data-admin-popover-panel]");
    const trigger = container.querySelector<HTMLElement>("[data-admin-popover-trigger]");
    if (!panel || !trigger || supportsPopover(panel)) return;
    if (container.contains(target)) return;
    closePopover(trigger, panel);
  });
}

initializePopover();
document.addEventListener("admin:navigation", () => {
  pruneDetachedPopovers();
  initializePopover();
});
document.addEventListener("pointerdown", (event) => closeFallbackPopoversOutside(event.target));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll<HTMLElement>("[data-admin-popover]").forEach((container) => {
    const panel = container.querySelector<PopoverPanel>("[data-admin-popover-panel]");
    const trigger = container.querySelector<HTMLElement>("[data-admin-popover-trigger]");
    if (panel && trigger && !supportsPopover(panel) && panelIsOpen(panel)) closePopover(trigger, panel);
  });
});
window.addEventListener("resize", () => {
  pruneDetachedPopovers();
  for (const panel of activePopovers) {
    const container = panel.closest<HTMLElement>("[data-admin-popover]");
    const trigger = container?.querySelector<HTMLElement>("[data-admin-popover-trigger]");
    if (trigger) positionPopover(trigger, panel);
  }
});
window.addEventListener("scroll", () => {
  pruneDetachedPopovers();
  for (const panel of activePopovers) {
    const container = panel.closest<HTMLElement>("[data-admin-popover]");
    const trigger = container?.querySelector<HTMLElement>("[data-admin-popover-trigger]");
    if (trigger) positionPopover(trigger, panel);
  }
}, true);
