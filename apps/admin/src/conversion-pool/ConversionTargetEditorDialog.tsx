import type { FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';
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
    <AdminDialog
      open
      title={editingTarget ? '编辑链接' : '新增链接'}
      eyebrow={group.name}
      onClose={onClose}
      closeDisabled={saving}
      size="small"
    >
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
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            保存链接
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
