const ACTIVATION_WINDOW_MS = 650;

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!(event.target instanceof Element)) return;

  const control = event.target.closest<HTMLElement>('a[href], button[type="submit"]');
  if (!control) return;
  if (control.closest("[data-hero-track]") || control.matches('[target="_blank"], [download]')) return;

  const now = performance.now();
  const lastActivation = Number(control.dataset.lastActivation || "0");
  if (now - lastActivation < ACTIVATION_WINDOW_MS) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  control.dataset.lastActivation = String(now);
  window.setTimeout(() => delete control.dataset.lastActivation, ACTIVATION_WINDOW_MS);
}, true);

const gate = document.querySelector<HTMLElement>("[data-adult-gate]");
const accept = document.querySelector<HTMLButtonElement>("[data-adult-accept]");
const exit = document.querySelector<HTMLButtonElement>("[data-adult-exit]");

if (gate && accept && exit) {
  const background = Array.from(document.body.children).filter(
    (element): element is HTMLElement => element instanceof HTMLElement && element !== gate,
  );
  if (!document.documentElement.classList.contains("adult-confirmed")) {
    document.documentElement.style.overflow = "hidden";
    background.forEach((element) => { element.inert = true; });
    window.requestAnimationFrame(() => accept.focus());
  }

  accept.addEventListener("click", () => {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `site_adult_confirmed=1; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    document.documentElement.classList.add("adult-confirmed");
    gate.remove();
    background.forEach((element) => { element.inert = false; });
    document.documentElement.style.overflow = "";
  });

  exit.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.replace("about:blank");
  });
}
