import { useEffect } from 'react';
import { adminMediaOriginalUrl } from '../branding-media/api';
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

export function MediaAssetPreviewDialog({ asset, onClose }: MediaAssetPreviewDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const source = asset.publicUrl ?? adminMediaOriginalUrl(asset.id);
  const dimensionLabel =
    asset.width && asset.height ? `${asset.width} × ${asset.height}` : '尺寸未知';

  return (
    <div
      className="media-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="media-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-preview-title"
      >
        <header>
          <div>
            <strong id="media-preview-title">{asset.fileName}</strong>
            <span>
              {dimensionLabel} · {formatBytes(asset.byteSize)}
              {asset.folderName ? ` · ${asset.folderName}` : ' · 未分组'}
            </span>
          </div>
          <button type="button" aria-label="关闭原图预览" onClick={onClose}>
            ×
          </button>
        </header>

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

        <footer>
          <span>完整比例预览</span>
          {asset.publicUrl ? (
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(asset.publicUrl ?? '')}
            >
              复制原图链接
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
