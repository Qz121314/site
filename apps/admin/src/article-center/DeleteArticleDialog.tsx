import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';

type DeleteArticleDialogProps = {
  titles: string[];
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteArticleDialog({
  titles,
  working,
  onCancel,
  onConfirm,
}: DeleteArticleDialogProps) {
  const singleTitle = titles.length === 1 ? titles[0] : null;
  return (
    <AdminDialog
      open
      title="删除文章"
      eyebrow="删除确认"
      description={
        singleTitle
          ? `确定删除《${singleTitle}》吗？`
          : `确定删除已选择的 ${titles.length} 篇文章吗？`
      }
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
      <p className="delete-warning">删除后文章进入回收站；现有 backend 删除语义保持不变。</p>
    </AdminDialog>
  );
}
