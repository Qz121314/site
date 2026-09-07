import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';

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
    <AdminDialog
      open
      title={`删除 ${count} 个分区？`}
      eyebrow="软删除确认"
      description="分区将进入回收站并自动停用。存在关联产品或转化方式的分区不会被删除。"
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
      <p className="delete-warning">现有依赖保护、分区 ID 和动态 Catalog routing 不变。</p>
    </AdminDialog>
  );
}
