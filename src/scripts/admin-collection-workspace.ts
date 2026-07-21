function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("zh-CN");
}

function updateSelectionUrl(root: HTMLElement, selectedId: string): void {
  const parameter = root.dataset.selectionParam ?? "";
  if (!parameter) return;

  const url = new URL(window.location.href);
  if (selectedId) url.searchParams.set(parameter, selectedId);
  else url.searchParams.delete(parameter);
  history.replaceState(history.state, "", url);
}

function selectCollectionItem(root: HTMLElement, selectedId: string, updateUrl = true): void {
  root.querySelectorAll<HTMLElement>("[data-collection-item]").forEach((item) => {
    const selected = item.dataset.collectionItem === selectedId;
    item.classList.toggle("is-active", selected);
    item.querySelector<HTMLElement>("[data-collection-select]")?.setAttribute(
      "aria-current",
      selected ? "true" : "false",
    );
  });

  root.querySelectorAll<HTMLElement>("[data-collection-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.collectionPanel !== selectedId;
  });

  if (updateUrl) updateSelectionUrl(root, selectedId);
}

function initializeCollectionWorkspace(root: HTMLElement): void {
  if (root.dataset.collectionWorkspaceReady === "1") return;

  const search = root.querySelector<HTMLInputElement>("[data-collection-search]");
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-collection-item]"));
  const empty = root.querySelector<HTMLElement>("[data-collection-search-empty]");

  const applySearch = (): void => {
    const query = normalizeSearch(search?.value ?? "");
    const visible = items.filter((item) => {
      const text = normalizeSearch(item.dataset.searchText ?? item.textContent ?? "");
      const matches = !query || text.includes(query);
      item.hidden = !matches;
      return matches;
    });

    if (empty) empty.hidden = visible.length > 0;

    const active = items.find((item) => item.classList.contains("is-active"));
    if (active?.hidden) {
      selectCollectionItem(root, visible[0]?.dataset.collectionItem ?? "");
    } else if (!active && visible.length > 0) {
      selectCollectionItem(root, visible[0]?.dataset.collectionItem ?? "", false);
    }
  };

  search?.addEventListener("input", applySearch);
  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest<HTMLElement>("[data-collection-select]");
    if (!trigger || !root.contains(trigger)) return;
    const item = trigger.closest<HTMLElement>("[data-collection-item]");
    if (!item) return;
    selectCollectionItem(root, item.dataset.collectionItem ?? "");
  });

  root.dataset.collectionWorkspaceReady = "1";
  applySearch();
}

function recordDatasetKey(fieldName: string): string {
  const normalized = fieldName.replace(/[-_]([a-z])/gu, (_match, letter: string) => letter.toUpperCase());
  return `record${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function setSingleUploadValue(upload: HTMLElement, trigger: HTMLElement): void {
  const imageId = trigger.dataset.recordImageAssetId ?? "";
  const previewUrl = trigger.dataset.recordImagePreviewUrl ?? "";
  const imageName = trigger.dataset.recordImageName ?? "当前图片";
  const imageMeta = trigger.dataset.recordImageMeta ?? "已绑定到当前内容";
  const values = upload.querySelector<HTMLElement>("[data-upload-values]");
  const preview = upload.querySelector<HTMLElement>("[data-upload-preview]");
  const status = upload.querySelector<HTMLElement>("[data-upload-status]");
  const input = upload.querySelector<HTMLInputElement>("[data-upload-input]");
  const hidden = values?.querySelector<HTMLInputElement>("[data-upload-hidden]");

  if (hidden) hidden.value = imageId;
  preview?.querySelectorAll("[data-upload-item]").forEach((item) => item.remove());
  if (input) input.value = "";
  upload.dataset.uploading = "0";

  if (!imageId || !preview) {
    if (preview) preview.hidden = true;
    if (status) status.textContent = "尚未上传";
    return;
  }

  const item = document.createElement("article");
  item.className = "direct-upload-item";
  item.dataset.uploadItem = "";
  item.dataset.imageId = imageId;
  item.dataset.uploadOrder = "0";

  const image = document.createElement("img");
  image.src = previewUrl || `/api/admin/images/${encodeURIComponent(imageId)}/content`;
  image.alt = imageName;
  image.loading = "lazy";

  const body = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = imageName;
  title.title = imageName;
  const meta = document.createElement("span");
  meta.textContent = imageMeta;
  body.append(title, meta);

  const remove = document.createElement("button");
  remove.className = "direct-upload-remove";
  remove.type = "button";
  remove.dataset.uploadRemove = "";
  remove.setAttribute("aria-label", "移除图片");
  remove.textContent = "×";

  item.append(image, body, remove);
  preview.appendChild(item);
  preview.hidden = false;
  if (status) status.textContent = "已绑定 1 张";
}

function populateRecordDialog(trigger: HTMLElement): void {
  const dialogId = trigger.dataset.recordDialog ?? "";
  const dialog = dialogId ? document.getElementById(dialogId) : null;
  if (!(dialog instanceof HTMLDialogElement)) return;

  const form = dialog.querySelector<HTMLFormElement>("form[data-record-form]");
  if (!form) return;

  form.reset();
  const action = trigger.dataset.recordAction;
  if (action) form.action = action;

  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]").forEach((field) => {
    if (field.type === "file") return;
    const value = trigger.dataset[recordDatasetKey(field.name) as keyof DOMStringMap];
    if (value === undefined) return;
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      field.checked = value === "1" || value === "true";
    } else {
      field.value = value;
    }
  });

  dialog.querySelectorAll<HTMLElement>("[data-direct-image-upload]").forEach((upload) => {
    setSingleUploadValue(upload, trigger);
  });

  const title = trigger.dataset.recordTitle;
  const heading = dialog.querySelector<HTMLElement>(".admin-dialog-header h2");
  if (title && heading) heading.textContent = title;
}

function initializeCollectionWorkspaces(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-admin-collection-workspace]").forEach(initializeCollectionWorkspace);
}

initializeCollectionWorkspaces();
document.addEventListener("admin:navigation", () => initializeCollectionWorkspaces());
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest<HTMLElement>("[data-record-dialog]");
  if (trigger) populateRecordDialog(trigger);
}, { capture: true });
