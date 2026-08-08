import { useEffect, useMemo, useState } from 'react';
import { AdminApiError } from '../api';
import { brandingAssetPreviewUrl } from '../branding-media/api';
import {
  fetchMediaFolders,
  fetchMediaLibrary,
  type ManagedMediaAsset,
  type MediaFolder,
  type MediaKind,
  type MediaRole,
} from './api';
import { assignMediaRole } from './media-role-api';

type MediaLibraryPickerDialogProps = {
  title: string;
  role: MediaRole;
  allowedKinds: MediaKind[];
  selectedIds?: string[];
  maxSelections?: number;
  onSelect: (asset: ManagedMediaAsset) => void;
  onDone: () => void;
  onClose: () => void;
  onSessionExpired: () => void;
};

type FolderFilter = 'all' | 'unfiled' | string;

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
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

export function MediaLibraryPickerDialog({
  title,
  role,
  allowedKinds,
  selectedIds = [],
  maxSelections,
  onSelect,
  onDone,
  onClose,
  onSessionExpired,
}: MediaLibraryPickerDialogProps) {
  const [assets, setAssets] = useState<ManagedMediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [kindFilter, setKindFilter] = useState<MediaKind | 'all'>('all');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const [nextAssets, nextFolders] = await Promise.all([
          fetchMediaLibrary(),
          fetchMediaFolders(),
        ]);
        if (!active) return;
        setAssets(nextAssets);
        setFolders(nextFolders);
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

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = useMemo(() => {
    const allowed = new Set(allowedKinds);
    const keyword = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (!allowed.has(asset.mediaKind)) return false;
      if (kindFilter !== 'all' && asset.mediaKind !== kindFilter) return false;
      if (folderFilter === 'unfiled' && asset.folderId !== null) return false;
      if (folderFilter !== 'all' && folderFilter !== 'unfiled' && asset.folderId !== folderFilter) return false;
      if (!keyword) return true;
      return `${asset.fileName} ${asset.mimeType} ${asset.folderName ?? ''}`.toLowerCase().includes(keyword);
    });
  }, [allowedKinds, assets, folderFilter, kindFilter, query]);

  const selectionLimitReached = maxSelections !== undefined && selectedIds.length >= maxSelections;

  async function choose(asset: ManagedMediaAsset) {
    if (workingId || selected.has(asset.id) || selectionLimitReached) return;
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
      <section className="admin-dialog media-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="media-library-picker-title">
        <div className="admin-dialog-header">
          <div>
            <p>素材中心</p>
            <h3 id="media-library-picker-title">{title}</h3>
          </div>
          <button type="button" aria-label="关闭" disabled={workingId !== null} onClick={onClose}>×</button>
        </div>

        <div className="media-picker-body">
          <div className="media-picker-filters">
            <input
              className="media-picker-search"
              type="search"
              value={query}
              autoFocus
              placeholder="搜索文件名、文件夹或格式"
              onChange={(event) => setQuery(event.target.value)}
            />
            <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} aria-label="素材文件夹">
              <option value="all">全部文件夹</option>
              <option value="unfiled">未分组</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name} ({folder.assetCount})</option>
              ))}
            </select>
            {allowedKinds.length > 1 ? (
              <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as MediaKind | 'all')} aria-label="素材类型">
                <option value="all">全部格式</option>
                {allowedKinds.includes('image') ? <option value="image">图片</option> : null}
                {allowedKinds.includes('animated_image') ? <option value="animated_image">GIF</option> : null}
                {allowedKinds.includes('video') ? <option value="video">视频</option> : null}
              </select>
            ) : null}
          </div>

          <div className="media-picker-selection-status">
            <span>已选择 {selectedIds.length}{maxSelections !== undefined ? ` / ${maxSelections}` : ''}</span>
            {selectionLimitReached ? <strong>已达到选择上限</strong> : <small>先看缩略图，再点击素材加入产品</small>}
          </div>

          {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}

          {loading ? (
            <div className="media-picker-empty">正在读取素材…</div>
          ) : filtered.length > 0 ? (
            <div className="media-picker-grid">
              {filtered.map((asset) => {
                const isSelected = selected.has(asset.id);
                return (
                  <button
                    className={`media-picker-card${isSelected ? ' is-selected' : ''}`}
                    type="button"
                    key={asset.id}
                    disabled={workingId !== null || isSelected || selectionLimitReached}
                    onClick={() => void choose(asset)}
                  >
                    <span className="media-picker-preview">
                      {asset.mediaKind === 'video' ? (
                        asset.publicUrl ? <video src={asset.publicUrl} muted playsInline preload="metadata" /> : <i>视频</i>
                      ) : (
                        <img src={brandingAssetPreviewUrl(asset.id)} alt="" loading="lazy" />
                      )}
                      <b>{kindLabel(asset.mediaKind)}</b>
                      {isSelected ? <em className="media-picker-selected-mark">✓</em> : null}
                    </span>
                    <span className="media-picker-copy">
                      <strong title={asset.fileName}>{asset.fileName}</strong>
                      <small>{asset.folderName ? `${asset.folderName} · ` : '未分组 · '}{asset.width && asset.height ? `${asset.width} × ${asset.height} · ` : ''}{formatBytes(asset.byteSize)}</small>
                      <em>{isSelected ? '已选择' : workingId === asset.id ? '正在选择…' : '选择此素材'}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="media-picker-empty">
              <strong>没有匹配的素材</strong>
              <p>请先到素材中心上传素材，或调整文件夹和格式筛选。</p>
            </div>
          )}
        </div>

        <div className="media-picker-footer">
          <span>{filtered.length} 个当前结果</span>
          <button type="button" className="primary-button" disabled={workingId !== null} onClick={onDone}>完成选择</button>
        </div>
      </section>
    </div>
  );
}
