import type { MediaUploadQueueItem } from './media-upload-queue';

type MediaUploadQueuePanelProps = {
  items: MediaUploadQueueItem[];
  running: boolean;
  progress: { done: number; failed: number; active: number; total: number };
  onRetryFailed: () => void;
  onClearFinished: () => void;
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(item: MediaUploadQueueItem): string {
  switch (item.status) {
    case 'queued':
      return '等待';
    case 'processing':
      return item.file.type.startsWith('image/') && item.file.type !== 'image/gif'
        ? '压缩 / 上传中'
        : '上传中';
    case 'uploaded':
      return '完成';
    case 'reused':
      return '已复用';
    case 'error':
      return '失败';
  }
}

export function MediaUploadQueuePanel({
  items,
  running,
  progress,
  onRetryFailed,
  onClearFinished,
}: MediaUploadQueuePanelProps) {
  if (items.length === 0) return null;

  return (
    <section className="media-upload-queue" aria-live="polite">
      <div className="media-upload-queue-header">
        <div>
          <strong>上传队列</strong>
          <span>
            {progress.done} / {progress.total}
            {progress.active > 0 ? ` · ${progress.active} 个处理中` : ''}
            {progress.failed > 0 ? ` · ${progress.failed} 个失败` : ''}
          </span>
        </div>
        <div>
          {progress.failed > 0 ? (
            <button type="button" className="secondary-button" disabled={running} onClick={onRetryFailed}>
              重试失败项
            </button>
          ) : null}
          <button type="button" className="secondary-button" disabled={running} onClick={onClearFinished}>
            清理已完成
          </button>
        </div>
      </div>
      <div className="media-upload-queue-list">
        {items.map((item) => (
          <div className={`media-upload-queue-row is-${item.status}`} key={item.id}>
            <span className="media-upload-queue-state" aria-hidden="true" />
            <div>
              <strong title={item.fileName}>{item.fileName}</strong>
              <small>{formatBytes(item.byteSize)}{item.message ? ` · ${item.message}` : ''}</small>
            </div>
            <b>{statusLabel(item)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}
