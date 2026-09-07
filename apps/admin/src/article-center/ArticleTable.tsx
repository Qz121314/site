import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AdminStatusBadge } from '../components/ui/status-badge';
import type { AdminArticle, ArticleScope } from './api';

type ArticleTableProps = {
  scope: ArticleScope;
  articles: AdminArticle[];
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  working: boolean;
  reorderDisabled: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleStatus: (article: AdminArticle) => void;
  onEdit: (article: AdminArticle) => void;
  onDelete: (article: AdminArticle) => void;
  onRestore: (article: AdminArticle) => void;
  onMove: (article: AdminArticle, direction: -1 | 1) => void;
};

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export function ArticleTable({
  scope,
  articles,
  selectedIds,
  allVisibleSelected,
  working,
  reorderDisabled,
  onToggleSelect,
  onToggleSelectAll,
  onToggleStatus,
  onEdit,
  onDelete,
  onRestore,
  onMove,
}: ArticleTableProps) {
  return (
    <div className="article-table-wrap ui-data-table-wrap">
      <table className="article-table ui-data-table">
        <thead>
          <tr>
            <th className="checkbox-cell">
              {scope === 'active' ? (
                <input
                  type="checkbox"
                  aria-label="全选当前文章"
                  checked={allVisibleSelected}
                  onChange={onToggleSelectAll}
                />
              ) : null}
            </th>
            <th>标题</th>
            <th>状态</th>
            <th>排序</th>
            <th>更新时间</th>
            <th className="actions-cell">操作</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article, index) => {
            const selected = selectedIds.has(article.id);
            return (
              <tr
                key={article.id}
                className={`ui-data-row${selected ? ' is-selected' : ''}`}
                aria-selected={scope === 'active' ? selected : undefined}
              >
                <td className="checkbox-cell" data-label="选择">
                  {scope === 'active' ? (
                    <input
                      type="checkbox"
                      aria-label={`选择文章 ${article.title}`}
                      checked={selected}
                      onChange={() => onToggleSelect(article.id)}
                    />
                  ) : null}
                </td>
                <td data-label="标题">
                  <div className="article-title-cell">
                    <strong>{article.title}</strong>
                  </div>
                </td>
                <td data-label="状态">
                  {scope === 'active' ? (
                    <Button
                      variant="ghost"
                      size="compact"
                      disabled={working}
                      aria-label={`${article.isActive ? '停用' : '启用'}文章 ${article.title}`}
                      onClick={() => onToggleStatus(article)}
                    >
                      <AdminStatusBadge tone={article.isActive ? 'success' : 'default'}>
                        {article.isActive ? '启用' : '停用'}
                      </AdminStatusBadge>
                    </Button>
                  ) : (
                    <AdminStatusBadge tone="warning">已删除</AdminStatusBadge>
                  )}
                </td>
                <td data-label="排序">
                  {scope === 'active' ? (
                    <div className="article-sort-controls">
                      <span>{article.sortOrder}</span>
                      <div className="ui-sort-actions">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`上移 ${article.title}`}
                          disabled={working || reorderDisabled || index === 0}
                          onClick={() => onMove(article, -1)}
                        >
                          <ArrowUp aria-hidden="true" size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`下移 ${article.title}`}
                          disabled={
                            working || reorderDisabled || index === articles.length - 1
                          }
                          onClick={() => onMove(article, 1)}
                        >
                          <ArrowDown aria-hidden="true" size={15} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    article.sortOrder
                  )}
                </td>
                <td data-label="更新时间">{formatUpdatedAt(article.updatedAt)}</td>
                <td className="actions-cell" data-label="操作">
                  <div className="ui-row-actions">
                    {scope === 'active' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="compact"
                          disabled={working}
                          onClick={() => onEdit(article)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="compact"
                          className="ui-row-action-danger"
                          disabled={working}
                          onClick={() => onDelete(article)}
                        >
                          删除
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="compact"
                        disabled={working}
                        onClick={() => onRestore(article)}
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
