import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminApiError, type AdminSection } from './api';
import { CategoryEditorDialog } from './category-management/CategoryEditorDialog';
import { CategoryTable } from './category-management/CategoryTable';
import { DeleteCategoryDialog } from './category-management/DeleteCategoryDialog';
import {
  batchDeleteCategories,
  createCategory,
  deleteCategory,
  fetchCategories,
  reorderCategories,
  restoreCategory,
  updateCategory,
  type AdminCategory,
  type CategoryInput,
} from './category-management/api';

type CategoryManagementViewProps = {
  section: AdminSection;
  onSessionExpired: () => void;
};

type CategoryScope = 'active' | 'trash';

const emptyCategoryForm: CategoryInput = {
  name: '',
  sortOrder: 0,
  isEnabled: true,
};

function sortCategories(categories: AdminCategory[]): AdminCategory[] {
  return [...categories].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function describeError(error: unknown): string {
  if (!(error instanceof AdminApiError)) return '分类操作失败，请稍后重试。';
  if (error.code === 'CATEGORY_HAS_PRODUCTS') {
    return `${error.message} 当前引用 ${error.productCount ?? 0} 个产品。`;
  }
  return error.message;
}

export function CategoryManagementView({
  section,
  onSessionExpired,
}: CategoryManagementViewProps) {
  const [scope, setScope] = useState<CategoryScope>('active');
  const [activeCategories, setActiveCategories] = useState<AdminCategory[]>([]);
  const [trashCategories, setTrashCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<CategoryInput>(emptyCategoryForm);
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
      setActiveCategories(await fetchCategories(section.id, 'active'));
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
    setTrashCategories([]);
    setErrorMessage('');
    setSuccessMessage('');
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    setSelectedIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  const sourceCategories = scope === 'active' ? activeCategories : trashCategories;
  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword
      ? sourceCategories.filter((category) => category.name.toLowerCase().includes(keyword))
      : sourceCategories;
  }, [search, sourceCategories]);

  const allVisibleSelected =
    filteredCategories.length > 0 &&
    filteredCategories.every((category) => selectedIds.has(category.id));
  const reorderBlocked = scope !== 'active' || Boolean(search.trim());

  async function changeScope(nextScope: CategoryScope) {
    setScope(nextScope);
    if (nextScope === 'trash') {
      setLoading(true);
      try {
        setTrashCategories(await fetchCategories(section.id, 'trash'));
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    }
  }

  function openCreateEditor() {
    const sortOrder = activeCategories.length
      ? Math.max(...activeCategories.map((category) => category.sortOrder)) + 10
      : 0;
    setEditingCategory(null);
    setForm({ ...emptyCategoryForm, sortOrder });
    setErrorMessage('');
    setSuccessMessage('');
    setEditorOpen(true);
  }

  function openEditEditor(category: AdminCategory) {
    setEditingCategory(category);
    setForm({
      name: category.name,
      sortOrder: category.sortOrder,
      isEnabled: category.isEnabled,
    });
    setErrorMessage('');
    setSuccessMessage('');
    setEditorOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (editingCategory) {
        const updated = await updateCategory(section.id, editingCategory.id, form);
        setActiveCategories((current) =>
          sortCategories(current.map((item) => (item.id === updated.id ? updated : item))),
        );
        setSuccessMessage(`分类“${updated.name}”已更新。`);
      } else {
        const created = await createCategory(section.id, form);
        setActiveCategories((current) => sortCategories([...current, created]));
        setSuccessMessage(`分类“${created.name}”已创建。`);
      }
      setEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(category: AdminCategory) {
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const updated = await updateCategory(section.id, category.id, {
        name: category.name,
        sortOrder: category.sortOrder,
        isEnabled: !category.isEnabled,
      });
      setActiveCategories((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccessMessage(updated.isEnabled ? '分类已启用。' : '分类已停用。');
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function moveCategory(category: AdminCategory, direction: -1 | 1) {
    if (reorderBlocked) return;
    const ordered = sortCategories(activeCategories).map((item) => ({ ...item }));
    const currentIndex = ordered.findIndex((item) => item.id === category.id);
    const targetIndex = currentIndex + direction;
    const current = ordered[currentIndex];
    const target = ordered[targetIndex];
    if (!current || !target) return;

    const currentOrder = current.sortOrder;
    current.sortOrder = target.sortOrder;
    target.sortOrder = currentOrder;

    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await reorderCategories(section.id, [
        { id: current.id, sortOrder: current.sortOrder },
        { id: target.id, sortOrder: target.sortOrder },
      ]);
      setActiveCategories(sortCategories(ordered));
      setSuccessMessage('分类顺序已更新。');
    } catch (error) {
      handleError(error);
      await loadActive();
    } finally {
      setWorking(false);
    }
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0 || working) return;

    const deletingIds = [...pendingDeleteIds];
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const firstId = deletingIds[0];
      if (deletingIds.length === 1 && firstId) {
        await deleteCategory(section.id, firstId);
      } else {
        await batchDeleteCategories(section.id, deletingIds);
      }
      setActiveCategories((current) =>
        current.filter((category) => !deletingIds.includes(category.id)),
      );
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setSuccessMessage(`已将 ${deletingIds.length} 个分类移入回收站。`);
    } catch (error) {
      setPendingDeleteIds([]);
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore(category: AdminCategory) {
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const restored = await restoreCategory(section.id, category.id);
      setTrashCategories((current) => current.filter((item) => item.id !== category.id));
      setActiveCategories((current) => sortCategories([...current, restored]));
      setSuccessMessage(`分类“${restored.name}”已恢复。`);
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredCategories.forEach((category) => {
        if (allVisibleSelected) next.delete(category.id);
        else next.add(category.id);
      });
      return next;
    });
  }

  return (
    <section className="category-management" aria-labelledby="category-management-title">
      <div className="category-management-toolbar">
        <div>
          <p>当前分区</p>
          <h2 id="category-management-title">{section.name} · 分类管理</h2>
          <span>分类仅在“{section.name}”分区内使用，产品录入时只能选择本分区分类。</span>
        </div>
        <button className="primary-button" type="button" onClick={openCreateEditor}>
          新增分类
        </button>
      </div>

      <div className="category-filter-bar">
        <div className="scope-tabs" role="tablist" aria-label="分类状态">
          <button
            type="button"
            className={scope === 'active' ? 'is-active' : undefined}
            onClick={() => void changeScope('active')}
          >
            当前分类 <span>{activeCategories.length}</span>
          </button>
          <button
            type="button"
            className={scope === 'trash' ? 'is-active' : undefined}
            onClick={() => void changeScope('trash')}
          >
            回收站 <span>{trashCategories.length}</span>
          </button>
        </div>

        <label className="category-search">
          <span>搜索</span>
          <input
            type="search"
            value={search}
            placeholder="分类名称"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {!editorOpen && errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
      {successMessage ? <div className="notice notice-success" role="status">{successMessage}</div> : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 个分类</span>
          <button
            type="button"
            className="danger-button"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </button>
        </div>
      ) : null}

      <CategoryTable
        scope={scope}
        categories={filteredCategories}
        loading={loading}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        working={working}
        reorderDisabled={reorderBlocked}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onToggleEnabled={(category) => void toggleEnabled(category)}
        onEdit={openEditEditor}
        onDelete={(category) => setPendingDeleteIds([category.id])}
        onRestore={(category) => void handleRestore(category)}
        onMove={(category, direction) => void moveCategory(category, direction)}
      />

      {editorOpen ? (
        <CategoryEditorDialog
          sectionName={section.name}
          editingCategory={editingCategory}
          form={form}
          saving={saving}
          errorMessage={errorMessage}
          onFormChange={(nextForm) => {
            setForm(nextForm);
            setErrorMessage('');
          }}
          onClose={() => setEditorOpen(false)}
          onSubmit={(event) => void handleSave(event)}
        />
      ) : null}

      {pendingDeleteIds.length > 0 ? (
        <DeleteCategoryDialog
          count={pendingDeleteIds.length}
          working={working}
          onCancel={() => setPendingDeleteIds([])}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </section>
  );
}
