import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminApiError, type AdminSection } from './api';
import { fetchCategories, type AdminCategory } from './category-management/api';
import {
  fetchConversionGroups,
  type AdminConversionGroup,
} from './conversion-pool/api';
import { DeleteProductDialog } from './product-management/DeleteProductDialog';
import { ProductEditorDialog } from './product-management/ProductEditorDialog';
import { ProductTable } from './product-management/ProductTable';
import {
  batchDeleteProducts,
  createProduct,
  deleteProduct,
  fetchProduct,
  fetchProducts,
  reorderProducts,
  restoreProduct,
  updateProduct,
  uploadProductImage,
  type AdminProduct,
  type AdminProductMedia,
  type ProductInput,
  type ProductStatus,
} from './product-management/api';

type ProductManagementViewProps = {
  section: AdminSection;
  onSessionExpired: () => void;
};

type ProductScope = 'active' | 'trash';
type StatusFilter = 'all' | ProductStatus;

const emptyProductForm: ProductInput = {
  serviceMode: 'offline',
  title: '',
  body: '',
  address: null,
  categoryId: null,
  conversionGroupId: null,
  coverAssetId: null,
  mediaAssetIds: [],
  isFeatured: false,
  featuredOrder: 0,
  sortOrder: 0,
  status: 'draft',
};

function sortProducts(products: AdminProduct[]): AdminProduct[] {
  return [...products].sort(
    (left, right) => left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt),
  );
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function describeError(error: unknown): string {
  if (!(error instanceof AdminApiError)) return '产品操作失败，请稍后重试。';
  return error.field ? `${error.message}（字段：${error.field}）` : error.message;
}

function productToInput(product: AdminProduct): ProductInput {
  return {
    serviceMode: product.serviceMode,
    title: product.title,
    body: product.body,
    address: product.address,
    categoryId: product.categoryId,
    conversionGroupId: product.conversionGroupId,
    coverAssetId: product.coverAssetId,
    mediaAssetIds: product.media.map((item) => item.id),
    isFeatured: product.isFeatured,
    featuredOrder: product.featuredOrder,
    sortOrder: product.sortOrder,
    status: product.status,
  };
}

export function ProductManagementView({
  section,
  onSessionExpired,
}: ProductManagementViewProps) {
  const [scope, setScope] = useState<ProductScope>('active');
  const [activeProducts, setActiveProducts] = useState<AdminProduct[]>([]);
  const [trashProducts, setTrashProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [groups, setGroups] = useState<AdminConversionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyProductForm);
  const [media, setMedia] = useState<AdminProductMedia[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      const [products, nextCategories, nextGroups] = await Promise.all([
        fetchProducts(section.id, 'active'),
        fetchCategories(section.id, 'active'),
        fetchConversionGroups(section.id, 'active'),
      ]);
      setActiveProducts(sortProducts(products));
      setCategories(nextCategories);
      setGroups(nextGroups);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError, section.id]);

  useEffect(() => {
    setScope('active');
    setSearch('');
    setStatusFilter('all');
    setSelectedIds(new Set());
    setTrashProducts([]);
    setEditorOpen(false);
    setErrorMessage('');
    setSuccessMessage('');
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    setSelectedIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  const sourceProducts = scope === 'active' ? activeProducts : trashProducts;
  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return sourceProducts.filter((product) => {
      if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      if (!keyword) return true;
      return `${product.title} ${product.categoryName ?? ''} ${product.conversionGroupName ?? ''}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [search, sourceProducts, statusFilter]);

  const allVisibleSelected =
    filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.has(product.id));

  async function changeScope(nextScope: ProductScope) {
    setScope(nextScope);
    if (nextScope === 'trash') {
      setLoading(true);
      try {
        setTrashProducts(sortProducts(await fetchProducts(section.id, 'trash')));
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    }
  }

  function openCreateEditor() {
    const sortOrder = activeProducts.length
      ? Math.max(...activeProducts.map((product) => product.sortOrder)) + 10
      : 0;
    setEditingProduct(null);
    setForm({ ...emptyProductForm, sortOrder });
    setMedia([]);
    setErrorMessage('');
    setSuccessMessage('');
    setEditorOpen(true);
  }

  async function openEditEditor(product: AdminProduct) {
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const detailed = await fetchProduct(section.id, product.id);
      setEditingProduct(detailed);
      setForm(productToInput(detailed));
      setMedia(detailed.media);
      setEditorOpen(true);
    } catch (error) {
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function handleUpload(files: File[]) {
    const allowed = files.slice(0, Math.max(0, 12 - media.length));
    if (allowed.length === 0) return;
    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');
    let uploadedCount = 0;
    try {
      for (const file of allowed) {
        const result = await uploadProductImage(section.id, file);
        setMedia((current) =>
          current.some((item) => item.id === result.media.id)
            ? current
            : [...current, { ...result.media, sortOrder: current.length * 10 }],
        );
        uploadedCount += 1;
      }
      setSuccessMessage(`已上传 ${uploadedCount} 张产品图片。`);
    } catch (error) {
      handleError(error);
    } finally {
      setUploading(false);
    }
  }

  function removeMedia(id: string) {
    setMedia((current) => current.filter((item) => item.id !== id));
    setForm((current) => ({
      ...current,
      coverAssetId: current.coverAssetId === id ? null : current.coverAssetId,
    }));
  }

  function moveMedia(id: string, direction: -1 | 1) {
    setMedia((current) => {
      const next = [...current];
      const index = next.findIndex((item) => item.id === id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(targetIndex, 0, item);
      return next.map((mediaItem, mediaIndex) => ({ ...mediaItem, sortOrder: mediaIndex * 10 }));
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || uploading) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    const input: ProductInput = {
      ...form,
      mediaAssetIds: media.map((item) => item.id),
      coverAssetId:
        form.coverAssetId && media.some((item) => item.id === form.coverAssetId)
          ? form.coverAssetId
          : null,
    };
    try {
      if (editingProduct) {
        const updated = await updateProduct(section.id, editingProduct.id, input);
        setActiveProducts((current) =>
          sortProducts(current.map((product) => (product.id === updated.id ? updated : product))),
        );
        setSuccessMessage(`产品“${updated.title}”已更新。`);
      } else {
        const created = await createProduct(section.id, input);
        setActiveProducts((current) => sortProducts([...current, created]));
        setSuccessMessage(`产品“${created.title}”已创建。`);
      }
      setEditorOpen(false);
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  }

  async function moveProduct(product: AdminProduct, direction: -1 | 1) {
    const ordered = sortProducts(activeProducts);
    const index = ordered.findIndex((item) => item.id === product.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    const normalized = next.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex * 10 }));

    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await reorderProducts(
        section.id,
        normalized.map((item) => ({ id: item.id, sortOrder: item.sortOrder })),
      );
      setActiveProducts(normalized);
      setSuccessMessage('产品顺序已更新。');
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
        await deleteProduct(section.id, firstId);
      } else {
        await batchDeleteProducts(section.id, deletingIds);
      }
      setActiveProducts((current) =>
        current.filter((product) => !deletingIds.includes(product.id)),
      );
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setSuccessMessage(`已将 ${deletingIds.length} 个产品移入回收站。`);
    } catch (error) {
      setPendingDeleteIds([]);
      handleError(error);
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore(product: AdminProduct) {
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const restored = await restoreProduct(section.id, product.id);
      setTrashProducts((current) => current.filter((item) => item.id !== product.id));
      setActiveProducts((current) => sortProducts([...current, restored]));
      setSuccessMessage(`产品“${restored.title}”已恢复为草稿。`);
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
      filteredProducts.forEach((product) => {
        if (allVisibleSelected) next.delete(product.id);
        else next.add(product.id);
      });
      return next;
    });
  }

  return (
    <section className="product-management" aria-labelledby="product-management-title">
      <div className="product-management-toolbar">
        <div>
          <p>当前分区</p>
          <h2 id="product-management-title">{section.name} · 产品录入</h2>
          <span>产品、分类和转化分组全部限制在“{section.name}”分区内。</span>
        </div>
        <button className="primary-button" type="button" onClick={openCreateEditor}>
          新增产品
        </button>
      </div>

      <div className="product-filter-bar">
        <div className="scope-tabs" role="tablist" aria-label="产品范围">
          <button
            type="button"
            className={scope === 'active' ? 'is-active' : undefined}
            onClick={() => void changeScope('active')}
          >
            当前产品 <span>{activeProducts.length}</span>
          </button>
          <button
            type="button"
            className={scope === 'trash' ? 'is-active' : undefined}
            onClick={() => void changeScope('trash')}
          >
            回收站 <span>{trashProducts.length}</span>
          </button>
        </div>

        <label className="product-search">
          <span>搜索</span>
          <input
            type="search"
            value={search}
            placeholder="标题、分类或转化分组"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="product-status-filter">
          <span>状态</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
        </label>
      </div>

      {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
      {successMessage ? <div className="notice notice-success" role="status">{successMessage}</div> : null}

      {scope === 'active' && selectedIds.size > 0 ? (
        <div className="selection-toolbar">
          <span>已选择 {selectedIds.size} 个产品</span>
          <button
            className="danger-button"
            type="button"
            disabled={working}
            onClick={() => setPendingDeleteIds([...selectedIds])}
          >
            批量删除
          </button>
        </div>
      ) : null}

      <ProductTable
        scope={scope}
        products={filteredProducts}
        loading={loading}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        working={working}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onEdit={(product) => void openEditEditor(product)}
        onDelete={(product) => setPendingDeleteIds([product.id])}
        onRestore={(product) => void handleRestore(product)}
        onMove={(product, direction) => void moveProduct(product, direction)}
      />

      {editorOpen ? (
        <ProductEditorDialog
          sectionName={section.name}
          editingProduct={editingProduct}
          form={form}
          media={media}
          categories={categories}
          groups={groups}
          saving={saving}
          uploading={uploading}
          onFormChange={setForm}
          onUpload={(files) => void handleUpload(files)}
          onRemoveMedia={removeMedia}
          onMoveMedia={moveMedia}
          onSetCover={(id) => setForm((current) => ({ ...current, coverAssetId: id }))}
          onClose={() => setEditorOpen(false)}
          onSubmit={(event) => void handleSave(event)}
        />
      ) : null}

      {pendingDeleteIds.length > 0 ? (
        <DeleteProductDialog
          count={pendingDeleteIds.length}
          working={working}
          onCancel={() => setPendingDeleteIds([])}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </section>
  );
}
