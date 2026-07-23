export {};

type UploadVariant = "" | "product" | "hero" | "logo" | "favicon";

type RenderedImage = {
  blob: Blob;
  width: number;
  height: number;
};

type PendingUpload = {
  clientId: string;
  originalName: string;
  fileName: string;
  original: RenderedImage;
  thumbnail: RenderedImage | null;
  variant: UploadVariant;
  localUrl: string;
};

type UploadedImage = {
  id: string;
  originalName: string;
  width: number;
  height: number;
};

type DirectUploadController = {
  commit: () => Promise<void>;
  clearPending: () => void;
  hasSelection: () => boolean;
  hasWork: () => boolean;
  isActive: () => boolean;
  required: boolean;
};

type UploadRoot = HTMLElement & {
  __directUploadController?: DirectUploadController;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.82;
const THUMBNAIL_DIMENSION = 480;
const THUMBNAIL_QUALITY = 0.72;
const HERO_RESPONSIVE_DIMENSION = 960;
const HERO_RESPONSIVE_QUALITY = 0.76;
const LOGO_DIMENSION = 320;
const FAVICON_DIMENSION = 128;
const LOCAL_PROCESSING_CONCURRENCY = 3;
const SAVE_UPLOAD_CONCURRENCY = 3;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const initializedRoots = new WeakSet<UploadRoot>();
const initializedForms = new WeakSet<HTMLFormElement>();

async function decodeImage(file: File): Promise<DecodedImage> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image decode failed"));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function renderVariant(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maximumDimension: number,
  quality: number,
): Promise<RenderedImage> {
  const scale = Math.min(1, maximumDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Image compression failed"));
      else resolve({ blob, width, height });
    }, "image/webp", quality);
  });
}

function thumbnailSettings(variant: UploadVariant): { dimension: number; quality: number } | null {
  if (!variant) return null;
  if (variant === "hero") return { dimension: HERO_RESPONSIVE_DIMENSION, quality: HERO_RESPONSIVE_QUALITY };
  if (variant === "logo") return { dimension: LOGO_DIMENSION, quality: THUMBNAIL_QUALITY };
  if (variant === "favicon") return { dimension: FAVICON_DIMENSION, quality: THUMBNAIL_QUALITY };
  return { dimension: THUMBNAIL_DIMENSION, quality: THUMBNAIL_QUALITY };
}

async function prepareImage(file: File, variant: UploadVariant): Promise<PendingUpload> {
  if (!SUPPORTED_TYPES.has(file.type)) throw new Error("Unsupported image type");
  const decoded = await decodeImage(file);
  try {
    const original = await renderVariant(
      decoded.source,
      decoded.width,
      decoded.height,
      MAX_DIMENSION,
      WEBP_QUALITY,
    );
    const settings = thumbnailSettings(variant);
    const thumbnail = settings
      ? await renderVariant(
          decoded.source,
          decoded.width,
          decoded.height,
          settings.dimension,
          settings.quality,
        )
      : null;
    const baseName = file.name.replace(/\.[^.]+$/u, "") || "image";
    return {
      clientId: `pending-${crypto.randomUUID()}`,
      originalName: file.name,
      fileName: `${baseName}.webp`,
      original,
      thumbnail,
      variant,
      localUrl: URL.createObjectURL(original.blob),
    };
  } finally {
    decoded.release();
  }
}

async function uploadPreparedImage(pending: PendingUpload): Promise<UploadedImage> {
  const body = new FormData();
  body.append(
    "file",
    new File([pending.original.blob], pending.fileName, { type: "image/webp" }),
  );
  if (pending.thumbnail) {
    body.append(
      "thumbnail",
      new File([pending.thumbnail.blob], "thumbnail.webp", { type: "image/webp" }),
    );
    body.append("variant", pending.variant);
  }
  body.append("originalName", pending.originalName);

  const response = await fetch("/api/admin/images/upload", {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  });
  if (response.status === 401) {
    window.location.assign("/admin/login");
    throw new DOMException("Session expired", "AbortError");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    throw new Error(`Image upload returned invalid JSON (${response.status})`);
  }
  const record = payload as Record<string, unknown>;
  const image = record.image;
  if (!response.ok || record.ok !== true || !image || typeof image !== "object") {
    throw new Error(typeof record.error === "string" ? record.error : `HTTP ${response.status}`);
  }
  const imageRecord = image as Record<string, unknown>;
  if (
    typeof imageRecord.id !== "string"
    || typeof imageRecord.originalName !== "string"
    || typeof imageRecord.width !== "number"
    || typeof imageRecord.height !== "number"
  ) {
    throw new Error("Image upload response is incomplete");
  }

  return {
    id: imageRecord.id,
    originalName: imageRecord.originalName,
    width: imageRecord.width,
    height: imageRecord.height,
  };
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<unknown[]> {
  let nextIndex = 0;
  const errors: unknown[] = [];
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        await worker(items[index] as T, index);
      } catch (error) {
        errors.push(error);
      }
    }
  }));
  return errors;
}

function insertByOrder(
  container: HTMLElement,
  element: HTMLElement,
  selector: string,
  order: number,
): void {
  const before = Array.from(container.querySelectorAll<HTMLElement>(selector)).find((candidate) => {
    const candidateOrder = Number(candidate.dataset.uploadOrder ?? Number.MAX_SAFE_INTEGER);
    return candidateOrder > order;
  });
  container.insertBefore(element, before ?? null);
}

function formForUpload(root: UploadRoot): HTMLFormElement | null {
  const formId = root.dataset.formId ?? "";
  if (formId) {
    const form = document.getElementById(formId);
    return form instanceof HTMLFormElement ? form : null;
  }
  return root.closest("form");
}

function relatedControllers(form: HTMLFormElement): DirectUploadController[] {
  return Array.from(document.querySelectorAll<UploadRoot>("[data-direct-image-upload]"))
    .filter((root) => formForUpload(root) === form)
    .map((root) => root.__directUploadController)
    .filter((controller): controller is DirectUploadController => Boolean(controller));
}

function ensureFormCoordinator(form: HTMLFormElement): void {
  if (initializedForms.has(form)) return;
  initializedForms.add(form);
  form.dataset.directUploadValidation = "1";

  form.addEventListener("submit", (event) => {
    if (form.dataset.directUploadResume === "1") {
      delete form.dataset.directUploadResume;
      return;
    }

    const controllers = relatedControllers(form).filter((controller) => controller.isActive());
    const missingRequired = controllers.some((controller) => controller.required && !controller.hasSelection());
    if (missingRequired) {
      event.preventDefault();
      window.alert("请先选择必需图片。");
      return;
    }

    if (!controllers.some((controller) => controller.hasWork())) return;
    event.preventDefault();
    if (form.dataset.directUploadCommitting === "1") return;

    form.dataset.directUploadCommitting = "1";
    form.setAttribute("aria-busy", "true");
    const submitter = event instanceof SubmitEvent && event.submitter instanceof HTMLElement
      ? event.submitter
      : null;

    void Promise.all(controllers.map((controller) => controller.commit())).then(() => {
      const stillMissing = controllers.some((controller) => controller.required && !controller.hasSelection());
      if (stillMissing) throw new Error("Required image is missing after upload");
      form.dataset.directUploadResume = "1";
      if (
        submitter instanceof HTMLButtonElement
        || submitter instanceof HTMLInputElement
      ) {
        if (submitter.isConnected && !submitter.disabled) {
          form.requestSubmit(submitter);
          return;
        }
      }
      form.requestSubmit();
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error(error);
      window.alert("图片上传失败，已保留本地预览。请检查后再次保存。");
    }).finally(() => {
      delete form.dataset.directUploadCommitting;
      form.removeAttribute("aria-busy");
    });
  });
}

function initializeUpload(root: UploadRoot): void {
  if (initializedRoots.has(root)) return;

  const input = root.querySelector<HTMLInputElement>("[data-upload-input]");
  const uploadButton = root.querySelector<HTMLElement>("[data-upload-button]");
  const values = root.querySelector<HTMLElement>("[data-upload-values]");
  const preview = root.querySelector<HTMLElement>("[data-upload-preview]");
  const status = root.querySelector<HTMLElement>("[data-upload-status]");
  if (!input || !values || !preview || !status) return;

  const fieldName = root.dataset.fieldName || "imageAssetId";
  const multiple = root.dataset.multiple === "1";
  const required = root.dataset.required === "1";
  const maxFiles = Number(root.dataset.maxFiles || (multiple ? "30" : "1"));
  const formId = root.dataset.formId || "";
  const directoryThumbnail = root.dataset.directoryThumbnail === "1";
  const heroResponsive = root.dataset.heroResponsive === "1";
  const variant = (root.dataset.assetVariant || (heroResponsive ? "hero" : directoryThumbnail ? "product" : "")) as UploadVariant;
  const pendingUploads = new Map<string, PendingUpload>();
  const preparationTasks = new Set<Promise<void>>();
  const localUrls = new Set<string>();
  let preparing = 0;
  let uploading = 0;

  const hiddenInputs = (): HTMLInputElement[] => Array.from(values.querySelectorAll<HTMLInputElement>("[data-upload-hidden]"));
  const items = (): HTMLElement[] => Array.from(preview.querySelectorAll<HTMLElement>("[data-upload-item]"));
  const findField = (key: string): HTMLInputElement | undefined => hiddenInputs().find((field) => (
    field.dataset.imageId === key || field.value === key
  ));
  const findItem = (key: string): HTMLElement | null => preview.querySelector<HTMLElement>(
    `[data-upload-item][data-image-id="${CSS.escape(key)}"]`,
  );
  const isActive = (): boolean => !root.closest<HTMLElement>("[data-ad-creative-panel][hidden]");

  hiddenInputs().forEach((field, index) => {
    if (!field.dataset.imageId && field.value) field.dataset.imageId = field.value;
    if (!field.dataset.uploadOrder) field.dataset.uploadOrder = String(index);
  });
  items().forEach((item, index) => {
    if (!item.dataset.uploadOrder) item.dataset.uploadOrder = String(index);
  });

  const revokeLocalUrl = (url: string): void => {
    if (!localUrls.delete(url)) return;
    URL.revokeObjectURL(url);
  };

  const refresh = (): void => {
    const count = items().length;
    const pendingCount = pendingUploads.size;
    const busy = preparing > 0 || uploading > 0;
    preview.hidden = count === 0;
    root.dataset.preparing = preparing > 0 ? "1" : "0";
    root.dataset.uploading = uploading > 0 ? "1" : "0";
    root.dataset.pendingUploads = String(pendingCount);
    input.disabled = busy;
    uploadButton?.setAttribute("aria-disabled", busy ? "true" : "false");
    preview.querySelectorAll<HTMLButtonElement>("[data-upload-remove]").forEach((button) => {
      button.disabled = uploading > 0;
    });

    if (uploading > 0) status.textContent = `保存中，正在上传 ${uploading} 张…`;
    else if (preparing > 0) status.textContent = `正在浏览器内压缩 ${preparing} 张…`;
    else if (pendingCount > 0) status.textContent = `已预览 ${count} 张 · ${pendingCount} 张待保存`;
    else if (count > 0) status.textContent = `已绑定 ${count} 张`;
    else status.textContent = "尚未选择";
  };

  const removeByKey = (key: string): void => {
    const pending = pendingUploads.get(key);
    if (pending) {
      pendingUploads.delete(key);
      revokeLocalUrl(pending.localUrl);
    }

    const field = findField(key);
    if (field) {
      if (multiple) field.remove();
      else {
        field.value = "";
        delete field.dataset.imageId;
        delete field.dataset.uploadPending;
      }
    }
    findItem(key)?.remove();
    refresh();
  };

  const clearPending = (): void => {
    for (const pending of Array.from(pendingUploads.values())) {
      removeByKey(pending.clientId);
    }
    input.value = "";
    refresh();
  };

  const addPending = (pending: PendingUpload, order: number): void => {
    if (!multiple) {
      clearPending();
      items().forEach((item) => item.remove());
    }

    let field = multiple ? undefined : hiddenInputs()[0];
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = fieldName;
      field.dataset.uploadHidden = "";
      if (formId) field.setAttribute("form", formId);
    }
    field.value = "";
    field.dataset.imageId = pending.clientId;
    field.dataset.uploadOrder = String(order);
    field.dataset.uploadPending = "";
    field.disabled = false;
    if (multiple) insertByOrder(values, field, "[data-upload-hidden]", order);

    const item = document.createElement("article");
    item.className = "direct-upload-item";
    item.dataset.uploadItem = "";
    item.dataset.uploadPending = "";
    item.dataset.imageId = pending.clientId;
    item.dataset.uploadOrder = String(order);

    const image = document.createElement("img");
    image.src = pending.localUrl;
    image.alt = pending.originalName || "待保存图片";

    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = pending.originalName || "待保存图片";
    title.title = title.textContent;
    const meta = document.createElement("span");
    meta.textContent = `${pending.original.width}×${pending.original.height} · 待保存`;
    details.appendChild(title);
    details.appendChild(meta);

    const remove = document.createElement("button");
    remove.className = "direct-upload-remove";
    remove.type = "button";
    remove.dataset.uploadRemove = "";
    remove.setAttribute("aria-label", "移除图片");
    remove.textContent = "×";

    item.appendChild(image);
    item.appendChild(details);
    item.appendChild(remove);
    pendingUploads.set(pending.clientId, pending);
    localUrls.add(pending.localUrl);
    insertByOrder(preview, item, "[data-upload-item]", order);
    refresh();
  };

  const finalizeUpload = (pending: PendingUpload, image: UploadedImage): void => {
    const field = findField(pending.clientId);
    const item = findItem(pending.clientId);
    if (!field || !item) throw new Error("Pending image disappeared before save");

    field.value = image.id;
    field.dataset.imageId = image.id;
    delete field.dataset.uploadPending;
    item.dataset.imageId = image.id;
    delete item.dataset.uploadPending;
    const title = item.querySelector<HTMLElement>("strong");
    const meta = item.querySelector<HTMLElement>("span");
    if (title) {
      title.textContent = image.originalName;
      title.title = image.originalName;
    }
    if (meta) meta.textContent = `${image.width}×${image.height}`;
    pendingUploads.delete(pending.clientId);
  };

  const waitForPreparations = async (): Promise<void> => {
    while (preparationTasks.size > 0) {
      await Promise.allSettled(Array.from(preparationTasks));
    }
  };

  const commit = async (): Promise<void> => {
    await waitForPreparations();
    if (!isActive()) return;

    const ordered = items()
      .map((item) => pendingUploads.get(item.dataset.imageId ?? ""))
      .filter((pending): pending is PendingUpload => Boolean(pending));
    if (ordered.length === 0) return;

    uploading = ordered.length;
    refresh();
    const errors = await runWithConcurrency(ordered, SAVE_UPLOAD_CONCURRENCY, async (pending) => {
      try {
        const uploaded = await uploadPreparedImage(pending);
        finalizeUpload(pending, uploaded);
      } finally {
        uploading -= 1;
        refresh();
      }
    });
    if (errors.length > 0) throw new AggregateError(errors, "One or more images failed to upload");
  };

  const controller: DirectUploadController = {
    commit,
    clearPending,
    hasSelection: () => items().length > 0,
    hasWork: () => preparing > 0 || pendingUploads.size > 0,
    isActive,
    required,
  };
  root.__directUploadController = controller;

  preview.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-upload-remove]") : null;
    if (!button || uploading > 0) return;
    const item = button.closest<HTMLElement>("[data-upload-item]");
    const key = item?.dataset.imageId ?? "";
    if (key) removeByKey(key);
  });

  input.addEventListener("change", () => {
    const selected = Array.from(input.files ?? []);
    input.value = "";
    if (selected.length === 0) return;

    const available = multiple ? Math.max(0, maxFiles - items().length) : 1;
    const files = selected.slice(0, available);
    if (files.length === 0) {
      window.alert(`最多只能绑定 ${maxFiles} 张图片。`);
      return;
    }
    if (selected.length > files.length) {
      window.alert(`最多只能绑定 ${maxFiles} 张图片，本次仅处理前 ${files.length} 张。`);
    }

    const startOrder = multiple ? items().length : 0;
    preparing += files.length;
    refresh();
    const task = runWithConcurrency(files, LOCAL_PROCESSING_CONCURRENCY, async (file, index) => {
      try {
        const pending = await prepareImage(file, variant);
        addPending(pending, startOrder + index);
      } catch (error) {
        console.error(error);
        window.alert(`图片 ${file.name} 本地处理失败，请重新选择。`);
      } finally {
        preparing -= 1;
        refresh();
      }
    }).then(() => undefined);
    preparationTasks.add(task);
    void task.finally(() => preparationTasks.delete(task));
  });

  root.addEventListener("direct-upload:reset", clearPending);
  const form = formForUpload(root);
  if (form) {
    ensureFormCoordinator(form);
    form.addEventListener("reset", () => queueMicrotask(clearPending));
  }

  const cleanupLocalUrls = (): void => {
    localUrls.forEach((url) => URL.revokeObjectURL(url));
    localUrls.clear();
  };
  document.addEventListener("admin:navigation", cleanupLocalUrls, { once: true });
  window.addEventListener("pagehide", cleanupLocalUrls, { once: true });

  initializedRoots.add(root);
  root.dataset.directUploadReady = "1";
  refresh();
}

function initializeUploads(root: ParentNode = document): void {
  root.querySelectorAll<UploadRoot>("[data-direct-image-upload]").forEach(initializeUpload);
}

initializeUploads();
document.addEventListener("admin:navigation", () => initializeUploads());
