import type { AdminProduct } from './api';

type ProductTableProps = {
  scope: 'active' | 'trash';
  products: AdminProduct[];
  loading: boolean;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  working: boolean;
  reorderDisabled: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
  onRestore: (product: AdminProduct) => void;
  onMove: (product: AdminProduct, direction: -1 | 1) => void;
};

function statusLabel(status: AdminProduct['status']): string {
  switch (status) {
    case 'published':
      return '已发布';
    case 'archived':
      return '已归档';
    default:
      return '草稿';
  }
}

function serviceModeLabel(mode: AdminProduct['serviceMode']): string {
  return mode === 'online' ? '线上服务' : '线下服务';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

export function ProductTable({
  scope,
  products,
  loading,
  selectedIds,
  allVisibleSelected,
  working,
  reorderDisabled,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onRestore,
  onMove,
}: ProductTableProps) {
  if (loading) {
    return (
      <div className="settings-card settings-loading" aria-live="polite">
        <div className="loading-indicator" aria-hidden="true" />
        <p>正在读取产品…</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="product-empty-state">
        <strong>{scope === 'active' ? '当前没有产品' : '回收站为空'}</strong>
      </div>
    );
  }

  return (
    <div className="product-table-wrap">
      <table className="product-table product-table-with-tags">
        <thead>
          <tr>
            <th className="product-select-column">
              {scope === 'active' ? (
                <input type="checkbox" aria-label="选择当前结果全部产品" checked={allVisibleSelected} onChange={onToggleSelectAll} />
              ) : null}
            </th>
            <th>产品</th>
            <th>服务与转化</th>
            <th>分类</th>
            <th>标签</th>
            <th>状态</th>
            <th>排序</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.id}>
              <td className="product-select-column">
                {scope === 'active' ? (
                  <input type="checkbox" aria-label={`选择产品 ${product.title}`} checked={selectedIds.has(product.id)} onChange={() => onToggleSelect(product.id)} />
                ) : null}
              </td>
              <td>
                <div className="product-table-identity">
                  <div className="product-table-cover">
                    {product.effectiveCoverUrl ? <img src={product.effectiveCoverUrl} alt="" /> : <span>无图片</span>}
                  </div>
                  <div>
                    <strong>{product.title}</strong>
                    <small>/{product.slug}</small>
                    {product.isFeatured ? <b>热门</b> : null}
                  </div>
                </div>
              </td>
              <td><div className="product-table-stack"><span>{serviceModeLabel(product.serviceMode)}</span><small>{product.conversionGroupName ?? '未选择转化分组'}</small></div></td>
              <td>{product.categoryName ?? '未分类'}</td>
              <td>
                {product.tags.length > 0 ? (
                  <div className="product-table-tags">
                    {product.tags.map((tag) => <span key={tag.id} className={!tag.isEnabled ? 'is-disabled' : undefined}>{tag.name}</span>)}
                  </div>
                ) : <span className="product-tags-none">—</span>}
              </td>
              <td><span className={`product-status-badge is-${product.status}`}>{statusLabel(product.status)}</span></td>
              <td>
                <div className="product-order-cell">
                  <span>{product.sortOrder}</span>
                  {scope === 'active' ? <div><button type="button" aria-label="上移产品" disabled={working || reorderDisabled || index === 0} onClick={() => onMove(product, -1)}>↑</button><button type="button" aria-label="下移产品" disabled={working || reorderDisabled || index === products.length - 1} onClick={() => onMove(product, 1)}>↓</button></div> : null}
                </div>
              </td>
              <td>{formatDate(product.updatedAt)}</td>
              <td>
                <div className="product-row-actions">
                  {scope === 'active' ? <><button type="button" disabled={working} onClick={() => onEdit(product)}>编辑</button><button className="text-danger" type="button" disabled={working} onClick={() => onDelete(product)}>删除</button></> : <button type="button" disabled={working} onClick={() => onRestore(product)}>恢复</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
