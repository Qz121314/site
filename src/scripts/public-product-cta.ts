type ContactResponse = {
  ok: true;
  contact: {
    target: string;
    type: "link" | "sms";
    display?: string;
  };
};

function isContactResponse(value: unknown): value is ContactResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.ok !== true || !record.contact || typeof record.contact !== "object") return false;
  const contact = record.contact as Record<string, unknown>;
  return typeof contact.target === "string" && (contact.type === "link" || contact.type === "sms");
}

document.querySelectorAll<HTMLAnchorElement>("[data-contact-cta]").forEach((link) => {
  const resolveUrl = link.dataset.resolveUrl || link.href;
  const label = link.querySelector<HTMLElement>("[data-contact-label]");
  const defaultLabel = label?.textContent?.trim() || "View Details";

  link.addEventListener("click", async (event) => {
    event.preventDefault();
    if (link.dataset.loading === "1") return;

    link.dataset.loading = "1";
    link.setAttribute("aria-busy", "true");
    link.classList.remove("is-resolved");
    if (label) label.textContent = "Connecting…";

    try {
      const response = await fetch(resolveUrl, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      const result: unknown = await response.json();
      if (!response.ok || !isContactResponse(result)) throw new Error("unavailable");

      const target = result.contact.target;
      const type = result.contact.type;
      const rawDisplay = String(result.contact.display || target).trim();
      const display = type === "sms" ? rawDisplay.replace(/^sms:/iu, "") : rawDisplay;

      link.href = target;
      link.dataset.contactType = type;
      if (label) label.textContent = type === "sms" ? `SMS · ${display}` : `OPEN · ${display || defaultLabel}`;
      void link.offsetWidth;
      link.classList.add("is-resolved");
      window.location.assign(target);
    } catch (error) {
      console.error(error);
      link.classList.remove("is-resolved");
      if (label) {
        label.textContent = "Temporarily unavailable";
        window.setTimeout(() => {
          if (link.dataset.loading !== "1") label.textContent = defaultLabel;
        }, 1600);
      }
    } finally {
      delete link.dataset.loading;
      link.removeAttribute("aria-busy");
    }
  });
});
