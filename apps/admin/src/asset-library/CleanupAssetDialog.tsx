type CleanupAssetDialogProps = {
  count: number;
  totalBytesLabel: string;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CleanupAssetDialog({
  count,
  totalBytesLabel,
  working,
  onCancel,
  onConfirm,
}: CleanupAssetDialogProps) {
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog admin-dialog-small"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="asset-cleanup-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>R2 永久删除确认</p>
            <h3 id="asset-cleanup-title">清理 {count} 个未使用图片？</h3>
          </div>
        </div>
        <p className="delete-warning">
          本次预计释放 {totalBytesLabel}。R2 删除不可恢复，提交前系统会再次检查 D1 引用和对象保护期。
        </p>
        <div className="admin-dialog-actions">
          <button type="button" className="secondary-button" disabled={working} onClick={onCancel}>
            取消
          </button>
          <button type="button" className="danger-button" disabled={working} onClick={onConfirm}>
            {working ? '正在清理…' : '确认永久清理'}
          </button>
        </div>
      </section>
    </div>
  );
}
