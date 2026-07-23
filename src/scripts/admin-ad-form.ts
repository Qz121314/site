export {};

const initializedAdForms = new WeakSet<HTMLFormElement>();

type CreativeType = "uploaded_image" | "external_media" | "embed_code";
type ValueControl = HTMLElement & { value: string };
type ToggleControl = HTMLElement & { disabled: boolean; type?: string };

function readCreativeType(form: HTMLFormElement): CreativeType {
  const control = form.querySelector<HTMLElement>("[data-ad-creative-type]") as ValueControl | null;
  return (control?.value || "uploaded_image") as CreativeType;
}

function setPanelEnabled(panel: HTMLElement, enabled: boolean): void {
  panel.hidden = !enabled;
  panel.querySelectorAll<HTMLElement>("input, select, textarea").forEach((node) => {
    const field = node as ToggleControl;
    if (field.type === "file") return;
    field.disabled = !enabled;
  });
}

function resetPreview(form: HTMLFormElement): void {
  const preview = form.querySelector<HTMLElement>("[data-ad-preview]");
  const stage = form.querySelector<HTMLElement>("[data-ad-preview-stage]");
  const status = form.querySelector<HTMLElement>("[data-ad-preview-status]");
  if (stage) stage.replaceChildren();
  if (status) status.textContent = "";
  if (preview) preview.hidden = true;
}

function syncAdForm(form: HTMLFormElement): void {
  const target = form.querySelector<HTMLInputElement>("[data-ad-target-url]");
  const creativeType = readCreativeType(form);

  form.querySelectorAll<HTMLElement>("[data-ad-creative-panel]").forEach((panel) => {
    setPanelEnabled(panel, panel.dataset.adCreativePanel === creativeType);
  });

  if (target) target.required = creativeType !== "embed_code";
  resetPreview(form);
}

function createEmbedPreview(code: string, width: number, height: number): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.title = "联盟广告预览";
  frame.width = String(width);
  frame.height = String(height);
  frame.loading = "eager";
  frame.sandbox.add("allow-scripts", "allow-forms", "allow-popups", "allow-popups-to-escape-sandbox");
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent}body{display:grid;place-items:center;min-height:100vh}img,iframe{max-width:100%;height:auto}</style></head><body>${code}</body></html>`;
  return frame;
}

function previewAdvertisement(form: HTMLFormElement): void {
  const creativeType = readCreativeType(form);
  const preview = form.querySelector<HTMLElement>("[data-ad-preview]");
  const stage = form.querySelector<HTMLElement>("[data-ad-preview-stage]");
  const status = form.querySelector<HTMLElement>("[data-ad-preview-status]");
  if (!preview || !stage || !status) return;

  stage.replaceChildren();
  preview.hidden = false;
  status.textContent = "正在加载预览…";

  if (creativeType === "uploaded_image") {
    const source = form.querySelector<HTMLImageElement>("[data-direct-image-upload] [data-upload-preview] img");
    if (!source?.src) {
      status.textContent = "请先选择图片。";
      return;
    }
    const image = new Image();
    image.alt = "";
    image.onload = () => { status.textContent = `${image.naturalWidth}×${image.naturalHeight} · 本地预览成功`; };
    image.onerror = () => { stage.replaceChildren(); status.textContent = "图片预览失败。"; };
    image.src = source.src;
    stage.appendChild(image);
    return;
  }

  const width = Number(form.querySelector<HTMLInputElement>(`[data-ad-creative-panel="${creativeType}"] [name="declaredWidth"]`)?.value || "0");
  const height = Number(form.querySelector<HTMLInputElement>(`[data-ad-creative-panel="${creativeType}"] [name="declaredHeight"]`)?.value || "0");
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    status.textContent = "请先填写有效的声明宽度和高度。";
    return;
  }

  if (creativeType === "external_media") {
    const mediaUrl = form.querySelector<HTMLInputElement>(`[data-ad-creative-panel="external_media"] [name="mediaUrl"]`)?.value.trim() || "";
    if (!mediaUrl) {
      status.textContent = "请先填写外部图片或 GIF 地址。";
      return;
    }
    const image = new Image();
    image.alt = "";
    image.width = width;
    image.height = height;
    image.onload = () => { status.textContent = `${image.naturalWidth}×${image.naturalHeight} · 外部素材加载成功`; };
    image.onerror = () => { stage.replaceChildren(); status.textContent = "外部素材加载失败。"; };
    image.src = mediaUrl;
    stage.appendChild(image);
    return;
  }

  const code = form.querySelector<HTMLTextAreaElement>(`[data-ad-creative-panel="embed_code"] [name="embedCode"]`)?.value.trim() || "";
  if (!code) {
    status.textContent = "请先填写联盟代码。";
    return;
  }
  const frame = createEmbedPreview(code, width, height);
  frame.addEventListener("load", () => { status.textContent = `${width}×${height} · 联盟代码已载入隔离预览`; }, { once: true });
  stage.appendChild(frame);
}

function initializeAdForm(form: HTMLFormElement): void {
  if (initializedAdForms.has(form)) return;
  initializedAdForms.add(form);

  const creativeType = form.querySelector<HTMLElement>("[data-ad-creative-type]");
  creativeType?.addEventListener("change", () => syncAdForm(form));
  form.querySelector<HTMLElement>("[data-ad-preview-button]")?.addEventListener("click", () => previewAdvertisement(form));
  form.addEventListener("reset", () => queueMicrotask(() => syncAdForm(form)));
  syncAdForm(form);
}

function initializeAdForms(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>("[data-ad-form]").forEach(initializeAdForm);
}

initializeAdForms();
document.addEventListener("admin:navigation", () => initializeAdForms());
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest<HTMLElement>("[data-record-dialog]");
  const dialogId = trigger?.dataset.recordDialog ?? "";
  if (dialogId !== "ad-create-dialog" && dialogId !== "ad-edit-dialog") return;
  queueMicrotask(() => {
    const dialog = document.getElementById(dialogId);
    const form = dialog?.querySelector<HTMLFormElement>("[data-ad-form]");
    if (form) syncAdForm(form);
  });
}, { capture: false });
