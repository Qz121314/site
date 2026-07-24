const initializedForms = new WeakSet<HTMLFormElement>();
const AUTOSAVE_DELAY_MS = 180;

function initializeProductManagement(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>("form[data-product-management-form]").forEach((form) => {
    if (initializedForms.has(form)) return;

    let autosaveTimer = 0;
    form.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      if (!target.hasAttribute("data-product-management-autosave")) return;

      if (autosaveTimer) window.clearTimeout(autosaveTimer);
      autosaveTimer = window.setTimeout(() => {
        autosaveTimer = 0;
        if (form.isConnected) form.requestSubmit();
      }, AUTOSAVE_DELAY_MS);
    });

    form.addEventListener("submit", () => {
      if (autosaveTimer) window.clearTimeout(autosaveTimer);
      autosaveTimer = 0;
    });

    initializedForms.add(form);
  });
}

initializeProductManagement();
document.addEventListener("admin:navigation", () => initializeProductManagement());
