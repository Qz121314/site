import type { AdminSection, SectionScope } from '../api';
import { brandingAssetPreviewUrl } from '../branding-media/api';

type SectionTableProps = {
  scope: SectionScope;
  sections: AdminSection[];
  loading: boolean;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  working: boolean;
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
  onToggleSelect,
  onToggleSelectAll,
  onToggleEnabled,
  onEdit,
  onDelete,
  onRestore,
  onMove,
}: SectionTableProps) {
  return (
    <div className="section-table-wrap">
      <table className="section-table">
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
          {sections.map((section, index) => (
            <tr key={section.id}>
              <td className="checkbox-cell">
                {scope === 'active' ? (
                  <input
                    type="checkbox"
                    aria-label={`选择 ${section.name}`}
                    checked={selectedIds.has(section.id)}
                    onChange={() => onToggleSelect(section.id)}
                  />
                ) : null}
              </td>
              <td>
                <div className="section-identity">
                  <span className={`section-icon${section.iconAssetId ? ' has-image' : ''}`} aria-hidden="true">
                    {section.iconAssetId ? (
                      <img src={brandingAssetPreviewUrl(section.iconAssetId)} alt="" />
                    ) : (
                      section.iconValue ?? '◈'
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
                    <div>
                      <button
                        type="button"
                        aria-label={`上移 ${section.name}`}
                        disabled={working || index === 0}
                        onClick={() => onMove(section, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`下移 ${section.name}`}
                        disabled={working || index === sections.length - 1}
                        onClick={() => onMove(section, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                </div>
              </td>
              <td>
                {scope === 'trash' ? (
                  <span className="status-pill is-deleted">已删除</span>
                ) : (
                  <button
                    className={`status-pill ${section.isEnabled ? 'is-enabled' : 'is-disabled'}`}
                    type="button"
                    disabled={working}
                    onClick={() => onToggleEnabled(section)}
                  >
                    {section.isEnabled ? '已启用' : '已停用'}
                  </button>
                )}
              </td>
              <td>
                <span className="relation-count">产品 {section.productCount}</span>
                <span className="relation-count">转化 {section.conversionMethodCount}</span>
              </td>
              <td className="actions-cell">
                {scope === 'trash' ? (
                  <button type="button" disabled={working} onClick={() => onRestore(section)}>
                    恢复
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => onEdit(section)}>
                      编辑
                    </button>
                    <button
                      className="text-danger"
                      type="button"
                      disabled={working}
                      onClick={() => onDelete(section)}
                    >
                      删除
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {loading || sections.length === 0 ? (
        <div className="section-table-empty">
          <strong>{loading ? '正在读取回收站…' : '没有符合条件的分区'}</strong>
          <p>
            {scope === 'active'
              ? '创建第一个分区后会立即生成左侧业务菜单。'
              : '已删除分区会显示在这里。'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
