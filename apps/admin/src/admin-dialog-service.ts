type ConfirmOptions = {
  eyebrow?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PromptOptions = {
  eyebrow?: string;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
};

function appendTextElement<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tagName: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function createDialogShell(eyebrow: string, title: string) {
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-dialog-backdrop admin-service-dialog-backdrop';

  const dialog = document.createElement('section');
  dialog.className = 'admin-dialog admin-dialog-small admin-service-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'admin-dialog-header';
  const heading = document.createElement('div');
  appendTextElement(heading, 'p', eyebrow);
  const titleElement = appendTextElement(heading, 'h3', title);
  const titleId = `admin-service-dialog-${crypto.randomUUID()}`;
  titleElement.id = titleId;
  dialog.setAttribute('aria-labelledby', titleId);
  header.append(heading);
  dialog.append(header);
  backdrop.append(dialog);
  document.body.append(backdrop);

  return { backdrop, dialog };
}

function closeDialog(backdrop: HTMLElement): void {
  backdrop.remove();
}

function addActions(
  dialog: HTMLElement,
  options: { confirmLabel: string; cancelLabel: string; danger?: boolean },
): { confirmButton: HTMLButtonElement; cancelButton: HTMLButtonElement } {
  const actions = document.createElement('div');
  actions.className = 'admin-dialog-actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'secondary-button';
  cancelButton.textContent = options.cancelLabel;

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = options.danger ? 'danger-button' : 'primary-button';
  confirmButton.textContent = options.confirmLabel;

  actions.append(cancelButton, confirmButton);
  dialog.append(actions);
  return { confirmButton, cancelButton };
}

export function adminConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const { backdrop, dialog } = createDialogShell(options.eyebrow ?? '确认操作', options.title);
    appendTextElement(dialog, 'p', options.message, 'admin-service-dialog-message');
    const { confirmButton, cancelButton } = addActions(dialog, {
      confirmLabel: options.confirmLabel ?? '确认',
      cancelLabel: options.cancelLabel ?? '取消',
      danger: options.danger,
    });

    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown, true);
      closeDialog(backdrop);
      resolve(value);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };

    confirmButton.addEventListener('click', () => finish(true));
    cancelButton.addEventListener('click', () => finish(false));
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) finish(false);
    });
    document.addEventListener('keydown', onKeyDown, true);
    requestAnimationFrame(() => cancelButton.focus());
  });
}

export function adminPrompt(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const { backdrop, dialog } = createDialogShell(options.eyebrow ?? '输入内容', options.title);
    if (options.message) {
      appendTextElement(dialog, 'p', options.message, 'admin-service-dialog-message');
    }

    const field = document.createElement('label');
    field.className = 'admin-service-dialog-field';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = options.initialValue ?? '';
    input.placeholder = options.placeholder ?? '';
    input.maxLength = options.maxLength ?? 120;
    input.autocomplete = 'off';
    field.append(input);
    dialog.append(field);

    const { confirmButton, cancelButton } = addActions(dialog, {
      confirmLabel: options.confirmLabel ?? '保存',
      cancelLabel: options.cancelLabel ?? '取消',
    });

    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown, true);
      closeDialog(backdrop);
      resolve(value);
    };
    const submit = () => {
      const value = input.value.trim();
      if (!value) {
        input.focus();
        input.setAttribute('aria-invalid', 'true');
        return;
      }
      finish(value);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      } else if (event.key === 'Enter' && event.target === input) {
        event.preventDefault();
        submit();
      }
    };

    confirmButton.addEventListener('click', submit);
    cancelButton.addEventListener('click', () => finish(null));
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) finish(null);
    });
    document.addEventListener('keydown', onKeyDown, true);
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}
