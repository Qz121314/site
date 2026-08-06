import type { AdminAsset, AssetReferenceCounts } from '../api';

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUploadedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function referenceLabels(references: AssetReferenceCounts): string[] {
  const labels: string[] = [];
  if (references.logo > 0) labels.push(`Logo × ${references.logo}`);
  if (references.sectionIcon > 0) labels.push(`分区图标 × ${references.sectionIcon}`);
  if (references.productCover > 0) labels.push(`产品封面 × ${references.productCover}`);
  if (references.productGallery > 0) labels.push(`产品图片 × ${references.productGallery}`);
  return labels;
}

function cleanupLabel(asset: AdminAsset): string {
  switch (asset.cleanupBlockedReason) {
    case 'IN_USE':
      return '正在使用';
    case 'RECENT_UPLOAD':
      return '24 小时保护';
    case 'NOT_IMAGE':
      return '非图片对象';
    default:
      return '可清理';
  }
}

type AssetTableProps = {
  assets: AdminAsset[];
  selectedKeys: Set<string>;
  allEligibleSelected: boolean;
  working: boolean;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
};

export function AssetTable({
  assets,
  selectedKeys,
  allEligibleSelected,
  working,
  onToggle,
  onToggleAll,
}: AssetTableProps) {
  const eligibleCount = assets.filter((asset) => asset.cleanupEligible).length;

  return (
    <div className="asset-table-wrap">
      <table className="asset-table">
        <thead>
          <tr>
            <th className="asset-select-cell">
              <input
                type="checkbox"
                aria-label="选择当前筛选结果中的全部可清理对象"
                checked={eligibleCount > 0 && allEligibleSelected}
                disabled={working || eligibleCount === 0}
                onChange={onToggleAll}
              />
            </th>
            <th>预览</th>
            <th>R2 对象</th>
            <th>大小与时间</th>
            <th>数据库状态</th>
            <th>引用检测</th>
            <th>清理状态</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const references = referenceLabels(asset.references);
            return (
              <tr key={asset.key}>
                <td className="asset-select-cell">
                  <input
                    type="checkbox"
                    aria-label={`选择 ${asset.key}`}
                    checked={selectedKeys.has(asset.key)}
                    disabled={working || !asset.cleanupEligible}
                    onChange={() => onToggle(asset.key)}
                  />
                </td>
                <td>
                  <div className="asset-preview">
                    {asset.isImage && asset.publicUrl ? (
                      <img src={asset.publicUrl} alt="" loading="lazy" />
                    ) : (
                      <span aria-hidden="true">IMG</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="asset-key-cell">
                    <code title={asset.key}>{asset.key}</code>
                    <small>{asset.contentType ?? '未记录 Content-Type'}</small>
                  </div>
                </td>
                <td>
                  <div className="asset-meta-cell">
                    <strong>{formatBytes(asset.size)}</strong>
                    <small>{formatUploadedAt(asset.uploadedAt)}</small>
                  </div>
                </td>
                <td>
                  <div className="asset-status-stack">
                    <span className={`asset-chip ${asset.trackingStatus}`}>
                      {asset.trackingStatus === 'tracked' ? 'D1 已登记' : 'R2 未登记'}
                    </span>
                    {asset.databaseStatus ? <small>{asset.databaseStatus}</small> : null}
                  </div>
                </td>
                <td>
                  {references.length > 0 ? (
                    <div className="asset-reference-list">
                      {references.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="asset-muted">无引用</span>
                  )}
                </td>
                <td>
                  <span
                    className={`asset-cleanup-status ${asset.cleanupEligible ? 'eligible' : 'blocked'}`}
                  >
                    {cleanupLabel(asset)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
