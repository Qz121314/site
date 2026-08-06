import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminApiError,
  cleanupAssets,
  fetchAssetPage,
  type AdminAsset,
} from './api';
import { AssetTable } from './asset-library/AssetTable';
import { CleanupAssetDialog } from './asset-library/CleanupAssetDialog';

type AssetFilter = 'all' | 'cleanup' | 'used' | 'untracked';

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
  const [cursor, setCursor] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [mediaBaseUrl, setMediaBaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [query, setQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSelectedKeys(new Set());

    try {
      const page = await fetchAssetPage();
      setAssets(page.assets);
      setCursor(page.cursor);
      setTruncated(page.truncated);
      setMediaBaseUrl(page.mediaBaseUrl);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : 'R2 扫描失败。');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void scan();
  }, [scan]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setErrorMessage(null);

    try {
      const page = await fetchAssetPage(cursor);
      setAssets((current) => mergeAssets(current, page.assets));
      setCursor(page.cursor);
      setTruncated(page.truncated);
      setMediaBaseUrl(page.mediaBaseUrl);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '继续扫描失败。');
    } finally {
      setLoadingMore(false);
    }
  }

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesQuery =
        !normalizedQuery ||
        asset.key.toLowerCase().includes(normalizedQuery) ||
        (asset.contentType?.toLowerCase().includes(normalizedQuery) ?? false);
      if (!matchesQuery) return false;

      switch (filter) {
        case 'cleanup':
          return asset.cleanupEligible;
        case 'used':
          return asset.usageStatus === 'used';
        case 'untracked':
          return asset.trackingStatus === 'untracked';
        default:
          return true;
      }
    });
  }, [assets, filter, query]);

  const eligibleVisibleKeys = useMemo(
    () => filteredAssets.filter((asset) => asset.cleanupEligible).map((asset) => asset.key),
    [filteredAssets],
  );
  const allEligibleSelected =
    eligibleVisibleKeys.length > 0 && eligibleVisibleKeys.every((key) => selectedKeys.has(key));
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedKeys.has(asset.key) && asset.cleanupEligible),
    [assets, selectedKeys],
  );
  const selectedBytes = selectedAssets.reduce((total, asset) => total + asset.size, 0);

  const stats = useMemo(
    () => ({
      scanned: assets.length,
      used: assets.filter((asset) => asset.usageStatus === 'used').length,
      cleanup: assets.filter((asset) => asset.cleanupEligible).length,
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
      eligibleVisibleKeys.forEach((key) => {
        if (allEligibleSelected) next.delete(key);
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
        `已清理 ${result.deletedCount} 个对象，释放 ${formatBytes(result.freedBytes)}。`,
      );
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setShowCleanupDialog(false);
      setSelectedKeys(new Set());
      setErrorMessage(error instanceof Error ? error.message : '素材清理失败。');
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
        <p>正在扫描 R2 的 media/ 对象…</p>
      </section>
    );
  }

  return (
    <section className="asset-library-page">
      <div className="asset-library-heading">
        <div>
          <p className="eyebrow">只扫描与清理</p>
          <h2>R2 素材库</h2>
          <p>不提供上传。只读取 media/ 对象、核对 D1 引用并清理未使用图片。</p>
        </div>
        <div className="asset-library-actions">
          <button className="secondary-button" type="button" onClick={() => void scan()}>
            重新扫描
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={selectedAssets.length === 0}
            onClick={() => setShowCleanupDialog(true)}
          >
            清理已选 ({selectedAssets.length})
          </button>
        </div>
      </div>

      <div className="asset-summary-grid">
        <article><span>已扫描</span><strong>{stats.scanned}</strong><small>当前已加载对象</small></article>
        <article><span>正在使用</span><strong>{stats.used}</strong><small>D1 存在有效引用</small></article>
        <article><span>可清理</span><strong>{stats.cleanup}</strong><small>无引用且超过保护期</small></article>
        <article><span>已加载容量</span><strong>{formatBytes(stats.bytes)}</strong><small>不是整个 Bucket 总量</small></article>
      </div>

      <div className="asset-safety-note">
        <strong>安全范围</strong>
        <span>只扫描 media/；public/ 发布文件不会进入列表；新对象保留 24 小时保护期。</span>
      </div>

      {!mediaBaseUrl ? (
        <div className="notice notice-error" role="alert">
          尚未配置 R2 自定义域名，图片预览不可用，但扫描和引用检测仍可执行。
        </div>
      ) : null}
      {errorMessage ? <p className="inline-status is-error" role="alert">{errorMessage}</p> : null}
      {successMessage ? <p className="inline-status is-success" role="status">{successMessage}</p> : null}

      <div className="asset-toolbar">
        <input
          type="search"
          value={query}
          placeholder="搜索对象路径或 Content-Type"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="asset-filter-group" aria-label="素材筛选">
          {([
            ['all', '全部'],
            ['cleanup', '可清理'],
            ['used', '正在使用'],
            ['untracked', 'R2 未登记'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'is-active' : undefined}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredAssets.length > 0 ? (
        <AssetTable
          assets={filteredAssets}
          selectedKeys={selectedKeys}
          allEligibleSelected={allEligibleSelected}
          working={cleaning}
          onToggle={toggleKey}
          onToggleAll={toggleAll}
        />
      ) : (
        <div className="asset-empty-state">
          <strong>没有符合条件的对象</strong>
          <p>调整筛选条件，或重新扫描 R2。</p>
        </div>
      )}

      {truncated ? (
        <div className="asset-load-more">
          <button className="secondary-button" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? '正在继续扫描…' : '继续扫描下一批'}
          </button>
        </div>
      ) : null}

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
