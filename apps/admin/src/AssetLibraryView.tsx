import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminApiError } from './api';
import { AssetTable } from './asset-library/AssetTable';
import { CleanupAssetDialog } from './asset-library/CleanupAssetDialog';
import {
  cleanupAssets,
  fetchAssetPage,
  type AdminAsset,
} from './asset-library/api';

type AssetFilter = 'used' | 'unused';

type AssetLibraryViewProps = {
  onSessionExpired: () => void;
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function mergeAssets(current: AdminAsset[], incoming: AdminAsset[]): AdminAsset[] {
  const byKey = new Map(current.map((asset) => [asset.key, asset]));
  incoming.forEach((asset) => byKey.set(asset.key, asset));
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function AssetLibraryView({ onSessionExpired }: AssetLibraryViewProps) {
  const [assets, setAssets] = useState<AdminAsset[]>([]);
  const [mediaBaseUrl, setMediaBaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannedImages, setScannedImages] = useState(0);
  const [cleaning, setCleaning] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AssetFilter>('used');
  const [query, setQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setScannedImages(0);
    setErrorMessage(null);
    setSuccessMessage(null);
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

        if (!page.truncated || !page.cursor) {
          break;
        }
        if (visitedCursors.has(page.cursor)) {
          throw new Error('R2 返回了重复游标，扫描已停止。');
        }
        visitedCursors.add(page.cursor);
        cursor = page.cursor;
      }
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : 'R2 图片扫描失败。');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void scan();
  }, [scan]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [filter]);

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

  const visibleUnusedKeys = useMemo(
    () => filteredAssets.filter((asset) => asset.usageStatus === 'unused').map((asset) => asset.key),
    [filteredAssets],
  );
  const allUnusedSelected =
    visibleUnusedKeys.length > 0 && visibleUnusedKeys.every((key) => selectedKeys.has(key));
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedKeys.has(asset.key) && asset.usageStatus === 'unused'),
    [assets, selectedKeys],
  );
  const selectedBytes = selectedAssets.reduce((total, asset) => total + asset.size, 0);

  const stats = useMemo(
    () => ({
      total: assets.length,
      used: assets.filter((asset) => asset.usageStatus === 'used').length,
      unused: assets.filter((asset) => asset.usageStatus === 'unused').length,
      bytes: assets.reduce((total, asset) => total + asset.size, 0),
    }),
    [assets],
  );

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
      visibleUnusedKeys.forEach((key) => {
        if (allUnusedSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  }

  async function confirmCleanup() {
    if (selectedAssets.length === 0 || cleaning) return;
    setCleaning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await cleanupAssets(selectedAssets.map((asset) => asset.key));
      const deleted = new Set(result.deletedKeys);
      setAssets((current) => current.filter((asset) => !deleted.has(asset.key)));
      setSelectedKeys(new Set());
      setShowCleanupDialog(false);
      setSuccessMessage(
        `已从 R2 物理删除 ${result.deletedCount} 张图片，释放 ${formatBytes(result.freedBytes)}。`,
      );
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setShowCleanupDialog(false);
      setSelectedKeys(new Set());
      setErrorMessage(error instanceof Error ? error.message : 'R2 图片清理失败。');
      if (error instanceof AdminApiError && error.status === 409) {
        await scan();
      }
    } finally {
      setCleaning(false);
    }
  }

  if (loading) {
    return (
      <section className="settings-card settings-loading" aria-live="polite">
        <div className="loading-indicator" aria-hidden="true" />
        <p>正在扫描整个 R2 Bucket，已发现 {scannedImages} 张图片…</p>
      </section>
    );
  }

  return (
    <section className="asset-library-page">
      <div className="asset-library-heading">
        <div>
          <p className="eyebrow">R2 存储管理</p>
          <h2>R2 图片管理</h2>
          <p>扫描 Bucket 中的全部图片，按使用中和未使用分类；未使用图片可以物理清理。</p>
        </div>
        <div className="asset-library-actions">
          <button className="secondary-button" type="button" onClick={() => void scan()}>
            重新扫描全部图片
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={selectedAssets.length === 0}
            onClick={() => setShowCleanupDialog(true)}
          >
            物理清理已选 ({selectedAssets.length})
          </button>
        </div>
      </div>

      <div className="asset-summary-grid">
        <article><span>全部图片</span><strong>{stats.total}</strong><small>整个 Bucket 扫描结果</small></article>
        <article><span>使用中</span><strong>{stats.used}</strong><small>D1 中存在业务引用</small></article>
        <article><span>未使用</span><strong>{stats.unused}</strong><small>可以选择物理清理</small></article>
        <article><span>图片容量</span><strong>{formatBytes(stats.bytes)}</strong><small>全部已扫描图片</small></article>
      </div>

      <div className="asset-safety-note">
        <strong>清理规则</strong>
        <span>清理只允许删除未使用图片。确认时会再次检查 D1 引用，删除后 R2 对象不可恢复。</span>
      </div>

      {!mediaBaseUrl ? (
        <div className="notice notice-error" role="alert">
          尚未配置 R2 自定义域名，图片预览不可用，但扫描、使用检测和物理清理仍可执行。
        </div>
      ) : null}
      {errorMessage ? <p className="inline-status is-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="inline-status is-success" role="status">{successMessage}</p> : null}

      <div className="asset-toolbar">
        <input
          type="search"
          value={query}
          placeholder="搜索图片路径或 Content-Type"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="asset-filter-group" aria-label="图片使用状态">
          <button
            type="button"
            className={filter === 'used' ? 'is-active' : undefined}
            onClick={() => setFilter('used')}
          >
            使用中 ({stats.used})
          </button>
          <button
            type="button"
            className={filter === 'unused' ? 'is-active' : undefined}
            onClick={() => setFilter('unused')}
          >
            未使用 ({stats.unused})
          </button>
        </div>
      </div>

      {filteredAssets.length > 0 ? (
        <AssetTable
          assets={filteredAssets}
          selectedKeys={selectedKeys}
          allUnusedSelected={allUnusedSelected}
          working={cleaning}
          onToggle={toggleKey}
          onToggleAll={toggleAll}
        />
      ) : (
        <div className="asset-empty-state">
          <strong>{filter === 'used' ? '没有使用中的图片' : '没有未使用的图片'}</strong>
          <p>可以调整搜索条件或重新扫描 R2。</p>
        </div>
      )}

      {showCleanupDialog ? (
        <CleanupAssetDialog
          count={selectedAssets.length}
          totalBytesLabel={formatBytes(selectedBytes)}
          working={cleaning}
          onCancel={() => setShowCleanupDialog(false)}
          onConfirm={() => void confirmCleanup()}
        />
      ) : null}
    </section>
  );
}