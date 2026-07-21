function resizeTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(textarea.scrollHeight, 68)}px`;
}

function initializeAutoGrow(root: ParentNode = document): void {
  root.querySelectorAll<HTMLTextAreaElement>("textarea[data-auto-grow]").forEach((textarea) => {
    textarea.dataset.autoGrowReady = "1";
    textarea.oninput = () => resizeTextarea(textarea);
    requestAnimationFrame(() => resizeTextarea(textarea));
  });
}

function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

function initializeProductEditors(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-product-editor]").forEach((editor) => {
    if (editor.dataset.productEditorReady === "1") return;

    const category = editor.querySelector<HTMLInputElement>("[data-category-name]");
    const filterInputs = Array.from(editor.querySelectorAll<HTMLInputElement>("[data-category-filter]"));
    if (!category || filterInputs.length === 0) return;

    const optionElements = Array.from(editor.querySelectorAll<HTMLOptionElement>("datalist option"));
    const categoryFilters = new Map(
      optionElements.map((option) => [
        normalizeCategoryName(option.value),
        new Set((option.dataset.filterIds ?? "").split(",").filter(Boolean)),
      ]),
    );
    let previousKey = normalizeCategoryName(category.value);

    const syncFilters = (): void => {
      const key = normalizeCategoryName(category.value);
      if (key === previousKey) return;
      previousKey = key;
      const selected = categoryFilters.get(key) ?? new Set<string>();
      for (const input of filterInputs) input.checked = selected.has(input.value);
    };

    category.addEventListener("input", syncFilters);
    category.addEventListener("change", syncFilters);
    editor.dataset.productEditorReady = "1";
  });
}

function uploadBelongsToForm(upload: HTMLElement, form: HTMLFormElement): boolean {
  const formId = upload.dataset.formId ?? "";
  return formId ? formId === form.id : upload.closest("form") === form;
}

function initializeDirtyForms(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>("form[data-admin-dirty-form]").forEach((form) => {
    if (form.dataset.adminDirtyReady === "1") return;

    const markDirty = (): void => {
      form.dataset.adminDirty = "1";
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);

    document.querySelectorAll<HTMLElement>("[data-direct-image-upload]").forEach((upload) => {
      if (!uploadBelongsToForm(upload, form)) return;
      const preview = upload.querySelector<HTMLElement>("[data-upload-preview]");
      if (preview) new MutationObserver(markDirty).observe(preview, { childList: true });
    });

    form.dataset.adminDirty = "0";
    form.dataset.adminDirtyReady = "1";
  });
}

function initializeAdminForms(root: ParentNode = document): void {
  initializeAutoGrow(root);
  initializeProductEditors(root);
  initializeDirtyForms(root);
}

function clearDirectUploads(form: HTMLFormElement): void {
  document.querySelectorAll<HTMLElement>("[data-direct-image-upload]").forEach((upload) => {
    if (!uploadBelongsToForm(upload, form)) return;

    const multiple = upload.dataset.multiple === "1";
    const values = upload.querySelector<HTMLElement>("[data-upload-values]");
    const preview = upload.querySelector<HTMLElement>("[data-upload-preview]");
    const status = upload.querySelector<HTMLElement>("[data-upload-status]");
    const input = upload.querySelector<HTMLInputElement>("[data-upload-input]");

    values?.querySelectorAll<HTMLInputElement>("[data-upload-hidden]").forEach((field) => {
      if (multiple) field.remove();
      else field.value = "";
    });
    preview?.querySelectorAll("[data-upload-item]").forEach((item) => item.remove());
    if (preview) preview.hidden = true;
    if (status) status.textContent = "尚未上传";
    if (input) input.value = "";
    upload.dataset.uploading = "0";
  });
}

function clearForm(form: HTMLFormElement): void {
  form.reset();
  clearDirectUploads(form);
  form.querySelectorAll<HTMLTextAreaElement>("textarea[data-auto-grow]").forEach((textarea) => {
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  form.querySelectorAll<HTMLInputElement>("[data-category-filter]").forEach((input) => {
    input.checked = false;
  });
  form.dataset.adminDirty = "1";
  form.querySelector<HTMLElement>("[autofocus]")?.focus();
}

initializeAdminForms();
document.addEventListener("admin:navigation", () => initializeAdminForms());
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>("[data-form-clear]");
  if (!button) return;
  const formId = button.dataset.formClear ?? "";
  const form = formId ? document.getElementById(formId) : null;
  if (!(form instanceof HTMLFormElement)) return;
  clearForm(form);
});
