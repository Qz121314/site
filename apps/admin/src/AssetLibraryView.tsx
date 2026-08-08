import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminApiError } from './api';
import { adminConfirm, adminPrompt } from './admin-dialog-service';
import { AssetTable } from './asset-library/AssetTable';
import { CleanupAssetDialog } from './asset-library/CleanupAssetDialog';
import { deleteMediaAssets } from './asset-library/media-delete-api';
import { fetchMediaLibraryPage } from './asset-library/media-library-page-api';
import { MediaUploadQueuePanel } from './asset-library/MediaUploadQueuePanel';
import { useMediaUploadQueue, type MediaUploadBatchSummary } from './asset-library/media-upload-queue';
import {
  cleanupAssets,
  createMediaFolder,
  deleteMediaFolder,
  fetchAssetPage,
  fetchMediaFolders,
  moveMediaAssets,
  renameMediaFolder,
  type AdminAsset,
  type ManagedMediaAsset,
  type MediaFolder,
  type MediaKind,
  type MediaRole,
} from './asset-library/api';

type AssetFilter = 'used' | 'unused';
type WorkbenchTab = 'library' | 'cleanup';
type FolderFilter = 'all' | 'unfiled' | string;

type AssetLibraryViewProps = {
  onSessionExpired: () => void;
};

const ROLE_OPTIONS: Array<{ value: MediaRole; label: string }> = [
  { value: 'general', label: '通用素材' },
  { value: 'product', label: '产品素材' },
  { value: 'logo', label: 'Logo' },
  { value: 'icon', label: '图标' },
  { value: 'favicon', label: 'Favicon' },
  { value: 'hero', label: 'Banner / Hero' },
  { value: 'background', label: '背景素材' },
  { value: 'content', label: '正文素材' },
];

const KIND_OPTIONS: Array<{ value: MediaKind | ''; label: string }> = [
  { value: '', label: '全部格式' },
  { value: 'image', label: '静态图片' },
  { value: 'animated_image', label: 'GIF / 动图' },
  { value: 'video', label: '视频' },
];

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(value: number | null): string | null {
  if (value === null) return null;
  const seconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function roleLabel(role: MediaRole): string {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role;
}

function kindLabel(kind: MediaKind): string {
  if (kind === 'video') return '视频';
  if (kind === 'animated_image') return 'GIF / 动图';
  return '图片';
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function mergeAssets(current: AdminAsset[], incoming: AdminAsset[]): AdminAsset[] {
  const byKey = new Map(current.map((asset) => [asset.key, asset]));
  incoming.forEach((asset) => byKey.set(asset.key, asset));
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function rootFolderName(files: File[]): string {
  const path = files.find((file) => file.webkitRelativePath)?.webkitRelativePath ?? '';
  const root = path.split('/').filter(Boolean)[0]?.trim();
  return root || '导入文件夹';
}

export function AssetLibraryView({ onSessionExpired }: AssetLibraryViewProps) {
  const [tab, setTab] = useState<WorkbenchTab>('library');

  const [managedAssets, setManagedAssets] = useState<ManagedMediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaLoadingMore, setMediaLoadingMore] = useState(false);
  const [mediaNextCursor, setMediaNextCursor] = useState<string | null>(null);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [mediaQuery, setMediaQuery] = useState('');
  const [debouncedMediaQuery, setDebouncedMediaQuery] = useState('');
  const [mediaKind, setMediaKind] = useState<MediaKind | ''>('');
  const [mediaRole, setMediaRole] = useState<MediaRole | ''>('');
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [uploadRole, setUploadRole] = useState<MediaRole>('general');
  const [uploadFolderId, setUploadFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [moveFolderId, setMoveFolderId] = useState('');
  const [folderWorking, setFolderWorking] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaSuccess, setMediaSuccess] = useState<string | null>(null);
  const mediaRequestVersionRef = useRef(0);

  const [assets, setAssets] = useState<AdminAsset[]>([]);
  const [mediaBaseUrl, setMediaBaseUrl] = useState<string | null>(null);
  const [cleanupLoaded, setCleanupLoaded] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [scannedImages, setScannedImages] = useState(0);
  const [cleaning, setCleaning] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AssetFilter>('used');
  const [query, setQuery] = useState('');
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupSuccess, setCleanupSuccess] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedMediaQuery(mediaQuery.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [mediaQuery]);

  const loadFolders = useCallback(async () => {
    try {
      setFolders(await fetchMediaFolders());
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setMediaError(error instanceof Error ? error.message : '素材文件夹加载失败。');
    }
  }, [onSessionExpired]);

  const loadMedia = useCallback(async () => {
    const version = mediaRequestVersionRef.current + 1;
    mediaRequestVersionRef.current = version;
    setMediaLoading(true);
    setMediaLoadingMore(false);
    setMediaError(null);
    setMediaNextCursor(null);
    try {
      const page = await fetchMediaLibraryPage({
        kinds: mediaKind ? [mediaKind] : undefined,
        role: mediaRole,
        folder: folderFilter,
        query: debouncedMediaQuery,
        limit: 80,
      });
      if (mediaRequestVersionRef.current !== version) return;
      setManagedAssets(page.assets);
      setMediaNextCursor(page.nextCursor);
      setMediaTotal(page.total);
    } catch (error) {
      if (mediaRequestVersionRef.current !== version) return;
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setManagedAssets([]);
      setMediaTotal(0);
      setMediaError(error instanceof Error ? error.message : '素材中心加载失败。');
    } finally {
      if (mediaRequestVersionRef.current === version) setMediaLoading(false);
    }
  }, [debouncedMediaQuery, folderFilter, mediaKind, mediaRole, onSessionExpired]);

  const refreshMediaAndFolders = useCallback(async () => {
    await Promise.all([loadMedia(), loadFolders()]);
  }, [loadFolders, loadMedia]);

  const uploadQueue = useMediaUploadQueue({
    onSessionExpired,
    onBatchComplete: refreshMediaAndFolders,
  });

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  async function loadMoreMedia() {
    if (!mediaNextCursor || mediaLoading || mediaLoadingMore) return;
    const version = mediaRequestVersionRef.current;
    setMediaLoadingMore(true);
    setMediaError(null);
    try {
      const page = await fetchMediaLibraryPage({
        kinds: mediaKind ? [mediaKind] : undefined,
        role: mediaRole,
        folder: folderFilter,
        query: debouncedMediaQuery,
        cursor: mediaNextCursor,
        limit: 80,
      });
      if (mediaRequestVersionRef.current !== version) return;
      setManagedAssets((current) => {
        const byId = new Map(current.map((asset) => [asset.id, asset]));
        page.assets.forEach((asset) => byId.set(asset.id, asset));
        return [...byId.values()];
      });
      setMediaNextCursor(page.nextCursor);
      setMediaTotal(page.total);
    } catch (error) {
      if (mediaRequestVersionRef.current !== version) return;
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setMediaError(error instanceof Error ? error.message : '继续加载素材失败。');
    } finally {
      if (mediaRequestVersionRef.current === version) setMediaLoadingMore(false);
    }
  }

  const scan = useCallback(async () => {
    setCleanupLoading(true);
    setScannedImages(0);
    setCleanupError(null);
    setCleanupSuccess(null);
    setSelectedKeys(new Set());

    try {
      let allAssets: AdminAsset[] = [];
      let cursor: string | undefined;
      const visitedCursors = new Set<string>();

      while (true) {
        const page = await fetchAssetPage(cursor);
        allAssets = mergeAssets(allAssets, page.assets);
        setAssets(allAssets);
        setScannedImages(allAssets.length);
        setMediaBaseUrl(page.mediaBaseUrl);
        if (!page.truncated || !page.cursor) break;
        if (visitedCursors.has(page.cursor)) throw new Error('R2 返回了重复游标，扫描已停止。');
        visitedCursors.add(page.cursor);
        cursor = page.cursor;
      }
      setCleanupLoaded(true);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setCleanupError(error instanceof Error ? error.message : 'R2 图片扫描失败。');
    } finally {
      setCleanupLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    if (tab === 'cleanup' && !cleanupLoaded && !cleanupLoading) void scan();
  }, [cleanupLoaded, cleanupLoading, scan, tab]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [filter]);

  useEffect(() => {
    setSelectedMediaIds(new Set());
  }, [folderFilter, mediaKind, mediaRole]);

  const allManagedSelected =
    managedAssets.length > 0 && managedAssets.every((asset) => selectedMediaIds.has(asset.id));
  const selectedManagedAssets = useMemo(
    () => managedAssets.filter((asset) => selectedMediaIds.has(asset.id)),
    [managedAssets, selectedMediaIds],
  );

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (asset.usageStatus !== filter) return false;
      return (
        !normalizedQuery ||
        asset.key.toLowerCase().includes(normalizedQuery) ||
        (asset.contentType?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    });
  }, [assets, filter, query]);

  const visibleCleanupKeys = useMemo(
    () => filteredAssets.filter((asset) => asset.cleanupEligible).map((asset) => asset.key),
    [filteredAssets],
  );
  const allUnusedSelected =
    visibleCleanupKeys.length > 0 && visibleCleanupKeys.every((key) => selectedKeys.has(key));
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedKeys.has(asset.key) && asset.cleanupEligible),
    [assets, selectedKeys],
  );
  const selectedBytes = selectedAssets.reduce((total, asset) => total + asset.size, 0);

  const cleanupStats = useMemo(
    () => ({
      total: assets.length,
      used: assets.filter((asset) => asset.usageStatus === 'used').length,
      protected: assets.filter((asset) => asset.cleanupBlockedReason === 'SNAPSHOT_RETENTION').length,
      eligible: assets.filter((asset) => asset.cleanupEligible).length,
      bytes: assets.reduce((total, asset) => total + asset.size, 0),
    }),
    [assets],
  );

  const activeFolder = folders.find((folder) => folder.id === folderFilter) ?? null;

  function toggleMedia(id: string) {
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllMedia() {
    setSelectedMediaIds((current) => {
      const next = new Set(current);
      managedAssets.forEach((asset) => {
        if (allManagedSelected) next.delete(asset.id);
        else next.add(asset.id);
      });
      return next;
    });
  }

  function reportUploadSummary(summary: MediaUploadBatchSummary, retry = false) {
    const successful = summary.uploaded + summary.reused;
    const parts = [
      summary.uploaded > 0 ? `新增 ${summary.uploaded} 个` : '',
      summary.reused > 0 ? `复用 ${summary.reused} 个` : '',
      summary.skipped > 0 ? `忽略不支持文件 ${summary.skipped} 个` : '',
    ].filter(Boolean);
    if (successful > 0 || summary.skipped > 0) {
      setMediaSuccess(`${retry ? '重试' : '素材处理'}完成${parts.length ? `：${parts.join('，')}` : ''}。`);
    }
    if (summary.failed > 0) {
      setMediaError(`${summary.failed} 个素材处理失败，失败项已保留在上传队列中，可直接重试。`);
    } else if (summary.total === 0 && summary.skipped > 0) {
      setMediaError('所选内容中没有支持的 JPG、PNG、WebP、GIF、MP4 或 WebM。');
    }
  }

  async function uploadFiles(files: File[], folderId: string | null) {
    if (files.length === 0 || uploadQueue.running) return;
    setMediaError(null);
    setMediaSuccess(null);
    const summary = await uploadQueue.enqueue(files, uploadRole, folderId);
    reportUploadSummary(summary);
  }

  async function retryFailedUploads() {
    if (uploadQueue.running) return;
    setMediaError(null);
    setMediaSuccess(null);
    const summary = await uploadQueue.retryFailed();
    reportUploadSummary(summary, true);
  }

  async function handleFolderUpload(files: File[]) {
    if (files.length === 0 || uploadQueue.running) return;
    setFolderWorking(true);
    setMediaError(null);
    try {
      const result = await createMediaFolder(rootFolderName(files));
      setUploadFolderId(result.folder.id);
      setFolderFilter(result.folder.id);
      await loadFolders();
      await uploadFiles(files, result.folder.id);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setMediaError(error instanceof Error ? error.message : '文件夹上传失败。');
    } finally {
      setFolderWorking(false);
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name || folderWorking) return;
    setFolderWorking(true);
    setMediaError(null);
    try {
      const result = await createMediaFolder(name);
      setNewFolderName('');
      await loadFolders();
      setFolderFilter(result.folder.id);
      setUploadFolderId(result.folder.id);
      setMediaSuccess(result.reused ? `已切换到已有文件夹“${result.folder.name}”。` : `已创建文件夹“${result.folder.name}”。`);
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
      else setMediaError(error instanceof Error ? error.message : '创建文件夹失败。');
    } finally {
      setFolderWorking(false);
    }
  }

  async function handleRenameFolder() {
    if (!activeFolder || folderWorking) return;
    const name = await adminPrompt({
      eyebrow: '素材文件夹',
      title: '重命名文件夹',
      message: '只修改素材中心的整理名称，不会移动 R2 对象或影响现有引用。',
      initialValue: activeFolder.name,
      confirmLabel: '保存名称',
      maxLength: 80,
    });
    if (!name || name === activeFolder.name) return;
    setFolderWorking(true);
    try {
      const updated = await renameMediaFolder(activeFolder.id, name);
      await refreshMediaAndFolders();
      setMediaSuccess(`文件夹已重命名为“${updated.name}”。`);
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
      else setMediaError(error instanceof Error ? error.message : '重命名文件夹失败。');
    } finally {
      setFolderWorking(false);
    }
  }

  async function handleDeleteFolder() {
    if (!activeFolder || folderWorking) return;
    const confirmed = await adminConfirm({
      eyebrow: '素材文件夹',
      title: `删除“${activeFolder.name}”？`,
      message: '只删除文件夹分组；其中素材不会删除，而是自动移动到“未分组”。',
      confirmLabel: '删除文件夹',
      danger: true,
    });
    if (!confirmed) return;
    setFolderWorking(true);
    try {
      await deleteMediaFolder(activeFolder.id);
      setFolderFilter('unfiled');
      if (uploadFolderId === activeFolder.id) setUploadFolderId('');
      await loadFolders();
      setMediaSuccess('文件夹已删除，原有素材已移动到“未分组”。');
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
      else setMediaError(error instanceof Error ? error.message : '删除文件夹失败。');
    } finally {
      setFolderWorking(false);
    }
  }

  async function handleMoveSelected() {
    if (selectedManagedAssets.length === 0 || folderWorking) return;
    const targetId = moveFolderId || null;
    setFolderWorking(true);
    setMediaError(null);
    try {
      const movedCount = await moveMediaAssets(selectedManagedAssets.map((asset) => asset.id), targetId);
      setSelectedMediaIds(new Set());
      await refreshMediaAndFolders();
      const target = targetId ? folders.find((folder) => folder.id === targetId)?.name ?? '目标文件夹' : '未分组';
      setMediaSuccess(`已将 ${movedCount} 个素材移动到“${target}”。`);
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
      else setMediaError(error instanceof Error ? error.message : '移动素材失败。');
    } finally {
      setFolderWorking(false);
    }
  }

  async function handleDeleteManaged() {
    if (selectedManagedAssets.length === 0 || deletingMedia) return;
    const confirmed = await adminConfirm({
      eyebrow: '素材中心',
      title: `删除已选 ${selectedManagedAssets.length} 个素材？`,
      message: '仍在使用或受最近发布快照保护的素材会被服务端阻止删除；只会删除确认安全的素材。',
      confirmLabel: '确认删除',
      danger: true,
    });
    if (!confirmed) return;
    setDeletingMedia(true);
    setMediaError(null);
    setMediaSuccess(null);
    try {
      const result = await deleteMediaAssets(selectedManagedAssets.map((asset) => asset.id));
      setSelectedMediaIds(new Set());
      await refreshMediaAndFolders();
      setMediaSuccess(`已删除 ${result.deletedCount} 个素材，释放 ${formatBytes(result.freedBytes)}。`);
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
      else {
        setSelectedMediaIds(new Set());
        setMediaError(error instanceof Error ? error.message : '素材删除失败。');
        await refreshMediaAndFolders();
      }
    } finally {
      setDeletingMedia(false);
    }
  }

  function toggleKey(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelectedKeys((current) => {
      const next = new Set(current);
      visibleCleanupKeys.forEach((key) => {
        if (allUnusedSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }

  async function confirmCleanup() {
    if (selectedAssets.length === 0 || cleaning) return;
    setCleaning(true);
    setCleanupError(null);
    setCleanupSuccess(null);
    try {
      const result = await cleanupAssets(selectedAssets.map((asset) => asset.key));
      const deleted = new Set(result.deletedKeys);
      setAssets((current) => current.filter((asset) => !deleted.has(asset.key)));
      setSelectedKeys(new Set());
      setShowCleanupDialog(false);
      setCleanupSuccess(`已从 R2 物理删除 ${result.deletedCount} 张图片，释放 ${formatBytes(result.freedBytes)}。`);
      await loadMedia();
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
      else {
        setShowCleanupDialog(false);
        setSelectedKeys(new Set());
        setCleanupError(error instanceof Error ? error.message : 'R2 图片清理失败。');
        if (error instanceof AdminApiError && error.status === 409) await scan();
      }
    } finally {
      setCleaning(false);
    }
  }

  return (
    <section className="asset-library-page media-center-page">
      <div className="asset-library-heading media-center-heading">
        <div>
          <p className="eyebrow">全站媒体管理</p>
          <h2>素材中心</h2>
          <p>所有图片、GIF 和视频统一在这里上传，再由产品、Logo、图标和正文引用。</p>
        </div>
        <div className="media-center-tabs" role="tablist" aria-label="素材中心模式">
          <button type="button" className={tab === 'library' ? 'is-active' : undefined} onClick={() => setTab('library')}>素材中心</button>
          <button type="button" className={tab === 'cleanup' ? 'is-active' : undefined} onClick={() => setTab('cleanup')}>存储清理</button>
        </div>
      </div>

      {tab === 'library' ? (
        <>
          <div className="media-folder-create-bar">
            <div>
              <strong>素材文件夹</strong>
              <small>一层分组即可；文件夹上传会自动使用本地顶层目录名。</small>
            </div>
            <input value={newFolderName} maxLength={80} placeholder="新建文件夹，例如 Product A" onChange={(event) => setNewFolderName(event.target.value)} />
            <button className="secondary-button" type="button" disabled={!newFolderName.trim() || folderWorking || uploadQueue.running} onClick={() => void handleCreateFolder()}>新建文件夹</button>
            {activeFolder ? <button type="button" className="secondary-button" disabled={folderWorking || uploadQueue.running} onClick={() => void handleRenameFolder()}>重命名当前文件夹</button> : null}
            {activeFolder ? <button type="button" className="danger-button" disabled={folderWorking || uploadQueue.running} onClick={() => void handleDeleteFolder()}>删除当前文件夹</button> : null}
          </div>

          <div className="media-center-upload-bar">
            <label>
              <span>素材用途</span>
              <select value={uploadRole} disabled={uploadQueue.running} onChange={(event) => setUploadRole(event.target.value as MediaRole)}>
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>上传到文件夹</span>
              <select value={uploadFolderId} disabled={uploadQueue.running} onChange={(event) => setUploadFolderId(event.target.value)}>
                <option value="">未分组</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <label className={`media-center-upload-button${uploadQueue.running ? ' is-disabled' : ''}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                multiple
                disabled={uploadQueue.running}
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = '';
                  void uploadFiles(files, uploadFolderId || null);
                }}
              />
              {uploadQueue.running ? '队列处理中…' : '上传文件'}
            </label>
            <label className={`media-center-upload-button is-folder-upload${uploadQueue.running || folderWorking ? ' is-disabled' : ''}`}>
              <input
                ref={(node) => {
                  if (!node) return;
                  node.setAttribute('webkitdirectory', '');
                  node.setAttribute('directory', '');
                }}
                type="file"
                multiple
                disabled={uploadQueue.running || folderWorking}
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = '';
                  void handleFolderUpload(files);
                }}
              />
              {uploadQueue.running || folderWorking ? '处理中…' : '上传文件夹'}
            </label>
            <small>静态图片先在浏览器压缩；队列最多并发处理 3 个文件。单个失败不会中断后续文件。</small>
          </div>

          <MediaUploadQueuePanel
            items={uploadQueue.items}
            running={uploadQueue.running}
            progress={uploadQueue.progress}
            onRetryFailed={() => void retryFailedUploads()}
            onClearFinished={uploadQueue.clearFinished}
          />

          {mediaError ? <p className="inline-status is-error" role="alert">{mediaError}</p> : null}
          {mediaSuccess ? <p className="inline-status is-success" role="status">{mediaSuccess}</p> : null}

          <div className="media-center-toolbar">
            <input type="search" value={mediaQuery} placeholder="搜索文件名、文件夹或格式" onChange={(event) => setMediaQuery(event.target.value)} />
            <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}>
              <option value="all">全部文件夹</option>
              <option value="unfiled">未分组</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name} ({folder.assetCount})</option>)}
            </select>
            <select value={mediaKind} onChange={(event) => setMediaKind(event.target.value as MediaKind | '')}>
              {KIND_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
            <select value={mediaRole} onChange={(event) => setMediaRole(event.target.value as MediaRole | '')}>
              <option value="">全部用途</option>
              {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" className="secondary-button" onClick={() => void loadMedia()} disabled={mediaLoading || uploadQueue.running}>刷新</button>
          </div>

          {selectedManagedAssets.length > 0 ? (
            <div className="media-center-selection-toolbar">
              <span>已选择 {selectedManagedAssets.length} 个素材</span>
              <select value={moveFolderId} onChange={(event) => setMoveFolderId(event.target.value)}>
                <option value="">移动到未分组</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>移动到 {folder.name}</option>)}
              </select>
              <button type="button" className="secondary-button" disabled={folderWorking || uploadQueue.running} onClick={() => void handleMoveSelected()}>移动已选</button>
              <button type="button" className="danger-button" disabled={deletingMedia || uploadQueue.running} onClick={() => void handleDeleteManaged()}>{deletingMedia ? '删除中…' : '删除已选'}</button>
            </div>
          ) : null}

          <div className="media-center-select-all">
            <label>
              <input type="checkbox" checked={allManagedSelected} disabled={managedAssets.length === 0 || deletingMedia} onChange={toggleAllMedia} />
              <span>全选已加载素材</span>
            </label>
            <span>{mediaTotal} 个结果{managedAssets.length < mediaTotal ? ` · 已加载 ${managedAssets.length}` : ''}</span>
          </div>

          {mediaLoading ? (
            <div className="media-center-empty">正在读取素材…</div>
          ) : managedAssets.length > 0 ? (
            <>
              <div className="media-center-grid">
                {managedAssets.map((asset) => {
                  const duration = formatDuration(asset.durationMs);
                  return (
                    <article className={`media-center-card${selectedMediaIds.has(asset.id) ? ' is-selected' : ''}`} key={asset.id}>
                      <label className="media-center-card-select">
                        <input type="checkbox" checked={selectedMediaIds.has(asset.id)} disabled={deletingMedia} onChange={() => toggleMedia(asset.id)} />
                        <span className="sr-only">选择 {asset.fileName}</span>
                      </label>
                      <div className="media-center-preview">
                        {asset.publicUrl ? (
                          asset.mediaKind === 'video' ? (
                            <video src={asset.publicUrl} controls muted playsInline preload="metadata" />
                          ) : (
                            <img src={asset.publicUrl} alt="" loading="lazy" />
                          )
                        ) : <span>未配置媒体域名</span>}
                        <b>{kindLabel(asset.mediaKind)}</b>
                      </div>
                      <div className="media-center-card-body">
                        <strong title={asset.fileName}>{asset.fileName}</strong>
                        <small>{asset.folderName ? `📁 ${asset.folderName} · ` : '未分组 · '}{asset.width && asset.height ? `${asset.width} × ${asset.height}` : '尺寸未知'}{duration ? ` · ${duration}` : ''} · {formatBytes(asset.byteSize)}</small>
                        <div className="media-center-role-list">
                          {(asset.roles.length > 0 ? asset.roles : ['general' as MediaRole]).map((role) => <span key={role}>{roleLabel(role)}</span>)}
                        </div>
                      </div>
                      <div className="media-center-card-actions">
                        {asset.publicUrl ? <button type="button" onClick={() => void navigator.clipboard.writeText(asset.publicUrl ?? '')}>复制链接</button> : null}
                        <button type="button" onClick={() => setSelectedMediaIds(new Set([asset.id]))}>选择</button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {mediaNextCursor ? (
                <div className="media-center-load-more">
                  <button type="button" className="secondary-button" disabled={mediaLoadingMore} onClick={() => void loadMoreMedia()}>
                    {mediaLoadingMore ? '正在加载…' : `加载更多（${managedAssets.length} / ${mediaTotal}）`}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="media-center-empty"><strong>没有匹配的素材</strong><p>调整文件夹或筛选条件，或者上传新的素材。</p></div>
          )}
        </>
      ) : cleanupLoading ? (
        <section className="settings-card settings-loading" aria-live="polite">
          <div className="loading-indicator" aria-hidden="true" />
          <p>正在扫描 R2 图片对象，已发现 {scannedImages} 张图片…</p>
        </section>
      ) : (
        <>
          <div className="asset-library-actions media-cleanup-actions">
            <div><strong>底层存储清理</strong><span>仅用于清理没有业务引用、且已经退出最近 3 个可回退快照的图片对象。</span></div>
            <button className="secondary-button" type="button" onClick={() => void scan()}>重新扫描全部图片</button>
            <button className="danger-button" type="button" disabled={selectedAssets.length === 0} onClick={() => setShowCleanupDialog(true)}>物理清理已选 ({selectedAssets.length})</button>
          </div>

          <div className="asset-summary-grid">
            <article><span>扫描图片</span><strong>{cleanupStats.total}</strong><small>{formatBytes(cleanupStats.bytes)}</small></article>
            <article><span>当前使用</span><strong>{cleanupStats.used}</strong><small>D1 中存在业务引用</small></article>
            <article><span>快照保护</span><strong>{cleanupStats.protected}</strong><small>等待最近 3 版自然淘汰</small></article>
            <article><span>可物理清理</span><strong>{cleanupStats.eligible}</strong><small>引用和回退窗口均已释放</small></article>
          </div>

          <div className="asset-safety-note"><strong>清理规则</strong><span>日常删除请优先在素材中心操作。这里保留原始 R2 扫描，用于发现和清理历史孤立图片。</span></div>
          {!mediaBaseUrl ? <div className="notice notice-error" role="alert">尚未配置 R2 自定义域名，图片预览不可用，但扫描和引用保护仍可执行。</div> : null}
          {cleanupError ? <p className="inline-status is-error" role="alert">{cleanupError}</p> : null}
          {cleanupSuccess ? <p className="inline-status is-success" role="status">{cleanupSuccess}</p> : null}

          <div className="asset-toolbar">
            <input type="search" value={query} placeholder="搜索图片路径或 Content-Type" onChange={(event) => setQuery(event.target.value)} />
            <div className="asset-filter-group" aria-label="图片使用状态">
              <button type="button" className={filter === 'used' ? 'is-active' : undefined} onClick={() => setFilter('used')}>使用中 ({cleanupStats.used})</button>
              <button type="button" className={filter === 'unused' ? 'is-active' : undefined} onClick={() => setFilter('unused')}>未使用 ({cleanupStats.protected + cleanupStats.eligible})</button>
            </div>
          </div>

          {filteredAssets.length > 0 ? (
            <AssetTable assets={filteredAssets} selectedKeys={selectedKeys} allUnusedSelected={allUnusedSelected} working={cleaning} onToggle={toggleKey} onToggleAll={toggleAll} />
          ) : (
            <div className="asset-empty-state"><strong>{filter === 'used' ? '没有使用中的图片' : '没有未使用的图片'}</strong><p>可以调整搜索条件或重新扫描 R2。</p></div>
          )}

          {showCleanupDialog ? (
            <CleanupAssetDialog count={selectedAssets.length} totalBytesLabel={formatBytes(selectedBytes)} working={cleaning} onCancel={() => setShowCleanupDialog(false)} onConfirm={() => void confirmCleanup()} />
          ) : null}
        </>
      )}
    </section>
  );
}
