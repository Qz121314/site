import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';

type DeleteProductDialogProps = {
  reviewMode?: boolean;
  count: number;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteProductDialog({
  reviewMode = false,
  count,
  working,
  onCancel,
  onConfirm,
}: DeleteProductDialogProps) {
  return (
    <AdminDialog
      open
      title={`将 ${count} 个${reviewMode ? 'Review 页面' : '产品'}移入回收站？`}
      eyebrow="删除确认"
      role="alertdialog"
      size="small"
      closeDisabled={working}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" disabled={working} onClick={onCancel}>
            取消
          </Button>
          <Button variant="danger" loading={working} onClick={onConfirm}>
            确认删除
          </Button>
        </>
      }
    >
      <p>
        {reviewMode
          ? '恢复 Review 页面后会自动恢复为草稿状态。'
          : '产品图片不会立即从 R2 删除，仍会受到引用保护。恢复产品后会自动恢复为草稿状态。'}
      </p>
    </AdminDialog>
  );
}
