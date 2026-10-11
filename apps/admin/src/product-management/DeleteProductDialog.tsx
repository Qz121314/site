import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';

type DeleteProductDialogProps = {
  reviewMode?: boolean;
  count: number;
  mode: 'recycle' | 'permanent' | 'empty';
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteProductDialog({
  reviewMode = false,
  count,
  mode,
  working,
  onCancel,
  onConfirm,
}: DeleteProductDialogProps) {
  return (
    <AdminDialog
      open
      title={
        mode === 'recycle'
          ? `将 ${count} 个${reviewMode ? 'Review 页面' : '产品'}移入回收站？`
          : mode === 'empty'
            ? `清空回收站中的 ${count} 个${reviewMode ? 'Review 页面' : '产品'}？`
            : `永久删除 ${count} 个${reviewMode ? 'Review 页面' : '产品'}？`
      }
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
            {mode === 'recycle'
              ? '移入回收站'
              : mode === 'empty'
                ? '清空回收站'
                : '永久删除'}
          </Button>
        </>
      }
    >
      <p>
        {mode === 'recycle'
          ? '可在回收站中恢复。关联分类和素材会继续保留。'
          : mode === 'empty'
            ? '回收站中的商品正文及关联关系会被永久删除，图片仍保留在素材库和 R2 中。'
            : reviewMode
              ? '删除后将移除页面内容，无法恢复。'
              : '商品正文及关联关系会被永久删除，图片仍保留在素材库和 R2 中。'}
      </p>
    </AdminDialog>
  );
}
