type DeleteCategoryDialogProps = {
  count: number;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteCategoryDialog({
  count,
  working,
  onCancel,
  onConfirm,
}: DeleteCategoryDialogProps) {
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog admin-dialog-small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-category-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>删除确认</p>
            <h3 id="delete-category-title">删除 {count} 个分类？</h3>
          </div>
          <button type="button" aria-label="关闭" disabled={working} onClick={onCancel}>
            ×
          </button>
        </div>

        <p className="delete-warning">
          删除后分类进入当前分区的回收站。仍被产品引用的分类不能删除，系统会阻止整个操作。
        </p>

        <div className="admin-dialog-actions">
          <button className="secondary-button" type="button" disabled={working} onClick={onCancel}>
            取消
          </button>
          <button className="danger-button" type="button" disabled={working} onClick={onConfirm}>
            {working ? '正在删除…' : '确认删除'}
          </button>
        </div>
      </section>
    </div>
  );
}
