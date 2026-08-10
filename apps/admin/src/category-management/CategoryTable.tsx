import type { AdminCategory } from './api';

type CategoryTableProps = {
  scope: 'active' | 'trash';
  categories: AdminCategory[];
  loading: boolean;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  working: boolean;
  reorderDisabled: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleEnabled: (category: AdminCategory) => void;
  onEdit: (category: AdminCategory) => void;
  onDelete: (category: AdminCategory) => void;
  onRestore: (category: AdminCategory) => void;
  onMove: (category: AdminCategory, direction: -1 | 1) => void;
};

export function CategoryTable({
  scope,
  categories,
  loading,
  selectedIds,
  allVisibleSelected,
  working,
  reorderDisabled,
  onToggleSelect,
  onToggleSelectAll,
  onToggleEnabled,
  onEdit,
  onDelete,
  onRestore,
  onMove,
}: CategoryTableProps) {
  if (loading) {
    return (
      <div className="category-table-wrap category-table-empty" aria-live="polite">
        <div className="loading-indicator" aria-hidden="true" />
        <p>正在读取分类…</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="category-table-wrap category-table-empty">
        <strong>{scope === 'active' ? '当前分区还没有分类' : '回收站为空'}</strong>
        <p>
          {scope === 'active' ? '点击“新增分类”开始录入。' : '已删除的分类会显示在这里。'}
        </p>
      </div>
    );
  }

  return (
    <div className="category-table-wrap">
      <table className="category-table">
        <thead>
          <tr>
            <th className="checkbox-cell">
              {scope === 'active' ? (
                <input
                  type="checkbox"
                  aria-label="全选当前结果"
                  checked={allVisibleSelected}
                  onChange={onToggleSelectAll}
                />
              ) : null}
            </th>
            <th>分类名称</th>
            <th>产品引用</th>
            <th>排序</th>
            <th>状态</th>
            <th className="actions-cell">操作</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category, index) => (
            <tr key={category.id}>
              <td className="checkbox-cell">
                {scope === 'active' ? (
                  <input
                    type="checkbox"
                    aria-label={`选择分类 ${category.name}`}
                    checked={selectedIds.has(category.id)}
                    onChange={() => onToggleSelect(category.id)}
                  />
                ) : null}
              </td>
              <td>
                <div className="category-name-cell">
                  <strong>{category.name}</strong>
                  <small>{category.id.slice(0, 8)}</small>
                </div>
              </td>
              <td>
                <span
                  className={
                    category.productCount > 0
                      ? 'category-reference is-used'
                      : 'category-reference'
                  }
                >
                  {category.productCount} 个产品
                </span>
              </td>
              <td>
                {scope === 'active' ? (
                  <div className="sort-controls">
                    <span>{category.sortOrder}</span>
                    <div>
                      <button
                        type="button"
                        aria-label={`上移 ${category.name}`}
                        disabled={working || reorderDisabled || index === 0}
                        onClick={() => onMove(category, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`下移 ${category.name}`}
                        disabled={
                          working || reorderDisabled || index === categories.length - 1
                        }
                        onClick={() => onMove(category, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ) : (
                  category.sortOrder
                )}
              </td>
              <td>
                {scope === 'active' ? (
                  <button
                    type="button"
                    className={`status-pill ${category.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                    disabled={working}
                    onClick={() => onToggleEnabled(category)}
                  >
                    {category.isEnabled ? '已启用' : '已停用'}
                  </button>
                ) : (
                  <span className="status-pill is-deleted">已删除</span>
                )}
              </td>
              <td className="actions-cell">
                {scope === 'active' ? (
                  <>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => onEdit(category)}
                    >
                      编辑
                    </button>
                    <button
                      className="text-danger"
                      type="button"
                      disabled={working}
                      onClick={() => onDelete(category)}
                    >
                      删除
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => onRestore(category)}
                  >
                    恢复
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
