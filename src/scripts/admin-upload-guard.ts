const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;

document.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches("[data-upload-input]")) return;

  const root = input.closest<HTMLElement>("[data-direct-image-upload]");
  if (!root) return;

  if (root.dataset.uploading === "1") {
    event.stopImmediatePropagation();
    input.value = "";
    alert("当前图片仍在上传，请等待完成后再选择。\n");
    return;
  }

  const files = Array.from(input.files ?? []);
  const oversized = files.find((file) => file.size > MAX_SOURCE_IMAGE_BYTES);
  if (oversized) {
    event.stopImmediatePropagation();
    input.value = "";
    alert(`图片 ${oversized.name} 超过 25 MB，请先缩小文件后再上传。`);
  }
}, true);

document.addEventListener("load", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (!image.closest("[data-direct-image-upload]") || !image.src.startsWith("blob:")) return;

  URL.revokeObjectURL(image.src);
}, true);
