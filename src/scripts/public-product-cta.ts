type ContactResponse = {
  ok: true;
  contact: {
    target: string;
    type: "link" | "sms";
    display?: string;
  };
};

type ResolvedContact = {
  target: string;
  type: "link" | "sms";
  copyValue: string;
  visibleValue: string;
};

function isContactResponse(value: unknown): value is ContactResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.ok !== true || !record.contact || typeof record.contact !== "object") return false;
  const contact = record.contact as Record<string, unknown>;
  return typeof contact.target === "string" && (contact.type === "link" || contact.type === "sms");
}

function formatVisibleValue(type: "link" | "sms", target: string, display: string): string {
  if (type === "sms") return display.replace(/^sms:/iu, "");
  if (target.startsWith("mailto:")) return display.replace(/^mailto:/iu, "");

  try {
    const url = new URL(target);
    const hostname = url.hostname.replace(/^www\./iu, "");
    const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/u, "");
    return `${hostname}${pathname}` || display || target;
  } catch {
    return display || target;
  }
}

function copyTextWithSelection(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

async function copyText(value: string): Promise<boolean> {
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Some embedded browsers expose Clipboard API but reject the write.
    }
  }

  return copyTextWithSelection(value);
}

document.querySelectorAll<HTMLElement>("[data-contact-box]").forEach((box) => {
  const resolveButton = box.querySelector<HTMLAnchorElement>("[data-contact-cta]");
  const label = box.querySelector<HTMLElement>("[data-contact-label]");
  const resolvedRow = box.querySelector<HTMLElement>("[data-contact-resolved]");
  const openLink = box.querySelector<HTMLAnchorElement>("[data-contact-open]");
  const visibleValue = box.querySelector<HTMLElement>("[data-contact-value]");
  const smsIcon = box.querySelector<HTMLElement>("[data-contact-sms-icon]");
  const linkIcon = box.querySelector<HTMLElement>("[data-contact-link-icon]");
  const copyButton = box.querySelector<HTMLButtonElement>("[data-contact-copy]");
  const copyLabel = box.querySelector<HTMLElement>("[data-contact-copy-label]");
  if (!resolveButton || !label || !resolvedRow || !openLink || !visibleValue || !copyButton || !copyLabel) return;

  const resolveUrl = resolveButton.dataset.resolveUrl || resolveButton.href;
  const defaultLabel = label.textContent?.trim() || "View Details";
  let resolvedContact: ResolvedContact | null = null;
  let copyResetTimer = 0;

  copyButton.addEventListener("click", async () => {
    if (!resolvedContact) return;
    if (copyResetTimer) window.clearTimeout(copyResetTimer);

    const copied = await copyText(resolvedContact.copyValue);
    copyLabel.textContent = copied ? "Copied" : "Copy failed";
    copyButton.setAttribute("aria-label", copied ? "Copied" : "Copy failed");

    copyResetTimer = window.setTimeout(() => {
      copyLabel.textContent = "Copy";
      copyButton.setAttribute("aria-label", resolvedContact?.type === "sms" ? "Copy number" : "Copy link");
    }, 1400);
  });

  resolveButton.addEventListener("click", async (event) => {
    event.preventDefault();
    if (resolvedContact || resolveButton.dataset.loading === "1") return;

    resolveButton.dataset.loading = "1";
    resolveButton.setAttribute("aria-busy", "true");
    label.textContent = "Connecting…";

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
      resolvedContact = {
        target,
        type,
        copyValue: type === "sms" ? display : target,
        visibleValue: formatVisibleValue(type, target, display),
      };

      openLink.href = target;
      openLink.setAttribute("aria-label", type === "sms" ? `Open messages for ${resolvedContact.visibleValue}` : `Open ${resolvedContact.visibleValue}`);
      visibleValue.textContent = resolvedContact.visibleValue;
      if (smsIcon) smsIcon.hidden = type !== "sms";
      if (linkIcon) linkIcon.hidden = type !== "link";
      copyButton.setAttribute("aria-label", type === "sms" ? "Copy number" : "Copy link");

      resolveButton.hidden = true;
      resolvedRow.hidden = false;
      void resolvedRow.offsetWidth;
      resolvedRow.classList.add("is-resolved");
    } catch (error) {
      console.error(error);
      label.textContent = "Temporarily unavailable";
      window.setTimeout(() => {
        if (resolveButton.dataset.loading !== "1") label.textContent = defaultLabel;
      }, 1600);
    } finally {
      delete resolveButton.dataset.loading;
      resolveButton.removeAttribute("aria-busy");
    }
  });
});
