import { useEffect, useSyncExternalStore } from 'react';

const PROTECTED_FORM_SELECTOR = '.admin-dialog form';
const SPECIAL_DRAFT_ACTION_SELECTOR = [
  '.product-tag-option',
  '.product-media-actions button',
  '.product-auto-cover',
  '.icon-picker button',
  '.section-icon-upload-actions button',
  '.branding-upload-actions button',
].join(', ');

export type AdminUnsavedSnapshot = {
  isDirty: boolean;
  count: number;
  labels: string[];
};

type SerializedField = [string, unknown];

const baselines = new WeakMap<HTMLFormElement, string>();
const dirtyForms = new Set<HTMLFormElement>();
const explicitDirtySources = new Map<string, string>();
const listeners = new Set<() => void>();
let installed = false;
let snapshot: AdminUnsavedSnapshot = { isDirty: false, count: 0, labels: [] };

function protectedForm(element: Element | null): HTMLFormElement | null {
  const form = element?.closest('form');
  return form instanceof HTMLFormElement && form.matches(PROTECTED_FORM_SELECTOR) ? form : null;
}

function formLabel(form: HTMLFormElement): string {
  const title = form.closest('.admin-dialog')?.querySelector('h3')?.textContent?.trim();
  return title || '当前编辑内容';
}

function serializeForm(form: HTMLFormElement): string {
  const values: SerializedField[] = [];
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'button' || element.type === 'submit' || element.type === 'reset') continue;
      if (element.type === 'file') {
        values.push([
          element.name || `file:${element.accept}`,
          Array.from(element.files ?? []).map((file) => [file.name, file.size, file.lastModified]),
        ]);
        continue;
      }
      if (element.type === 'checkbox' || element.type === 'radio') {
        values.push([element.name || element.outerHTML, element.checked]);
        continue;
      }
      values.push([element.name || element.outerHTML, element.value]);
      continue;
    }
    if (element instanceof HTMLTextAreaElement) {
      values.push([element.name || element.outerHTML, element.value]);
      continue;
    }
    if (element instanceof HTMLSelectElement) {
      values.push([
        element.name || element.outerHTML,
        element.multiple
          ? Array.from(element.selectedOptions).map((option) => option.value)
          : element.value,
      ]);
    }
  }
  return JSON.stringify(values);
}

function updateSnapshot(): void {
  for (const form of [...dirtyForms]) {
    if (!form.isConnected) dirtyForms.delete(form);
  }
  const labels = [
    ...new Set([
      ...explicitDirtySources.values(),
      ...[...dirtyForms].map(formLabel),
    ]),
  ];
  const count = explicitDirtySources.size + dirtyForms.size;
  const next: AdminUnsavedSnapshot = {
    isDirty: count > 0,
    count,
    labels,
  };
  if (
    next.isDirty === snapshot.isDirty &&
    next.count === snapshot.count &&
    next.labels.join('\u0000') === snapshot.labels.join('\u0000')
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function registerForm(form: HTMLFormElement): void {
  if (baselines.has(form)) return;
  baselines.set(form, serializeForm(form));
}

function registerForms(root: ParentNode): void {
  if (root instanceof HTMLFormElement && root.matches(PROTECTED_FORM_SELECTOR)) registerForm(root);
  root.querySelectorAll<HTMLFormElement>(PROTECTED_FORM_SELECTOR).forEach(registerForm);
}

function evaluateForm(form: HTMLFormElement): void {
  const baseline = baselines.get(form);
  if (baseline === undefined) {
    registerForm(form);
    return;
  }
  if (serializeForm(form) === baseline) dirtyForms.delete(form);
  else dirtyForms.add(form);
  updateSnapshot();
}

function markFormDirty(form: HTMLFormElement): void {
  registerForm(form);
  dirtyForms.add(form);
  updateSnapshot();
}

function shouldGuardDialogClose(button: HTMLButtonElement): HTMLFormElement | null {
  const dialog = button.closest('.admin-dialog');
  if (!dialog) return null;
  const form = dialog.querySelector('form');
  if (!(form instanceof HTMLFormElement) || !dirtyForms.has(form)) return null;
  const label = button.getAttribute('aria-label');
  const text = button.textContent?.trim();
  return label === '关闭' || text === '取消' ? form : null;
}

function confirmLocalDiscard(form: HTMLFormElement): boolean {
  return window.confirm(`“${formLabel(form)}”存在未保存修改，确认放弃这些修改吗？`);
}

export function installAdminUnsavedStateObserver(): void {
  if (installed) return;
  installed = true;

  registerForms(document);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) registerForms(node);
      });
    });
    updateSnapshot();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener(
    'focusin',
    (event) => {
      if (event.target instanceof Element) {
        const form = protectedForm(event.target);
        if (form) registerForm(form);
      }
    },
    true,
  );

  document.addEventListener(
    'input',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const form = protectedForm(event.target);
      if (form) queueMicrotask(() => evaluateForm(form));
    },
    true,
  );

  document.addEventListener(
    'change',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const form = protectedForm(event.target);
      if (!form) return;
      if (event.target instanceof HTMLInputElement && event.target.type === 'file' && event.target.files?.length) {
        markFormDirty(form);
        return;
      }
      queueMicrotask(() => evaluateForm(form));
    },
    true,
  );

  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest('button');
      if (!(button instanceof HTMLButtonElement)) return;

      const dirtyDialogForm = shouldGuardDialogClose(button);
      if (dirtyDialogForm && !confirmLocalDiscard(dirtyDialogForm)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (!event.target.closest(SPECIAL_DRAFT_ACTION_SELECTOR)) return;
      const form = protectedForm(event.target);
      if (form) queueMicrotask(() => markFormDirty(form));
    },
    true,
  );
}

export function setAdminDirtySource(id: string, label: string, isDirty: boolean): void {
  if (isDirty) explicitDirtySources.set(id, label);
  else explicitDirtySources.delete(id);
  updateSnapshot();
}

export function clearAdminDirtySource(id: string): void {
  if (!explicitDirtySources.delete(id)) return;
  updateSnapshot();
}

export function useAdminDirtySource(id: string, label: string, isDirty: boolean): void {
  useEffect(() => {
    setAdminDirtySource(id, label, isDirty);
    return () => clearAdminDirtySource(id);
  }, [id, isDirty, label]);
}

export function getAdminUnsavedSnapshot(): AdminUnsavedSnapshot {
  return snapshot;
}

export function subscribeAdminUnsavedState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminUnsavedState(): AdminUnsavedSnapshot {
  return useSyncExternalStore(
    subscribeAdminUnsavedState,
    getAdminUnsavedSnapshot,
    getAdminUnsavedSnapshot,
  );
}
