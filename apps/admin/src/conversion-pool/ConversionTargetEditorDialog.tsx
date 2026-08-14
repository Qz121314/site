import type { FormEvent } from 'react';
import type {
  AdminConversionGroup,
  AdminConversionTarget,
  ConversionTargetInput,
} from './api';

type Props = {
  group: AdminConversionGroup;
  editingTarget: AdminConversionTarget | null;
  form: ConversionTargetInput;
  saving: boolean;
  errorMessage: string;
  onFormChange: (form: ConversionTargetInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ConversionTargetEditorDialog({
  group,
  editingTarget,
  form,
  saving,
  errorMessage,
  onFormChange,
  onClose,
  onSubmit,
}: Props) {
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog conversion-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-target-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{group.name}</p>
            <h3 id="conversion-target-editor-title">
              {editingTarget ? '编辑链接' : '新增链接'}
            </h3>
          </div>
          <button type="button" aria-label="关闭" disabled={saving} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="conversion-editor-form" onSubmit={onSubmit}>
          {errorMessage ? (
            <div className="notice notice-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <label>
            <span>链接名称</span>
            <input
              type="text"
              value={form.name}
              autoFocus
              required
              maxLength={100}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            />
          </label>

          <label>
            <span>跳转链接</span>
            <input
              type="url"
              value={form.endpointUrl ?? ''}
              required
              maxLength={1000}
              placeholder="https://"
              onChange={(event) =>
                onFormChange({ ...form, endpointUrl: event.target.value || null })
              }
            />
          </label>

          <label>
            <span>排序</span>
            <input
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              required
              value={form.sortOrder}
              onChange={(event) =>
                onFormChange({ ...form, sortOrder: Number(event.target.value) })
              }
            />
          </label>

          <label className="switch-row">
            <span>
              <strong>启用链接</strong>
            </span>
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) =>
                onFormChange({ ...form, isEnabled: event.target.checked })
              }
            />
          </label>

          <div className="admin-dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={onClose}
            >
              取消
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? '正在保存…' : '保存链接'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
