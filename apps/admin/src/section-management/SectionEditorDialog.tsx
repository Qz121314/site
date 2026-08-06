import type { FormEvent } from 'react';
import type { AdminSection, SectionInput } from '../api';
import { sectionIconOptions } from './config';

type SectionEditorDialogProps = {
  editingSection: AdminSection | null;
  form: SectionInput;
  saving: boolean;
  onFormChange: (form: SectionInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SectionEditorDialog({
  editingSection,
  form,
  saving,
  onFormChange,
  onClose,
  onSubmit,
}: SectionEditorDialogProps) {
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="section-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{editingSection ? '修改现有分区' : '创建业务分区'}</p>
            <h3 id="section-editor-title">{editingSection ? '编辑分区' : '新增分区'}</h3>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="section-editor-form" onSubmit={onSubmit}>
          <label>
            <span>分区名称</span>
            <input
              type="text"
              value={form.name}
              placeholder="例如 Massage"
              autoFocus
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            />
            <small>请输入用户前端实际显示的 English 名称。</small>
          </label>

          <fieldset>
            <legend>分区图标</legend>
            <div className="icon-picker">
              {sectionIconOptions.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={form.iconValue === icon ? 'is-selected' : undefined}
                  aria-label={`选择图标 ${icon}`}
                  onClick={() => onFormChange({ ...form, iconValue: icon })}
                >
                  {icon}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            <span>排序</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.sortOrder}
              onChange={(event) =>
                onFormChange({ ...form, sortOrder: Number(event.target.value) })
              }
            />
            <small>数字越小越靠前，也可以在列表中使用上下移动。</small>
          </label>

          <label className="switch-row">
            <span>
              <strong>是否启用</strong>
              <small>停用后不进入用户前端发布内容。</small>
            </span>
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => onFormChange({ ...form, isEnabled: event.target.checked })}
            />
          </label>

          <div className="admin-dialog-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? '正在保存…' : editingSection ? '保存修改' : '创建分区'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
