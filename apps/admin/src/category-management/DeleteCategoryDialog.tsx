import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';

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
    <AdminDialog
      open
      title={`删除 ${count} 个分类？`}
      eyebrow="删除确认"
      description="删除后分类进入当前分区的回收站。仍被产品引用的分类不能删除，系统会阻止整个操作。"
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
      <p className="delete-warning">现有引用保护、软删除和回收站语义保持不变。</p>
    </AdminDialog>
  );
}
