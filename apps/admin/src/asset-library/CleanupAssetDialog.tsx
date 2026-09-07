import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';

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
    <AdminDialog
      open
      title={`永久删除 ${count} 张未使用图片？`}
      eyebrow="R2 物理删除确认"
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
            确认永久删除
          </Button>
        </>
      }
    >
      <p className="delete-warning">
        本次预计释放 {totalBytesLabel}。提交时系统会再次检查 D1 引用；确认后图片将从 R2
        物理删除，无法恢复。
      </p>
    </AdminDialog>
  );
}
