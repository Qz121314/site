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

initializeAutoGrow();
document.addEventListener("admin:navigation", () => initializeAutoGrow());
