const initializedForms = new WeakSet<HTMLFormElement>();

function initializeProductManagement(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>("form[data-product-management-form]").forEach((form) => {
    if (initializedForms.has(form)) return;

    form.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
      if (!target.hasAttribute("data-product-management-autosave")) return;
      form.requestSubmit();
    });

    initializedForms.add(form);
  });
}

initializeProductManagement();
document.addEventListener("admin:navigation", () => initializeProductManagement());
