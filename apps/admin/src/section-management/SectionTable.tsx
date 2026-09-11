import { ArrowDown, ArrowUp } from 'lucide-react';
import type { AdminSection, SectionScope } from '../api';
import { brandingAssetPreviewUrl } from '../branding-media/api';
import { Button } from '../components/ui/button';
import { AdminFeedbackState } from '../components/ui/feedback-state';
import { AdminStatusBadge } from '../components/ui/status-badge';

type SectionTableProps = {
  scope: SectionScope;
  sections: AdminSection[];
  loading: boolean;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  working: boolean;
  reorderDisabled: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleEnabled: (section: AdminSection) => void;
  onEdit: (section: AdminSection) => void;
  onDelete: (section: AdminSection) => void;
  onRestore: (section: AdminSection) => void;
  onMove: (section: AdminSection, direction: -1 | 1) => void;
};

export function SectionTable({
  scope,
  sections,
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
}: SectionTableProps) {
  if (loading) {
    return <AdminFeedbackState kind="loading" title="正在读取回收站…" />;
  }

  if (sections.length === 0) {
    return (
      <AdminFeedbackState
        kind="empty"
        title="没有符合条件的分区"
        description={
          scope === 'active'
            ? '创建第一个分区后会立即生成左侧业务菜单。'
            : '已删除分区会显示在这里。'
        }
      />
    );
  }

  return (
    <div className="section-table-wrap ui-data-table-wrap">
      <table className="section-table ui-data-table">
        <thead>
          <tr>
            <th className="checkbox-cell">
              {scope === 'active' ? (
                <input
                  type="checkbox"
                  aria-label="选择当前页全部分区"
                  checked={allVisibleSelected}
                  onChange={onToggleSelectAll}
                />
              ) : null}
            </th>
            <th>分区</th>
            <th>排序</th>
            <th>状态</th>
            <th>关联内容</th>
            <th className="actions-cell">操作</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section, index) => {
            const selected = selectedIds.has(section.id);
            return (
              <tr
                key={section.id}
                className={`ui-data-row${selected ? ' is-selected' : ''}`}
                aria-selected={scope === 'active' ? selected : undefined}
              >
                <td className="checkbox-cell">
                  {scope === 'active' ? (
                    <input
                      type="checkbox"
                      aria-label={`选择 ${section.name}`}
                      checked={selected}
                      onChange={() => onToggleSelect(section.id)}
                    />
                  ) : null}
                </td>
                <td>
                  <div className="section-identity">
                    <span
                      className={`section-icon${section.iconAssetId ? ' has-image' : ''}`}
                      aria-hidden="true"
                    >
                      {section.iconAssetId ? (
                        <img src={brandingAssetPreviewUrl(section.iconAssetId)} alt="" />
                      ) : (
                        (section.iconValue ?? '◈')
                      )}
                    </span>
                    <div>
                      <strong>{section.name}</strong>
                      <small>/{section.slug}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="sort-controls">
                    <strong>{section.sortOrder}</strong>
                    {scope === 'active' ? (
                      <div className="ui-sort-actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`上移 ${section.name}`}
                          disabled={working || reorderDisabled || index === 0}
                          onClick={() => onMove(section, -1)}
                        >
                          <ArrowUp aria-hidden="true" size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`下移 ${section.name}`}
                          disabled={
                            working || reorderDisabled || index === sections.length - 1
                          }
                          onClick={() => onMove(section, 1)}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>
                  {scope === 'trash' ? (
                    <AdminStatusBadge tone="warning">已删除</AdminStatusBadge>
                  ) : (
                    <div className="section-status-stack">
                      <div className="section-status-line">
                        <span className="section-status-label">业务状态</span>
                        <Button
                          variant="ghost"
                          size="compact"
                          disabled={working}
                          aria-label={`${section.isEnabled ? '停用' : '启用'}分区 ${section.name}`}
                          onClick={() => onToggleEnabled(section)}
                        >
                          <AdminStatusBadge
                            tone={section.isEnabled ? 'success' : 'default'}
                          >
                            {section.isEnabled ? '已启用' : '已停用'}
                          </AdminStatusBadge>
                        </Button>
                      </div>
                      <div className="section-status-line">
                        <span className="section-status-label">前端展示</span>
                        <AdminStatusBadge
                          tone={section.isVisible ? 'default' : 'warning'}
                        >
                          {section.isVisible ? '显示' : '隐藏'}
                        </AdminStatusBadge>
                      </div>
                    </div>
                  )}
                </td>
                <td>
                  <span className="relation-count">产品 {section.productCount}</span>
                  <span className="relation-count">
                    转化 {section.conversionMethodCount}
                  </span>
                </td>
                <td className="actions-cell">
                  <div className="ui-row-actions">
                    {scope === 'trash' ? (
                      <Button
                        variant="secondary"
                        size="compact"
                        disabled={working}
                        aria-label={`恢复分区 ${section.name}`}
                        onClick={() => onRestore(section)}
                      >
                        恢复
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="compact"
                          aria-label={`编辑分区 ${section.name}`}
                          onClick={() => onEdit(section)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="compact"
                          className="ui-row-action-danger"
                          disabled={working}
                          aria-label={`删除分区 ${section.name}`}
                          onClick={() => onDelete(section)}
                        >
                          删除
                        </Button>
                      </>
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
