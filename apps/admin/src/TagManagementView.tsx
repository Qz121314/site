import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminApiError, type AdminSection } from './api';
import { Button } from './components/ui/button';
import {
  AdminSearchField,
  AdminSelectionBar,
  AdminToolbar,
} from './components/ui/management-workspace';
import {
  toggleSelection,
  toggleVisibleSelection,
} from './components/ui/management-selection';
import {
  AdminSegmentedControl,
  AdminSegmentedItem,
} from './components/ui/segmented-control';
import { AdminDialog } from './components/ui/dialog';
import { AdminFeedbackState } from './components/ui/feedback-state';
import { AdminStatusBadge } from './components/ui/status-badge';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  batchDeleteProductTags,
  createProductTag,
  deleteProductTag,
  fetchProductTags,
  reorderProductTags,
  restoreProductTag,
  updateProductTag,
  type AdminProductTag,
  type ProductTagInput,
} from './tag-management/api';

type TagManagementViewProps = {
  section: AdminSection;
  onSessionExpired: () => void;
};

type TagScope = 'active' | 'trash';

const emptyForm: ProductTagInput = { name: '', sortOrder: 0, isEnabled: true };

function sortTags(tags: AdminProductTag[]) {
  return [...tags].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function isSessionError(error: unknown) {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function describeError(error: unknown) {
  if (!(error instanceof AdminApiError)) return '标签操作失败，请稍后重试。';
  if (error.code === 'PRODUCT_TAG_HAS_PRODUCTS') {
    return `${error.message} 当前引用 ${error.productCount ?? 0} 个产品。`;
  }
  return error.message;
}

export function TagManagementView({ section, onSessionExpired }: TagManagementViewProps) {
  const [scope, setScope] = useState<TagScope>('active');
  const [activeTags, setActiveTags] = useState<AdminProductTag[]>([]);
  const [trashTags, setTrashTags] = useState<AdminProductTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTag, setEditingTag] = useState<AdminProductTag | null>(null);
  const [form, setForm] = useState<ProductTagInput>(emptyForm);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleError = useCallback(
    (error: unknown) => {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(describeError(error));
    },
    [onSessionExpired],
  );

  const loadActive = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      setActiveTags(sortTags(await fetchProductTags(section.id, 'active')));
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError, section.id]);

  useEffect(() => {
    setScope('active');
    setSearch('');
    setSelectedIds(new Set());
    setTrashTags([]);
    setErrorMessage('');
    setSuccessMessage('');
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    setSelectedIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  const sourceTags = scope === 'active' ? activeTags : trashTags;
  const filteredTags = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword
      ? sourceTags.filter((tag) => tag.name.toLowerCase().includes(keyword))
      : sourceTags;
  }, [search, sourceTags]);

  const allVisibleSelected =
    filteredTags.length > 0 && filteredTags.every((tag) => selectedIds.has(tag.id));
  const reorderBlocked = scope !== 'active' || Boolean(search.trim());

  async function changeScope(nextScope: TagScope) {
    setScope(nextScope);
    if (nextScope !== 'trash') return;
    setLoading(true);
    try {
      setTrashTags(sortTags(await fetchProductTags(section.id, 'trash')));
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateEditor() {
    const sortOrder = activeTags.length
      ? Math.max(...activeTags.map((tag) => tag.sortOrder)) + 10
      : 0;
    setEditingTag(null);
    setForm({ ...emptyForm, sortOrder });
    setEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function openEditEditor(tag: AdminProductTag) {
    setEditingTag(tag);
    setForm({ name: tag.name, sortOrder: tag.sortOrder, isEnabled: tag.isEnabled });
    setEditorOpen(true);
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function saveTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (editingTag) {
        const updated = await updateProductTag(section.id, editingTag.id, form);
        setActiveTags((current) =>
          sortTags(current.map((tag) => (tag.id === updated.id ? updated : tag))),
        );
        setSuccessMessage(`标签“${updated.name}”已更新。`);
      } else {
        const created = await createProductTag(section.id, form);
        setActiveTags((current) => sortTags([...current, created]));
        setSuccessMessage(`标签“${created.name}”已创建。`);
      }
      setEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(tag: AdminProductTag) {
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const updated = await updateProductTag(section.id, tag.id, {
        name: tag.name,
        sortOrder: tag.sortOrder,
        isEnabled: !tag.isEnabled,
      });
      setActiveTags((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccessMessage(updated.isEnabled ? '标签已启用。' : '标签已停用。');
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function moveTag(tag: AdminProductTag, direction: -1 | 1) {
    if (reorderBlocked) return;
    const ordered = sortTags(activeTags).map((item) => ({ ...item }));
    const index = ordered.findIndex((item) => item.id === tag.id);
    const targetIndex = index + direction;
    const current = ordered[index];
    const target = ordered[targetIndex];
    if (!current || !target) return;
    const order = current.sortOrder;
    current.sortOrder = target.sortOrder;
    target.sortOrder = order;
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await reorderProductTags(section.id, [
        { id: current.id, sortOrder: current.sortOrder },
        { id: target.id, sortOrder: target.sortOrder },
      ]);
      setActiveTags(sortTags(ordered));
      setSuccessMessage('标签顺序已更新。');
    } catch (error) {
      handleError(error);
      await loadActive();
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0 || working) return;
    const ids = [...pendingDeleteIds];
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (ids.length === 1 && ids[0]) await deleteProductTag(section.id, ids[0]);
      else await batchDeleteProductTags(section.id, ids);
      setActiveTags((current) => current.filter((tag) => !ids.includes(tag.id)));
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setSuccessMessage(`已将 ${ids.length} 个标签移入回收站。`);
    } catch (error) {
      setPendingDeleteIds([]);
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function restoreTag(tag: AdminProductTag) {
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const restored = await restoreProductTag(section.id, tag.id);
      setTrashTags((current) => current.filter((item) => item.id !== tag.id));
      setActiveTags((current) => sortTags([...current, restored]));
      setSuccessMessage(`标签“${restored.name}”已恢复。`);
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => toggleSelection(current, id));
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      toggleVisibleSelection(
        current,
        filteredTags.map((tag) => tag.id),
        allVisibleSelected,
      ),
    );
  }

  return (
    <section
      className="category-management tag-management"
      aria-labelledby="tag-management-title"
    >
      <AdminToolbar
        aria-label={`${section.name} 标签管理工具栏`}
        leading={
          <AdminSegmentedControl ariaLabel="标签状态">
            <AdminSegmentedItem
              selected={scope === 'active'}
              onClick={() => void changeScope('active')}
            >
              当前标签 {activeTags.length}
            </AdminSegmentedItem>
            <AdminSegmentedItem
              selected={scope === 'trash'}
              onClick={() => void changeScope('trash')}
            >
              回收站 {trashTags.length}
            </AdminSegmentedItem>
          </AdminSegmentedControl>
        }
        trailing={
          <Button variant="primary" onClick={openCreateEditor}>
            新增标签
          </Button>
        }
      >
        <AdminSearchField
          label="搜索标签"
          value={search}
          placeholder="标签名称"
          onChange={(event) => setSearch(event.target.value)}
        />
      </AdminToolbar>

      {!editorOpen && errorMessage ? (
        <div className="notice notice-error" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="notice notice-success" role="status">
          {successMessage}
        </div>
      ) : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <AdminSelectionBar count={selectedIds.size} noun="标签">
          <Button
            variant="danger"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </Button>
        </AdminSelectionBar>
      ) : null}

      {loading ? (
        <AdminFeedbackState kind="loading" title="正在读取标签…" />
      ) : filteredTags.length === 0 ? (
        <AdminFeedbackState
          kind="empty"
          title={scope === 'active' ? '当前分区还没有标签' : '回收站为空'}
          description={
            scope === 'active'
              ? '使用上方“新增标签”开始录入。'
              : '已删除标签会显示在这里。'
          }
        />
      ) : (
        <div className="category-table-wrap ui-data-table-wrap">
          <table className="category-table ui-data-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  {scope === 'active' ? (
                    <input
                      type="checkbox"
                      aria-label="全选当前标签"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                    />
                  ) : null}
                </th>
                <th>标签名称</th>
                <th>产品引用</th>
                <th>排序</th>
                <th>状态</th>
                <th className="actions-cell">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTags.map((tag, index) => (
                <tr
                  key={tag.id}
                  className={`ui-data-row${selectedIds.has(tag.id) ? ' is-selected' : ''}`}
                  aria-selected={scope === 'active' ? selectedIds.has(tag.id) : undefined}
                >
                  <td className="checkbox-cell">
                    {scope === 'active' ? (
                      <input
                        type="checkbox"
                        aria-label={`选择标签 ${tag.name}`}
                        checked={selectedIds.has(tag.id)}
                        onChange={() => toggleSelect(tag.id)}
                      />
                    ) : null}
                  </td>
                  <td>
                    <div className="category-name-cell">
                      <strong>{tag.name}</strong>
                      <small>{tag.id.slice(0, 8)}</small>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        tag.productCount > 0
                          ? 'category-reference is-used'
                          : 'category-reference'
                      }
                    >
                      {tag.productCount} 个产品
                    </span>
                  </td>
                  <td>
                    {scope === 'active' ? (
                      <div className="sort-controls">
                        <span>{tag.sortOrder}</span>
                        <div className="ui-sort-actions">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`上移 ${tag.name}`}
                            disabled={working || reorderBlocked || index === 0}
                            onClick={() => void moveTag(tag, -1)}
                          >
                            <ArrowUp aria-hidden="true" size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`下移 ${tag.name}`}
                            disabled={
                              working ||
                              reorderBlocked ||
                              index === filteredTags.length - 1
                            }
                            onClick={() => void moveTag(tag, 1)}
                          >
                            <ArrowDown aria-hidden="true" size={15} />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      tag.sortOrder
                    )}
                  </td>
                  <td>
                    {scope === 'active' ? (
                      <Button
                        variant="ghost"
                        size="compact"
                        disabled={working}
                        aria-label={`${tag.isEnabled ? '停用' : '启用'}标签 ${tag.name}`}
                        onClick={() => void toggleEnabled(tag)}
                      >
                        <AdminStatusBadge tone={tag.isEnabled ? 'success' : 'default'}>
                          {tag.isEnabled ? '已启用' : '已停用'}
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
                            aria-label={`编辑标签 ${tag.name}`}
                            onClick={() => openEditEditor(tag)}
                          >
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="compact"
                            className="ui-row-action-danger"
                            disabled={working}
                            aria-label={`删除标签 ${tag.name}`}
                            onClick={() => setPendingDeleteIds([tag.id])}
                          >
                            删除
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          size="compact"
                          disabled={working}
                          aria-label={`恢复标签 ${tag.name}`}
                          onClick={() => void restoreTag(tag)}
                        >
                          恢复
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminDialog
        open={editorOpen}
        title={editingTag ? '编辑标签' : '新增标签'}
        eyebrow={`${section.name} · 标签`}
        onClose={() => setEditorOpen(false)}
        closeDisabled={saving}
        size="small"
      >
        <form className="category-editor-form" onSubmit={(event) => void saveTag(event)}>
          {errorMessage ? (
            <div className="notice notice-error" role="alert">
              {errorMessage}
            </div>
          ) : null}
          <label>
            <span>标签名称</span>
            <input
              type="text"
              autoFocus
              required
              maxLength={80}
              value={form.name}
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }));
                setErrorMessage('');
              }}
            />
          </label>
          <label>
            <span>排序</span>
            <input
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              required
              value={form.sortOrder}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  sortOrder: Number(event.target.value),
                }));
                setErrorMessage('');
              }}
            />
          </label>
          <label className="category-enabled-field">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => {
                setForm((current) => ({ ...current, isEnabled: event.target.checked }));
                setErrorMessage('');
              }}
            />
            <span>启用标签</span>
          </label>
          <div className="admin-dialog-actions">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setEditorOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              保存
            </Button>
          </div>
        </form>
      </AdminDialog>

      <AdminDialog
        open={pendingDeleteIds.length > 0}
        title={`确认删除 ${pendingDeleteIds.length} 个标签？`}
        eyebrow="删除标签"
        description="正在被产品引用的标签不会被删除。"
        role="alertdialog"
        onClose={() => setPendingDeleteIds([])}
        closeDisabled={working}
        size="small"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={working}
              onClick={() => setPendingDeleteIds([])}
            >
              取消
            </Button>
            <Button
              variant="danger"
              loading={working}
              onClick={() => void confirmDelete()}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p>删除后标签会进入回收站，现有服务端引用保护规则保持不变。</p>
      </AdminDialog>
    </section>
  );
}
