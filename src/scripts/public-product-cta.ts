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

async function copyContactValue(input: HTMLInputElement): Promise<boolean> {
  const value = input.value;
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the selection-based copy path.
    }
  }

  input.focus({ preventScroll: true });
  input.select();
  input.setSelectionRange(0, value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

document.querySelectorAll<HTMLAnchorElement>("[data-contact-cta]").forEach((link) => {
  const resolveUrl = link.dataset.resolveUrl || link.href;
  const box = link.closest<HTMLElement>("[data-contact-box]");
  const label = link.querySelector<HTMLElement>("[data-contact-label]");
  const fallback = box?.querySelector<HTMLElement>("[data-contact-fallback]");
  const fallbackMessage = box?.querySelector<HTMLElement>("[data-contact-fallback-message]");
  const copyValue = box?.querySelector<HTMLInputElement>("[data-contact-copy-value]");
  const copyButton = box?.querySelector<HTMLButtonElement>("[data-contact-copy]");
  const defaultLabel = label?.textContent?.trim() || "View Details";
  let fallbackTimer = 0;
  let copyResetTimer = 0;
  let pendingFallback = false;
  let defaultCopyLabel = "Copy";

  const hideFallback = () => {
    pendingFallback = false;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    fallbackTimer = 0;
    if (fallback) fallback.hidden = true;
  };

  const revealFallback = () => {
    pendingFallback = false;
    if (fallback) fallback.hidden = false;
  };

  const prepareFallback = (type: "link" | "sms", target: string, display: string) => {
    if (!fallback || !fallbackMessage || !copyValue || !copyButton) return;

    const isSms = type === "sms";
    copyValue.value = isSms ? display : target;
    copyValue.setAttribute("aria-label", isSms ? "Phone number" : "Link");
    fallbackMessage.textContent = isSms
      ? "Could not open messages automatically. Copy the number below."
      : "Could not open the link automatically. Copy it below.";
    defaultCopyLabel = isSms ? "Copy number" : "Copy link";
    copyButton.textContent = defaultCopyLabel;
  };

  const scheduleFallback = () => {
    pendingFallback = true;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(() => {
      if (document.visibilityState === "visible") revealFallback();
    }, 1100);
  };

  copyButton?.addEventListener("click", async () => {
    if (!copyValue || !copyButton) return;
    if (copyResetTimer) window.clearTimeout(copyResetTimer);

    const copied = await copyContactValue(copyValue);
    copyButton.textContent = copied ? "Copied" : "Select and copy";
    if (!copied) {
      copyValue.focus({ preventScroll: true });
      copyValue.select();
    }

    copyResetTimer = window.setTimeout(() => {
      copyButton.textContent = defaultCopyLabel;
    }, 1600);
  });

  document.addEventListener("visibilitychange", () => {
    if (pendingFallback && document.visibilityState === "visible") revealFallback();
  });

  window.addEventListener("pageshow", () => {
    if (pendingFallback) revealFallback();
  });

  link.addEventListener("click", async (event) => {
    event.preventDefault();
    if (link.dataset.loading === "1") return;

    hideFallback();
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
      prepareFallback(type, target, display);
      if (label) label.textContent = type === "sms" ? `SMS · ${display}` : `OPEN · ${display || defaultLabel}`;
      void link.offsetWidth;
      link.classList.add("is-resolved");

      try {
        window.location.assign(target);
        scheduleFallback();
      } catch {
        revealFallback();
      }
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
