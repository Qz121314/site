type DeleteProductDialogProps = {
  count: number;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteProductDialog({
  count,
  working,
  onCancel,
  onConfirm,
}: DeleteProductDialogProps) {
  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog product-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-delete-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>删除确认</p>
            <h3 id="product-delete-title">将 {count} 个产品移入回收站？</h3>
          </div>
        </div>
        <p>
          产品图片不会立即从 R2 删除，仍会受到引用保护。恢复产品后会自动恢复为草稿状态。
        </p>
        <div className="admin-dialog-actions">
          <button type="button" disabled={working} onClick={onCancel}>
            取消
          </button>
          <button
            className="danger-button"
            type="button"
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
