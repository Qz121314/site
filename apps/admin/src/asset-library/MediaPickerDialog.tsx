import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminApiError } from '../api';
import { brandingAssetPreviewUrl } from '../branding-media/api';
import { AdminDialog } from '../components/ui/dialog';
import { AdminFeedbackState } from '../components/ui/feedback-state';
import {
  fetchMediaFolders,
  fetchMediaLibrary,
  type ManagedMediaAsset,
  type MediaKind,
  type MediaFolder,
  type MediaRole,
} from './api';
import { assignMediaRole } from './media-role-api';
import { prepareMediaPickerSelection } from './media-picker-selection';

type MediaPickerBaseProps = {
  title: string;
  allowedKinds: MediaKind[];
  selectedIds?: string[];
  currentAssetId?: string | null;
  onSelect: (asset: ManagedMediaAsset) => void;
  onClose: () => void;
  onSessionExpired: () => void;
};

type RoleAssignmentMediaPickerProps = MediaPickerBaseProps & {
  selectionMode?: 'assign-role';
  role: MediaRole;
};

type ReferenceOnlyMediaPickerProps = MediaPickerBaseProps & {
  selectionMode: 'reference-only';
  role?: never;
};

type MediaPickerDialogProps =
  RoleAssignmentMediaPickerProps | ReferenceOnlyMediaPickerProps;

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

type FolderFilter = 'all' | 'unfiled' | string;

export function MediaPickerDialog(props: MediaPickerDialogProps) {
  const {
    title,
    allowedKinds,
    selectedIds = [],
    currentAssetId = null,
    onSelect,
    onClose,
    onSessionExpired,
  } = props;
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

  useEffect(() => {
    let active = true;
    void fetchMediaFolders()
      .then((result) => {
        if (active) setFolders(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isSessionError(error)) {
          onSessionExpired();
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : '素材分组加载失败。');
      });
    return () => {
      active = false;
    };
  }, [onSessionExpired]);

  const filtered = useMemo(() => {
    const allowed = new Set(allowedKinds);
    const selected = new Set(selectedIds);
    const keyword = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (
        !allowed.has(asset.mediaKind) ||
        selected.has(asset.id) ||
        (kindFilter !== 'all' && asset.mediaKind !== kindFilter) ||
        (folderFilter === 'unfiled' && asset.folderId !== null) ||
        (folderFilter !== 'all' &&
          folderFilter !== 'unfiled' &&
          asset.folderId !== folderFilter)
      ) {
        return false;
      }
      if (!keyword) return true;
      return `${asset.fileName} ${asset.mimeType} ${asset.roles.join(' ')}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [allowedKinds, assets, folderFilter, kindFilter, query, selectedIds]);

  async function choose(asset: ManagedMediaAsset) {
    if (workingId) return;
    setWorkingId(asset.id);
    setErrorMessage('');
    try {
      const selectedAsset = await prepareMediaPickerSelection(
        asset,
        props.selectionMode === 'reference-only'
          ? { mode: 'reference-only' }
          : { mode: 'assign-role', role: props.role },
        assignMediaRole,
      );
      onSelect(selectedAsset);
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

  const dialog = (
    <AdminDialog
      open
      title={title}
      eyebrow="全站素材中心"
      onClose={onClose}
      closeDisabled={workingId !== null}
      size="large"
      className="media-picker-dialog"
    >
      <div className="media-picker-body">
        <div className="media-picker-filters">
          <input
            className="media-picker-search"
            type="search"
            value={query}
            autoFocus
            placeholder="搜索文件名或格式"
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            value={folderFilter}
            onChange={(event) => setFolderFilter(event.target.value)}
            aria-label="素材分组"
          >
            <option value="all">全部分组</option>
            <option value="unfiled">未分组</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name} ({folder.assetCount})
              </option>
            ))}
          </select>
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as MediaKind | 'all')}
            aria-label="素材格式"
          >
            <option value="all">全部格式</option>
            {allowedKinds.includes('image') ? <option value="image">图片</option> : null}
            {allowedKinds.includes('animated_image') ? (
              <option value="animated_image">GIF</option>
            ) : null}
            {allowedKinds.includes('video') ? <option value="video">视频</option> : null}
          </select>
        </div>
        {errorMessage ? (
          <AdminFeedbackState
            kind="error"
            title="素材列表不可用"
            description={errorMessage}
            compact
          />
        ) : null}

        {loading ? (
          <AdminFeedbackState kind="loading" title="正在读取素材" compact />
        ) : filtered.length > 0 ? (
          <div className="media-picker-grid">
            {filtered.map((asset) => {
              const isCurrent = currentAssetId === asset.id;
              return (
                <button
                  className={`media-picker-card${isCurrent ? ' is-selected' : ''}`}
                  type="button"
                  key={asset.id}
                  aria-pressed={isCurrent}
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
                    <em>
                      {workingId === asset.id
                        ? '正在选择…'
                        : isCurrent
                          ? '当前使用'
                          : '使用此素材'}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <AdminFeedbackState
            kind="empty"
            title="没有可选素材"
            description="请先到素材中心上传对应格式的素材。"
          />
        )}
      </div>
    </AdminDialog>
  );

  return createPortal(dialog, document.body);
}
