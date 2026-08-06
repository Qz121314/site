import type { AdminAsset, AssetReferenceCounts } from './api';

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

type AssetTableProps = {
  assets: AdminAsset[];
  selectedKeys: Set<string>;
  allUnusedSelected: boolean;
  working: boolean;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
};

export function AssetTable({
  assets,
  selectedKeys,
  allUnusedSelected,
  working,
  onToggle,
  onToggleAll,
}: AssetTableProps) {
  const unusedCount = assets.filter((asset) => asset.usageStatus === 'unused').length;

  return (
    <div className="asset-table-wrap">
      <table className="asset-table">
        <thead>
          <tr>
            <th className="asset-select-cell">
              <input
                type="checkbox"
                aria-label="选择当前列表中的全部未使用图片"
                checked={unusedCount > 0 && allUnusedSelected}
                disabled={working || unusedCount === 0}
                onChange={onToggleAll}
              />
            </th>
            <th>预览</th>
            <th>R2 图片</th>
            <th>大小与时间</th>
            <th>使用状态</th>
            <th>引用位置</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const references = referenceLabels(asset.references);
            const isUnused = asset.usageStatus === 'unused';
            return (
              <tr key={asset.key}>
                <td className="asset-select-cell">
                  <input
                    type="checkbox"
                    aria-label={`选择 ${asset.key}`}
                    checked={selectedKeys.has(asset.key)}
                    disabled={working || !isUnused}
                    onChange={() => onToggle(asset.key)}
                  />
                </td>
                <td>
                  <div className="asset-preview">
                    {asset.publicUrl ? (
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
                  <span className={`asset-cleanup-status ${isUnused ? 'eligible' : 'blocked'}`}>
                    {isUnused ? '未使用' : '使用中'}
                  </span>
                </td>
                <td>
                  {references.length > 0 ? (
                    <div className="asset-reference-list">
                      {references.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="asset-muted">无业务引用，可物理清理</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}