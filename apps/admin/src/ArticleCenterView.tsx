import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { AdminApiError } from './api';
import { ArticleEditorDialog } from './article-center/ArticleEditorDialog';
import { ArticleTable } from './article-center/ArticleTable';
import { DeleteArticleDialog } from './article-center/DeleteArticleDialog';
import {
  batchDeleteArticles,
  createArticle,
  deleteArticle,
  fetchArticles,
  reorderArticles,
  restoreArticle,
  updateArticle,
  type AdminArticle,
  type ArticleInput,
  type ArticleScope,
} from './article-center/api';
import { Button } from './components/ui/button';
import { AdminFeedbackState } from './components/ui/feedback-state';
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

type ArticleCenterViewProps = {
  onSessionExpired: () => void;
};

type ArticleStatusFilter = 'all' | 'active' | 'inactive';
type ArticleSortMode = 'default' | 'title' | 'updated';

const emptyArticleForm: ArticleInput = {
  title: '',
  body: '',
  sortOrder: 0,
  isActive: true,
};

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function describeArticleError(error: unknown): string {
  if (!(error instanceof AdminApiError)) return '文章操作失败，请稍后重试。';
  return error.message.replaceAll('FAQ', '文章');
}

function sortByDefault(articles: AdminArticle[]): AdminArticle[] {
  return [...articles].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.title.localeCompare(right.title, 'zh-CN'),
  );
}

export function ArticleCenterView({ onSessionExpired }: ArticleCenterViewProps) {
  const [scope, setScope] = useState<ArticleScope>('active');
  const [activeArticles, setActiveArticles] = useState<AdminArticle[]>([]);
  const [trashArticles, setTrashArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatusFilter>('all');
  const [sortMode, setSortMode] = useState<ArticleSortMode>('default');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingArticle, setEditingArticle] =
    useState<AdminArticle | null>(null);
  const [form, setForm] = useState<ArticleInput>(emptyArticleForm);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
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
      setErrorMessage(describeArticleError(error));
    },
    [onSessionExpired],
  );

  const loadScope = useCallback(
    async (nextScope: ArticleScope) => {
      setLoading(true);
      setLoadError('');
      try {
        const articles = await fetchArticles(nextScope);
        if (nextScope === 'active') setActiveArticles(articles);
        else setTrashArticles(articles);
      } catch (error) {
        if (isSessionError(error)) {
          onSessionExpired();
        } else {
          setLoadError(describeArticleError(error));
        }
      } finally {
        setLoading(false);
      }
    },
    [onSessionExpired],
  );

  useEffect(() => {
    void loadScope('active');
  }, [loadScope]);

  const sourceArticles = scope === 'active' ? activeArticles : trashArticles;
  const visibleArticles = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('zh-CN');
    const filtered = sourceArticles.filter((article) => {
      const normalizedTitle = article.title.toLocaleLowerCase('zh-CN');
      if (keyword && !normalizedTitle.includes(keyword)) return false;
      if (
        scope === 'active' &&
        statusFilter === 'active' &&
        !article.isActive
      ) {
        return false;
      }
      if (
        scope === 'active' &&
        statusFilter === 'inactive' &&
        article.isActive
      ) {
        return false;
      }
      return true;
    });

    if (sortMode === 'title') {
      return [...filtered].sort((left, right) =>
        left.title.localeCompare(right.title, 'zh-CN'),
      );
    }
    if (sortMode === 'updated') {
      return [...filtered].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    }
    return sortByDefault(filtered);
  }, [scope, search, sortMode, sourceArticles, statusFilter]);

  const allVisibleSelected =
    visibleArticles.length > 0 &&
    visibleArticles.every((article) => selectedIds.has(article.id));
  const reorderDisabled =
    scope !== 'active' ||
    Boolean(search.trim()) ||
    statusFilter !== 'all' ||
    sortMode !== 'default';

  function clearMessages() {
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function changeScope(nextScope: ArticleScope) {
    if (nextScope === scope) return;
    setScope(nextScope);
    setSearch('');
    setStatusFilter('all');
    setSortMode('default');
    setSelectedIds(new Set());
    clearMessages();
    if (nextScope === 'trash') await loadScope('trash');
  }

  function openCreateEditor() {
    const sortOrder = activeArticles.length
      ? Math.max(...activeArticles.map((article) => article.sortOrder)) + 10
      : 0;
    setEditingArticle(null);
    setForm({ ...emptyArticleForm, sortOrder });
    setPreviewing(false);
    clearMessages();
    setEditorOpen(true);
  }

  function openEditEditor(article: AdminArticle) {
    setEditingArticle(article);
    setForm({
      title: article.title,
      body: article.body,
      sortOrder: article.sortOrder,
      isActive: article.isActive,
    });
    setPreviewing(false);
    clearMessages();
    setEditorOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (editingArticle) {
        const updated = await updateArticle(editingArticle.id, form);
        setActiveArticles((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSuccessMessage(`文章“${updated.title}”已更新。`);
      } else {
        const created = await createArticle(form);
        setActiveArticles((current) => [...current, created]);
        setSuccessMessage(`文章“${created.title}”已创建。`);
      }
      setEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(article: AdminArticle) {
    setWorking(true);
    clearMessages();
    try {
      const updated = await updateArticle(article.id, {
        title: article.title,
        body: article.body,
        sortOrder: article.sortOrder,
        isActive: !article.isActive,
      });
      setActiveArticles((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccessMessage(updated.isActive ? '文章已启用。' : '文章已停用。');
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function moveArticle(article: AdminArticle, direction: -1 | 1) {
    if (reorderDisabled) return;
    const ordered = sortByDefault(activeArticles).map((item) => ({ ...item }));
    const currentIndex = ordered.findIndex((item) => item.id === article.id);
    const targetIndex = currentIndex + direction;
    const current = ordered[currentIndex];
    const target = ordered[targetIndex];
    if (!current || !target) return;

    const currentOrder = current.sortOrder;
    current.sortOrder = target.sortOrder;
    target.sortOrder = currentOrder;

    setWorking(true);
    clearMessages();
    try {
      await reorderArticles([
        { id: current.id, sortOrder: current.sortOrder },
        { id: target.id, sortOrder: target.sortOrder },
      ]);
      setActiveArticles(ordered);
      setSuccessMessage('文章顺序已更新。');
    } catch (error) {
      handleError(error);
      await loadScope('active');
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0 || working) return;
    const deletingIds = [...pendingDeleteIds];
    setWorking(true);
    clearMessages();
    try {
      const firstId = deletingIds[0];
      if (deletingIds.length === 1 && firstId) await deleteArticle(firstId);
      else await batchDeleteArticles(deletingIds);
      setActiveArticles((current) =>
        current.filter((article) => !deletingIds.includes(article.id)),
      );
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setSuccessMessage(`已将 ${deletingIds.length} 篇文章移入回收站。`);
    } catch (error) {
      setPendingDeleteIds([]);
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore(article: AdminArticle) {
    setWorking(true);
    clearMessages();
    try {
      const restored = await restoreArticle(article.id);
      setTrashArticles((current) =>
        current.filter((item) => item.id !== article.id),
      );
      setActiveArticles((current) => [...current, restored]);
      setSuccessMessage(`文章“${restored.title}”已恢复。`);
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  function updateSearch(value: string) {
    setSearch(value);
    setSelectedIds(new Set());
  }

  function updateStatusFilter(value: ArticleStatusFilter) {
    setStatusFilter(value);
    setSelectedIds(new Set());
  }

  function updateSortMode(value: ArticleSortMode) {
    setSortMode(value);
    setSelectedIds(new Set());
  }

  const pendingDeleteTitles = pendingDeleteIds
    .map((id) => activeArticles.find((article) => article.id === id)?.title)
    .filter((title): title is string => Boolean(title));

  const tableContent = loading ? (
    <AdminFeedbackState kind="loading" title="正在读取文章…" compact />
  ) : loadError ? (
    <AdminFeedbackState
      kind="error"
      title="文章加载失败"
      description={loadError}
      compact
      action={
        <Button variant="secondary" onClick={() => void loadScope(scope)}>
          重试
        </Button>
      }
    />
  ) : sourceArticles.length === 0 ? (
    <AdminFeedbackState
      kind="empty"
      title={scope === 'active' ? '暂无文章' : '回收站为空'}
      description={
        scope === 'active'
          ? '创建第一篇可复用 Markdown 文章。'
          : '已删除的文章会显示在这里。'
      }
      compact
      action={
        scope === 'active' ? (
          <Button variant="primary" onClick={openCreateEditor}>
            新建文章
          </Button>
        ) : undefined
      }
    />
  ) : visibleArticles.length === 0 ? (
    <AdminFeedbackState
      kind="empty"
      title="没有符合筛选条件的文章"
      description="调整标题搜索、状态或排序条件后重试。"
      compact
    />
  ) : (
    <ArticleTable
      scope={scope}
      articles={visibleArticles}
      selectedIds={selectedIds}
      allVisibleSelected={allVisibleSelected}
      working={working}
      reorderDisabled={reorderDisabled}
      onToggleSelect={(id) =>
        setSelectedIds((current) => toggleSelection(current, id))
      }
      onToggleSelectAll={() =>
        setSelectedIds((current) =>
          toggleVisibleSelection(
            current,
            visibleArticles.map((article) => article.id),
            allVisibleSelected,
          ),
        )
      }
      onToggleStatus={(article) => void toggleStatus(article)}
      onEdit={openEditEditor}
      onDelete={(article) => setPendingDeleteIds([article.id])}
      onRestore={(article) => void handleRestore(article)}
      onMove={(article, direction) => void moveArticle(article, direction)}
    />
  );

  return (
    <section className="article-center" aria-label="文章中心管理工作区">
      <AdminToolbar
        aria-label="文章中心管理工具栏"
        leading={
          <AdminSegmentedControl ariaLabel="文章列表范围">
            <AdminSegmentedItem
              selected={scope === 'active'}
              onClick={() => void changeScope('active')}
            >
              当前文章 {activeArticles.length}
            </AdminSegmentedItem>
            <AdminSegmentedItem
              selected={scope === 'trash'}
              onClick={() => void changeScope('trash')}
            >
              回收站 {trashArticles.length}
            </AdminSegmentedItem>
          </AdminSegmentedControl>
        }
        trailing={
          <Button
            variant="primary"
            onClick={openCreateEditor}
            disabled={scope !== 'active'}
          >
            新建文章
          </Button>
        }
      >
        <AdminSearchField
          label="搜索文章标题"
          value={search}
          placeholder="搜索文章标题"
          onChange={(event) => updateSearch(event.target.value)}
        />
        {scope === 'active' ? (
          <AdminSegmentedControl ariaLabel="文章状态筛选">
            <AdminSegmentedItem
              selected={statusFilter === 'all'}
              onClick={() => updateStatusFilter('all')}
            >
              全部
            </AdminSegmentedItem>
            <AdminSegmentedItem
              selected={statusFilter === 'active'}
              onClick={() => updateStatusFilter('active')}
            >
              启用
            </AdminSegmentedItem>
            <AdminSegmentedItem
              selected={statusFilter === 'inactive'}
              onClick={() => updateStatusFilter('inactive')}
            >
              停用
            </AdminSegmentedItem>
          </AdminSegmentedControl>
        ) : null}
        <label className="article-sort-field">
          <span>排序</span>
          <select
            className="ui-input"
            value={sortMode}
            onChange={(event) =>
              updateSortMode(event.target.value as ArticleSortMode)
            }
          >
            <option value="default">默认顺序</option>
            <option value="title">标题</option>
            <option value="updated">更新时间</option>
          </select>
        </label>
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
        <AdminSelectionBar count={selectedIds.size} noun="文章">
          <Button
            variant="danger"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </Button>
        </AdminSelectionBar>
      ) : null}

      {tableContent}

      {editorOpen ? (
        <ArticleEditorDialog
          editingArticle={editingArticle}
          form={form}
          previewing={previewing}
          saving={saving}
          errorMessage={errorMessage}
          onFormChange={(nextForm) => {
            setForm(nextForm);
            setErrorMessage('');
          }}
          onPreviewingChange={setPreviewing}
          onClose={() => setEditorOpen(false)}
          onSubmit={(event) => void handleSave(event)}
        />
      ) : null}

      {pendingDeleteIds.length > 0 ? (
        <DeleteArticleDialog
          titles={pendingDeleteTitles}
          working={working}
          onCancel={() => setPendingDeleteIds([])}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </section>
  );
}
