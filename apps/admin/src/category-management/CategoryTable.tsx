import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminFeedbackState } from '../components/ui/feedback-state';
import { AdminStatusBadge } from '../components/ui/status-badge';
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
    return <AdminFeedbackState kind="loading" title="正在读取分类…" />;
  }

  if (categories.length === 0) {
    return (
      <AdminFeedbackState
        kind="empty"
        title={scope === 'active' ? '当前分区还没有分类' : '回收站为空'}
        description={
          scope === 'active'
            ? '使用上方“新增分类”开始录入。'
            : '已删除的分类会显示在这里。'
        }
      />
    );
  }

  return (
    <div className="category-table-wrap ui-data-table-wrap">
      <table className="category-table ui-data-table">
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
          {categories.map((category, index) => {
            const selected = selectedIds.has(category.id);
            return (
              <tr
                key={category.id}
                className={`ui-data-row${selected ? ' is-selected' : ''}`}
                aria-selected={scope === 'active' ? selected : undefined}
              >
                <td className="checkbox-cell">
                  {scope === 'active' ? (
                    <input
                      type="checkbox"
                      aria-label={`选择分类 ${category.name}`}
                      checked={selected}
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
                      <div className="ui-sort-actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`上移 ${category.name}`}
                          disabled={working || reorderDisabled || index === 0}
                          onClick={() => onMove(category, -1)}
                        >
                          <ArrowUp aria-hidden="true" size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`下移 ${category.name}`}
                          disabled={
                            working || reorderDisabled || index === categories.length - 1
                          }
                          onClick={() => onMove(category, 1)}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    category.sortOrder
                  )}
                </td>
                <td>
                  {scope === 'active' ? (
                    <Button
                      variant="ghost"
                      size="compact"
                      disabled={working}
                      aria-label={`${category.isEnabled ? '停用' : '启用'}分类 ${category.name}`}
                      onClick={() => onToggleEnabled(category)}
                    >
                      <AdminStatusBadge tone={category.isEnabled ? 'success' : 'default'}>
                        {category.isEnabled ? '已启用' : '已停用'}
                      </AdminStatusBadge>
                    </Button>
                  ) : (
                    <AdminStatusBadge tone="warning">已删除</AdminStatusBadge>
                  )}
                </td>
                <td className="actions-cell">
                  <div className="ui-row-actions">
                    {scope === 'active' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="compact"
                          disabled={working}
                          aria-label={`编辑分类 ${category.name}`}
                          onClick={() => onEdit(category)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="compact"
                          className="ui-row-action-danger"
                          disabled={working}
                          aria-label={`删除分类 ${category.name}`}
                          onClick={() => onDelete(category)}
                        >
                          删除
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="compact"
                        disabled={working}
                        aria-label={`恢复分类 ${category.name}`}
                        onClick={() => onRestore(category)}
                      >
                        恢复
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
