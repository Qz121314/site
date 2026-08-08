import type { FormEvent } from 'react';
import type {
  AdminConversionGroup,
  ConversionGroupInput,
  ConversionMode,
} from './api';

type Props = {
  sectionName: string;
  editingGroup: AdminConversionGroup | null;
  form: ConversionGroupInput;
  saving: boolean;
  errorMessage: string;
  onFormChange: (form: ConversionGroupInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const modeOptions: Array<{ value: ConversionMode; title: string; description: string }> = [
  {
    value: 'customer_service',
    title: '在线客服分组',
    description: '线下服务 CTA 从多个客服入口中轮换。',
  },
  {
    value: 'link',
    title: '链接分组',
    description: '线上服务 CTA 从多个外部链接中轮换。',
  },
];

export function ConversionGroupEditorDialog({
  sectionName,
  editingGroup,
  form,
  saving,
  errorMessage,
  onFormChange,
  onClose,
  onSubmit,
}: Props) {
  const modeLocked = Boolean(editingGroup && editingGroup.targetCount > 0);

  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog conversion-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-group-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{sectionName} · 转化池</p>
            <h3 id="conversion-group-editor-title">
              {editingGroup ? '编辑转化分组' : '新增转化分组'}
            </h3>
          </div>
          <button type="button" aria-label="关闭" disabled={saving} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="conversion-editor-form" onSubmit={onSubmit}>
          {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}

          <label>
            <span>分组名称</span>
            <input
              type="text"
              value={form.name}
              autoFocus
              required
              maxLength={100}
              placeholder="例如：默认客服组"
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            />
            <small>仅在后台显示，用于产品录入时识别。</small>
          </label>

          <fieldset>
            <legend>分组类型</legend>
            <div className="conversion-mode-options">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={form.mode === option.value ? 'is-selected' : undefined}
                  aria-pressed={form.mode === option.value}
                  disabled={saving || modeLocked}
                  onClick={() => onFormChange({ ...form, mode: option.value })}
                >
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
            {editingGroup && editingGroup.targetCount > 0 ? (
              <small>分组已有入口时不能修改类型。</small>
            ) : null}
          </fieldset>

          <label>
            <span>CTA 按钮文字</span>
            <input
              type="text"
              value={form.buttonLabel}
              required
              maxLength={80}
              placeholder={form.mode === 'link' ? '例如：Book Now' : '例如：Contact Us'}
              onChange={(event) => onFormChange({ ...form, buttonLabel: event.target.value })}
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
              <strong>启用分组</strong>
              <small>没有可用入口时，即使启用也不能进行轮换。</small>
            </span>
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => onFormChange({ ...form, isEnabled: event.target.checked })}
            />
          </label>

          <div className="admin-dialog-actions">
            <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>
              取消
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? '正在保存…' : '保存分组'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
