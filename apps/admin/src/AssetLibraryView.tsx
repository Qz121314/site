import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminApiError } from './api';
import { AssetTable } from './asset-library/AssetTable';
import { CleanupAssetDialog } from './asset-library/CleanupAssetDialog';
import { deleteMediaAssets } from './asset-library/media-delete-api';
import {
  cleanupAssets,
  fetchAssetPage,
  fetchMediaLibrary,
  uploadMediaAsset,
  type AdminAsset,
  type ManagedMediaAsset,
  type MediaKind,
  type MediaRole,
} from './asset-library/api';

type AssetFilter = 'used' | 'unused';
type WorkbenchTab = 'library' | 'cleanup';

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

function inspectVideo(file: File): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
      URL.revokeObjectURL(url);
      if (width < 1 || height < 1) {
        reject(new Error(`无法读取视频“${file.name}”的尺寸。`));
        return;
      }
      resolve({ width, height, durationMs });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取视频“${file.name}”。`));
    };
    video.src = url;
  });
}

export function AssetLibraryView({ onSessionExpired }: AssetLibraryViewProps) {
  const [tab, setTab] = useState<WorkbenchTab>('library');

  const [managedAssets, setManagedAssets] = useState<ManagedMediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaQuery, setMediaQuery] = useState('');
  const [mediaKind, setMediaKind] = useState<MediaKind | ''>('');
  const [mediaRole, setMediaRole] = useState<MediaRole | ''>('');
  const [uploadRole, setUploadRole] = useState<MediaRole>('general');
  const [uploading, setUploading] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaSuccess, setMediaSuccess] = useState<string | null>(null);

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

  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    setMediaError(null);
    try {
      setManagedAssets(await fetchMediaLibrary());
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setMediaError(error instanceof Error ? error.message : '素材中心加载失败。');
    } finally {
      setMediaLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

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
        if (visitedCursors.has(page.cursor)) {
          throw new Error('R2 返回了重复游标，扫描已停止。');
        }
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

  const filteredManagedAssets = useMemo(() => {
    const keyword = mediaQuery.trim().toLowerCase();
    return managedAssets.filter((asset) => {
      if (mediaKind && asset.mediaKind !== mediaKind) return false;
      if (mediaRole && !asset.roles.includes(mediaRole)) return false;
      if (!keyword) return true;
      return (
        asset.fileName.toLowerCase().includes(keyword) ||
        asset.objectKey.toLowerCase().includes(keyword) ||
        asset.mimeType.toLowerCase().includes(keyword) ||
        asset.roles.some((role) => roleLabel(role).toLowerCase().includes(keyword))
      );
    });
  }, [managedAssets, mediaKind, mediaQuery, mediaRole]);

  const allManagedSelected =
    filteredManagedAssets.length > 0 && filteredManagedAssets.every((asset) => selectedMediaIds.has(asset.id));
  const selectedManagedAssets = useMemo(
    () => managedAssets.filter((asset) => selectedMediaIds.has(asset.id)),
    [managedAssets, selectedMediaIds],
  );

  const mediaStats = useMemo(
    () => ({
      total: managedAssets.length,
      images: managedAssets.filter((asset) => asset.mediaKind === 'image').length,
      animated: managedAssets.filter((asset) => asset.mediaKind === 'animated_image').length,
      videos: managedAssets.filter((asset) => asset.mediaKind === 'video').length,
      bytes: managedAssets.reduce((total, asset) => total + asset.byteSize, 0),
    }),
    [managedAssets],
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
      filteredManagedAssets.forEach((asset) => {
        if (allManagedSelected) next.delete(asset.id);
        else next.add(asset.id);
      });
      return next;
    });
  }

  async function handleUpload(files: File[]) {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setMediaError(null);
    setMediaSuccess(null);
    let uploaded = 0;
    let reused = 0;
    try {
      for (const file of files) {
        const metadata = file.type === 'video/mp4' || file.type === 'video/webm'
          ? await inspectVideo(file)
          : null;
        const result = await uploadMediaAsset({
          file,
          role: uploadRole,
          width: metadata?.width,
          height: metadata?.height,
          durationMs: metadata?.durationMs,
        });
        if (result.reused) reused += 1;
        else uploaded += 1;
      }
      await loadMedia();
      setMediaSuccess(`素材处理完成：新增 ${uploaded} 个${reused > 0 ? `，复用已有 ${reused} 个` : ''}。`);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setMediaError(error instanceof Error ? error.message : '素材上传失败。');
      await loadMedia();
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteManaged() {
    if (selectedManagedAssets.length === 0 || deletingMedia) return;
    if (!window.confirm(`确认删除已选 ${selectedManagedAssets.length} 个素材？仍在使用或受发布快照保护的素材不会被删除。`)) {
      return;
    }
    setDeletingMedia(true);
    setMediaError(null);
    setMediaSuccess(null);
    try {
      const result = await deleteMediaAssets(selectedManagedAssets.map((asset) => asset.id));
      const deleted = new Set(result.deletedIds);
      setManagedAssets((current) => current.filter((asset) => !deleted.has(asset.id)));
      setSelectedMediaIds(new Set());
      setMediaSuccess(`已删除 ${result.deletedCount} 个素材，释放 ${formatBytes(result.freedBytes)}。`);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setSelectedMediaIds(new Set());
      setMediaError(error instanceof Error ? error.message : '素材删除失败。');
      await loadMedia();
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
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setShowCleanupDialog(false);
      setSelectedKeys(new Set());
      setCleanupError(error instanceof Error ? error.message : 'R2 图片清理失败。');
      if (error instanceof AdminApiError && error.status === 409) await scan();
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
          <p>统一管理产品图片、GIF、视频、Logo、图标、Hero、背景和正文素材。</p>
        </div>
        <div className="media-center-tabs" role="tablist" aria-label="素材中心模式">
          <button type="button" className={tab === 'library' ? 'is-active' : undefined} onClick={() => setTab('library')}>素材中心</button>
          <button type="button" className={tab === 'cleanup' ? 'is-active' : undefined} onClick={() => setTab('cleanup')}>存储清理</button>
        </div>
      </div>

      {tab === 'library' ? (
        <>
          <div className="media-center-upload-bar">
            <label>
              <span>素材用途</span>
              <select value={uploadRole} disabled={uploading} onChange={(event) => setUploadRole(event.target.value as MediaRole)}>
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className={`media-center-upload-button${uploading ? ' is-disabled' : ''}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                multiple
                disabled={uploading}
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = '';
                  void handleUpload(files);
                }}
              />
              {uploading ? '正在上传…' : '上传素材'}
            </label>
            <small>图片/GIF ≤ 20 MB；MP4/WebM ≤ 60 MB。上传时选择的是用途，文件类型由系统自动识别。</small>
          </div>

          <div className="asset-summary-grid media-summary-grid">
            <article><span>全部素材</span><strong>{mediaStats.total}</strong><small>{formatBytes(mediaStats.bytes)}</small></article>
            <article><span>静态图片</span><strong>{mediaStats.images}</strong><small>JPG / PNG / WebP</small></article>
            <article><span>GIF / 动图</span><strong>{mediaStats.animated}</strong><small>保留原始动画</small></article>
            <article><span>视频</span><strong>{mediaStats.videos}</strong><small>MP4 / WebM</small></article>
          </div>

          {mediaError ? <p className="inline-status is-error" role="alert">{mediaError}</p> : null}
          {mediaSuccess ? <p className="inline-status is-success" role="status">{mediaSuccess}</p> : null}

          <div className="media-center-toolbar">
            <input type="search" value={mediaQuery} placeholder="搜索文件名、路径、格式或用途" onChange={(event) => setMediaQuery(event.target.value)} />
            <select value={mediaKind} onChange={(event) => setMediaKind(event.target.value as MediaKind | '')}>
              {KIND_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
            <select value={mediaRole} onChange={(event) => setMediaRole(event.target.value as MediaRole | '')}>
              <option value="">全部用途</option>
              {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" className="secondary-button" onClick={() => void loadMedia()} disabled={mediaLoading || uploading}>刷新</button>
            <button type="button" className="danger-button" disabled={selectedManagedAssets.length === 0 || deletingMedia} onClick={() => void handleDeleteManaged()}>
              {deletingMedia ? '删除中…' : `删除已选 (${selectedManagedAssets.length})`}
            </button>
          </div>

          <div className="media-center-select-all">
            <label>
              <input type="checkbox" checked={allManagedSelected} disabled={filteredManagedAssets.length === 0 || deletingMedia} onChange={toggleAllMedia} />
              <span>全选当前筛选结果</span>
            </label>
            <span>{filteredManagedAssets.length} 个结果</span>
          </div>

          {mediaLoading ? (
            <div className="media-center-empty">正在读取素材…</div>
          ) : filteredManagedAssets.length > 0 ? (
            <div className="media-center-grid">
              {filteredManagedAssets.map((asset) => {
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
                      <small>
                        {asset.width && asset.height ? `${asset.width} × ${asset.height}` : '尺寸未知'}
                        {duration ? ` · ${duration}` : ''} · {formatBytes(asset.byteSize)}
                      </small>
                      <div className="media-center-role-list">
                        {(asset.roles.length > 0 ? asset.roles : ['general' as MediaRole]).map((role) => <span key={role}>{roleLabel(role)}</span>)}
                      </div>
                    </div>
                    <div className="media-center-card-actions">
                      {asset.publicUrl ? (
                        <button type="button" onClick={() => void navigator.clipboard.writeText(asset.publicUrl ?? '')}>复制链接</button>
                      ) : null}
                      <button type="button" onClick={() => setSelectedMediaIds(new Set([asset.id]))}>选择</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="media-center-empty"><strong>没有匹配的素材</strong><p>调整筛选条件，或者上传新的素材。</p></div>
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
            <div>
              <strong>底层存储清理</strong>
              <span>仅用于清理没有业务引用、且已经退出最近 3 个可回退快照的图片对象。</span>
            </div>
            <button className="secondary-button" type="button" onClick={() => void scan()}>重新扫描全部图片</button>
            <button className="danger-button" type="button" disabled={selectedAssets.length === 0} onClick={() => setShowCleanupDialog(true)}>
              物理清理已选 ({selectedAssets.length})
            </button>
          </div>

          <div className="asset-summary-grid">
            <article><span>扫描图片</span><strong>{cleanupStats.total}</strong><small>{formatBytes(cleanupStats.bytes)}</small></article>
            <article><span>当前使用</span><strong>{cleanupStats.used}</strong><small>D1 中存在业务引用</small></article>
            <article><span>快照保护</span><strong>{cleanupStats.protected}</strong><small>等待最近 3 版自然淘汰</small></article>
            <article><span>可物理清理</span><strong>{cleanupStats.eligible}</strong><small>引用和回退窗口均已释放</small></article>
          </div>

          <div className="asset-safety-note">
            <strong>清理规则</strong>
            <span>日常删除请优先在素材中心操作。这里保留原始 R2 扫描，用于发现和清理历史孤立图片。</span>
          </div>

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
