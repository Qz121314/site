import type { FormEvent } from 'react';
import type { AdminCategory, CategoryInput } from './api';

type CategoryEditorDialogProps = {
  sectionName: string;
  editingCategory: AdminCategory | null;
  form: CategoryInput;
  saving: boolean;
  onFormChange: (form: CategoryInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CategoryEditorDialog({
  sectionName,
  editingCategory,
  form,
  saving,
  onFormChange,
  onClose,
  onSubmit,
}: CategoryEditorDialogProps) {
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog category-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{sectionName}</p>
            <h3 id="category-editor-title">{editingCategory ? '编辑分类' : '新增分类'}</h3>
          </div>
          <button type="button" aria-label="关闭" disabled={saving} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="section-editor-form" onSubmit={onSubmit}>
          <label>
            <span>分类名称</span>
            <input
              type="text"
              value={form.name}
              autoFocus
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            />
            <small>分类只属于当前分区，不会出现在其他分区中。</small>
          </label>

          <label>
            <span>排序</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.sortOrder}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  sortOrder: Number.isFinite(event.target.valueAsNumber)
                    ? event.target.valueAsNumber
                    : 0,
                })
              }
            />
          </label>

          <label className="switch-row">
            <span>
              <strong>启用分类</strong>
              <small>停用后不在用户前端筛选中显示。</small>
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
              {saving ? '正在保存…' : '保存分类'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
