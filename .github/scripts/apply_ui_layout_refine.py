from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, value: str) -> None:
    (ROOT / path).write_text(value, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    source = read(path)
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    write(path, source.replace(old, new, 1))


# Keyboard/backdrop behavior for a compact admin editor.
replace_once(
    'apps/admin/src/CustomerServiceView.tsx',
    """  useEffect(() => {
    setSelectedIds(new Set());
    setSearch('');
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  const source""",
    """  useEffect(() => {
    setSelectedIds(new Set());
    setSearch('');
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  useEffect(() => {
    if (!editorOpen || saving) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditorOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [editorOpen, saving]);

  const source""",
)

replace_once(
    'apps/admin/src/CustomerServiceView.tsx',
    """      {editorOpen ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog customer-service-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-service-editor-title"
          >""",
    """      {editorOpen ? (
        <div
          className="admin-dialog-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!saving) setEditorOpen(false);
          }}
        >
          <section
            className="admin-dialog customer-service-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-service-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >""",
)

# Replace stale selectors with the classes actually emitted by CustomerServiceView.
write(
    'apps/admin/src/customer-service-connections.css',
    """/* Customer service connections use the same dense, low-friction workbench as other admin data pages. */

.customer-service-workbench {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
}

.customer-service-commandbar {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  min-height: 46px;
  align-items: center;
  gap: 10px;
  padding: 6px 7px;
  border: 1px solid var(--admin-border, #e2e6ec);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(16 24 40 / 3%);
}

.customer-service-commandbar .segmented-control {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--admin-border, #e2e6ec);
  border-radius: 8px;
  background: #f1f3f6;
}

.customer-service-commandbar .segmented-control button {
  appearance: none;
  min-height: 31px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  color: #667085;
  background: transparent;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 720;
  line-height: 1;
  transition:
    color 140ms ease,
    background 140ms ease,
    box-shadow 140ms ease;
}

.customer-service-commandbar .segmented-control button:not(.is-active):hover {
  color: #344054;
  background: rgb(255 255 255 / 72%);
}

.customer-service-commandbar .segmented-control button.is-active {
  color: #fff;
  background: #202632;
  box-shadow: 0 1px 3px rgb(16 24 40 / 18%);
}

.customer-service-toolbar-actions {
  display: grid;
  grid-template-columns: minmax(220px, 420px) max-content;
  justify-content: end;
  gap: 8px;
}

.customer-service-search {
  display: block;
  min-width: 0;
}

.customer-service-search input {
  width: 100%;
  min-height: 34px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid var(--admin-border-strong, #cfd5df);
  border-radius: 7px;
  background: #fff;
  color: var(--admin-text, #172033);
  outline: 0;
  font-size: 0.77rem;
}

.customer-service-search input:focus {
  border-color: #ff9a76;
  box-shadow: 0 0 0 3px rgb(255 90 31 / 10%);
}

.customer-service-workbench .selection-toolbar {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 5px 7px;
  border: 1px solid #f1d5cf;
  border-radius: 9px;
  background: #fff8f6;
}

.customer-service-workbench .selection-toolbar span {
  margin-right: auto;
  color: #667085;
  font-size: 0.74rem;
  font-weight: 650;
}

.customer-service-table-wrap {
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--admin-border, #e2e6ec);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px rgb(16 24 40 / 3%);
  overscroll-behavior: contain;
}

.customer-service-table {
  width: 100%;
  min-width: 880px;
  border-collapse: collapse;
}

.customer-service-table th,
.customer-service-table td {
  padding: 8px 10px;
  vertical-align: middle;
  border-bottom: 1px solid #edf0f4;
}

.customer-service-table th {
  position: sticky;
  z-index: 1;
  top: 0;
  height: 36px;
  color: #667085;
  background: #f8f9fb;
  text-align: left;
  font-size: 0.65rem;
  font-weight: 760;
  letter-spacing: 0.02em;
}

.customer-service-table td {
  min-height: 46px;
  color: #475467;
  font-size: 0.76rem;
}

.customer-service-table td > strong {
  color: #273244;
  font-weight: 720;
}

.customer-service-table tbody tr:hover td {
  background: #fafbfc;
}

.customer-service-table tbody tr:has(input[type='checkbox']:checked) td {
  background: #fffaf7;
}

.customer-service-table tbody tr:only-child td[colspan] {
  height: 118px;
  padding: 24px;
  color: #667085;
  background: #fff;
  text-align: center;
  font-size: 0.76rem;
  font-weight: 650;
}

.customer-service-table .selection-column {
  width: 38px;
  text-align: center;
}

.customer-service-table .actions-column {
  width: 178px;
  text-align: right;
  white-space: nowrap;
}

.customer-service-table code {
  display: block;
  max-width: 320px;
  overflow: hidden;
  color: #475467;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-service-table .table-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.customer-service-table .table-action {
  appearance: none;
  min-height: 28px;
  padding: 3px 8px;
  border: 1px solid #dfe4eb;
  border-radius: 6px;
  color: #475467;
  background: #fff;
  box-shadow: 0 1px 1px rgb(16 24 40 / 3%);
  cursor: pointer;
  font-size: 0.69rem;
  font-weight: 700;
  transition:
    color 120ms ease,
    border-color 120ms ease,
    background 120ms ease;
}

.customer-service-table .table-action:not(:disabled):hover {
  border-color: #c7ced8;
  color: #172033;
  background: #f8fafc;
}

.customer-service-table .table-action.is-danger {
  border-color: transparent;
  color: #b42318;
  background: transparent;
  box-shadow: none;
}

.customer-service-table .table-action.is-danger:not(:disabled):hover {
  border-color: #fecdca;
  color: #912018;
  background: #fff1f0;
}

.customer-service-table .table-action:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.customer-service-editor {
  width: min(620px, calc(100vw - 32px));
}

.customer-service-editor-form {
  display: grid;
  gap: 13px;
}

.customer-service-editor-form > label {
  display: grid;
  gap: 5px;
}

.customer-service-editor-form label > span:not(.sr-only) {
  color: #344054;
  font-size: 0.73rem;
  font-weight: 700;
}

.customer-service-editor-form label > small {
  color: #98a2b3;
  font-size: 0.69rem;
  line-height: 1.45;
}

.customer-service-editor-form input[type='text'],
.customer-service-editor-form input[type='url'],
.customer-service-editor-form input[type='password'] {
  box-sizing: border-box;
  width: 100%;
  min-height: 38px;
  padding-inline: 10px;
  border: 1px solid var(--admin-border-strong, #cfd5df);
  border-radius: 8px;
  background: #fff;
  color: var(--admin-text, #172033);
  outline: 0;
  font-size: 0.8rem;
}

.customer-service-editor-form input:is([type='text'], [type='url'], [type='password']):focus {
  border-color: #ff9a76;
  box-shadow: 0 0 0 3px rgb(255 90 31 / 10%);
}

.customer-service-editor-form .switch-row {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 11px;
  border: 1px solid #e5e9ef;
  border-radius: 8px;
  background: #f9fafb;
}

.customer-service-editor-form .switch-row > span {
  display: grid;
  gap: 2px;
}

.customer-service-editor-form .switch-row strong {
  color: #344054;
  font-size: 0.74rem;
}

.customer-service-editor-form .switch-row small {
  color: #98a2b3;
  font-size: 0.68rem;
  font-weight: 500;
}

.customer-service-editor-form .admin-dialog-actions {
  position: sticky;
  bottom: -16px;
  z-index: 2;
  margin: 2px -16px -16px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #edf0f4;
  background: rgb(255 255 255 / 96%);
  backdrop-filter: blur(10px);
}

@media (min-width: 1024px) {
  .customer-service-workbench {
    width: min(1180px, 100%);
    margin-inline: auto;
    overflow: hidden;
  }

  .customer-service-table-wrap {
    max-height: calc(100dvh - 150px);
  }
}

@media (max-width: 900px) {
  .customer-service-commandbar {
    grid-template-columns: 1fr;
  }

  .customer-service-toolbar-actions {
    grid-template-columns: minmax(0, 1fr) max-content;
    justify-content: stretch;
  }

  .customer-service-table {
    min-width: 820px;
  }
}

@media (max-width: 620px) {
  .customer-service-toolbar-actions {
    grid-template-columns: 1fr;
  }

  .customer-service-commandbar .segmented-control,
  .customer-service-commandbar .segmented-control button,
  .customer-service-toolbar-actions .primary-button {
    width: 100%;
  }

  .customer-service-commandbar .segmented-control button {
    flex: 1 1 0;
  }

  .customer-service-editor {
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 16px);
  }
}
""",
)

# A restrained desktop pass keeps the storefront content centered and prevents
# recommendation rails from stretching into oversized cards on wide screens.
home = read('apps/storefront/src/home-feed.css')
home += """

@media (min-width: 1180px) {
  .home-shortcut-zone {
    padding-inline: 2px;
  }

  .home-product-rail {
    grid-auto-columns: minmax(184px, 208px);
    gap: 16px;
  }

  .home-recommendation-feed {
    gap: 48px;
    padding-bottom: 56px;
  }
}
"""
write('apps/storefront/src/home-feed.css', home)

write(
    'apps/admin/test/customer-service-layout-contract.test.mjs',
    """import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('customer service admin stylesheet matches rendered workbench classes', () => {
  const view = source('../src/CustomerServiceView.tsx');
  const css = source('../src/customer-service-connections.css');

  assert.ok(css.includes('.customer-service-toolbar-actions'));
  assert.ok(css.includes('.customer-service-search input'));
  assert.ok(css.includes('.selection-column'));
  assert.ok(css.includes('.actions-column'));
  assert.ok(css.includes('.table-actions'));
  assert.ok(css.includes('.table-action.is-danger'));
  assert.ok(!css.includes('.selection-cell'));
  assert.ok(!css.includes('.row-actions'));
  assert.ok(view.includes("event.key === 'Escape'"));
  assert.ok(view.includes('onMouseDown={(event) => event.stopPropagation()}'));
});
""",
)

print('Site UI layout refinement applied.')
