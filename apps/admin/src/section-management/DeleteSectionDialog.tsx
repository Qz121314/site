type DeleteSectionDialogProps = {
  count: number;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteSectionDialog({
  count,
  working,
  onCancel,
  onConfirm,
}: DeleteSectionDialogProps) {
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog admin-dialog-small"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>软删除确认</p>
            <h3 id="delete-title">删除 {count} 个分区？</h3>
          </div>
        </div>
        <p className="delete-warning">
          分区将进入回收站并自动停用。存在关联产品或转化方式的分区不会被删除。
        </p>
        <div className="admin-dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="danger-button"
            disabled={working}
            onClick={onConfirm}
          >
            {working ? '正在删除…' : '确认删除'}
          </button>
        </div>
      </section>
    </div>
  );
}
