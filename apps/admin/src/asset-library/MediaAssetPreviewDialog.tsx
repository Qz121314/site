import { adminMediaOriginalUrl } from '../branding-media/api';
import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';
import type { ManagedMediaAsset } from './api';

type MediaAssetPreviewDialogProps = {
  asset: ManagedMediaAsset;
  onClose: () => void;
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaAssetPreviewDialog({
  asset,
  onClose,
}: MediaAssetPreviewDialogProps) {
  const source = asset.publicUrl ?? adminMediaOriginalUrl(asset.id);
  const dimensionLabel =
    asset.width && asset.height ? `${asset.width} × ${asset.height}` : '尺寸未知';

  return (
    <AdminDialog
      open
      title={asset.fileName}
      eyebrow="完整比例预览"
      description={`${dimensionLabel} · ${formatBytes(asset.byteSize)}${asset.folderName ? ` · ${asset.folderName}` : ' · 未分组'}`}
      onClose={onClose}
      size="large"
      className="media-preview-dialog"
      footer={
        asset.publicUrl ? (
          <Button
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(asset.publicUrl ?? '')}
          >
            复制原图链接
          </Button>
        ) : undefined
      }
    >
      <div className="media-preview-stage">
        {asset.mediaKind === 'video' ? (
          asset.publicUrl ? (
            <video src={asset.publicUrl} controls preload="metadata" playsInline />
          ) : (
            <p>当前没有可直接访问的视频地址。</p>
          )
        ) : (
          <img src={source} alt={asset.fileName} />
        )}
      </div>
    </AdminDialog>
  );
}
