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

function uploadBelongsToForm(upload: HTMLElement, form: HTMLFormElement): boolean {
  const formId = upload.dataset.formId ?? "";
  return formId ? formId === form.id : upload.closest("form") === form;
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
  form.querySelector<HTMLElement>("[autofocus]")?.focus();
}

initializeAutoGrow();
document.addEventListener("admin:navigation", () => initializeAutoGrow());
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>("[data-form-clear]");
  if (!button) return;
  const formId = button.dataset.formClear ?? "";
  const form = formId ? document.getElementById(formId) : null;
  if (!(form instanceof HTMLFormElement)) return;
  clearForm(form);
});
