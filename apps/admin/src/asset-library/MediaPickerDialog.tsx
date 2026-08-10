import { useEffect, useMemo, useState } from 'react';
import { AdminApiError } from '../api';
import { brandingAssetPreviewUrl } from '../branding-media/api';
import {
  fetchMediaLibrary,
  type ManagedMediaAsset,
  type MediaKind,
  type MediaRole,
} from './api';
import { assignMediaRole } from './media-role-api';

type MediaPickerDialogProps = {
  title: string;
  role: MediaRole;
  allowedKinds: MediaKind[];
  selectedIds?: string[];
  onSelect: (asset: ManagedMediaAsset) => void;
  onClose: () => void;
  onSessionExpired: () => void;
};

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(kind: MediaKind): string {
  if (kind === 'video') return '视频';
  if (kind === 'animated_image') return 'GIF';
  return '图片';
}

export function MediaPickerDialog({
  title,
  role,
  allowedKinds,
  selectedIds = [],
  onSelect,
  onClose,
  onSessionExpired,
}: MediaPickerDialogProps) {
  const [assets, setAssets] = useState<ManagedMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const result = await fetchMediaLibrary();
        if (active) setAssets(result);
      } catch (error) {
        if (!active) return;
        if (isSessionError(error)) {
          onSessionExpired();
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : '素材列表加载失败。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [onSessionExpired]);

  const filtered = useMemo(() => {
    const allowed = new Set(allowedKinds);
    const selected = new Set(selectedIds);
    const keyword = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (!allowed.has(asset.mediaKind) || selected.has(asset.id)) return false;
      if (!keyword) return true;
      return `${asset.fileName} ${asset.mimeType} ${asset.roles.join(' ')}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [allowedKinds, assets, query, selectedIds]);

  async function choose(asset: ManagedMediaAsset) {
    if (workingId) return;
    setWorkingId(asset.id);
    setErrorMessage('');
    try {
      if (!asset.roles.includes(role)) await assignMediaRole(asset.id, role);
      onSelect({
        ...asset,
        roles: asset.roles.includes(role) ? asset.roles : [...asset.roles, role],
      });
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '选择素材失败。');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="admin-dialog-backdrop media-picker-backdrop" role="presentation">
      <section
        className="admin-dialog media-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>全站素材中心</p>
            <h3 id="media-picker-title">{title}</h3>
          </div>
          <button
            type="button"
            aria-label="关闭"
            disabled={workingId !== null}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="media-picker-body">
          <input
            className="media-picker-search"
            type="search"
            value={query}
            autoFocus
            placeholder="搜索文件名或格式"
            onChange={(event) => setQuery(event.target.value)}
          />
          {errorMessage ? (
            <div className="notice notice-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="media-picker-empty">正在读取素材…</div>
          ) : filtered.length > 0 ? (
            <div className="media-picker-grid">
              {filtered.map((asset) => (
                <button
                  className="media-picker-card"
                  type="button"
                  key={asset.id}
                  disabled={workingId !== null}
                  onClick={() => void choose(asset)}
                >
                  <span className="media-picker-preview">
                    {asset.mediaKind === 'video' ? (
                      asset.publicUrl ? (
                        <video
                          src={asset.publicUrl}
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <i>视频</i>
                      )
                    ) : (
                      <img
                        src={brandingAssetPreviewUrl(asset.id)}
                        alt=""
                        loading="lazy"
                      />
                    )}
                    <b>{kindLabel(asset.mediaKind)}</b>
                  </span>
                  <span className="media-picker-copy">
                    <strong title={asset.fileName}>{asset.fileName}</strong>
                    <small>
                      {asset.width && asset.height
                        ? `${asset.width} × ${asset.height} · `
                        : ''}
                      {formatBytes(asset.byteSize)}
                    </small>
                    <em>{workingId === asset.id ? '正在选择…' : '使用此素材'}</em>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="media-picker-empty">
              <strong>没有可选素材</strong>
              <p>请先到素材中心上传对应格式的素材。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
