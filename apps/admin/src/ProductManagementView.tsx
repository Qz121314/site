import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminApiError, type AdminSection } from './api';
import { MediaLibraryPickerDialog } from './asset-library/MediaLibraryPickerDialog';
import type { ManagedMediaAsset } from './asset-library/api';
import {
  createCategory,
  fetchCategories,
  type AdminCategory,
} from './category-management/api';
import { fetchConversionGroups, type AdminConversionGroup } from './conversion-pool/api';
import { DeleteProductDialog } from './product-management/DeleteProductDialog';
import { ProductEditorDialog } from './product-management/ProductEditorDialog';
import { ProductTable } from './product-management/ProductTable';
import {
  isEditorMediaCoverEligible,
  toRemoteProductImage,
  type ProductEditorImage,
} from './product-management/product-editor-media';
import { validateProductDraft } from './product-management/product-editor-validation';
import {
  batchDeleteProducts,
  createProduct,
  deleteProduct,
  fetchProduct,
  fetchProducts,
  reorderProducts,
  restoreProduct,
  updateProduct,
  type AdminProduct,
  type AdminProductMedia,
  type ProductInput,
  type ProductStatus,
} from './product-management/api';
import {
  createProductTag,
  fetchProductTags,
  type AdminProductTag,
} from './tag-management/api';

export type ProductDependencyTarget = 'categories' | 'tags' | 'conversion-pool';
export type ProductResumeRequest = {
  productId: string;
  intendedStatus: ProductStatus;
  wasDowngradedToDraft: boolean;
};

type ProductManagementViewProps = {
  section: AdminSection;
  resumeRequest?: ProductResumeRequest | null;
  onResumeHandled?: () => void;
  onConfigureDependency?: (
    target: ProductDependencyTarget,
    request: ProductResumeRequest,
  ) => void;
  onSessionExpired: () => void;
};

type ProductScope = 'active' | 'trash';
type StatusFilter = 'all' | ProductStatus;
type SaveStage = 'idle' | 'saving';
type ProductDropPosition = 'before' | 'after';

const emptyProductForm: ProductInput = {
  serviceMode: 'offline',
  title: '',
  body: '',
  address: null,
  categoryId: null,
  tagIds: [],
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
    (left, right) =>
      left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt),
  );
}

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function describeError(error: unknown): string {
  if (error instanceof AdminApiError) {
    return error.field ? `${error.message}（字段：${error.field}）` : error.message;
  }
  return error instanceof Error ? error.message : '产品操作失败，请稍后重试。';
}

function productToInput(product: AdminProduct): ProductInput {
  return {
    serviceMode: product.serviceMode,
    title: product.title,
    body: product.body,
    address: product.address,
    categoryId: product.categoryId,
    tagIds: product.tagIds,
    conversionGroupId: product.conversionGroupId,
    coverAssetId: product.coverAssetId,
    mediaAssetIds: product.media.map((item) => item.id),
    isFeatured: product.isFeatured,
    featuredOrder: product.featuredOrder,
    sortOrder: product.sortOrder,
    status: product.status,
  };
}

function managedMediaToProductMedia(
  media: ManagedMediaAsset,
  sortOrder: number,
): AdminProductMedia {
  return {
    id: media.id,
    objectKey: media.objectKey,
    fileName: media.fileName,
    mimeType: media.mimeType,
    byteSize: media.byteSize,
    width: media.width,
    height: media.height,
    sortOrder,
    altText: null,
    publicUrl: media.publicUrl,
  };
}

function normalizeInlineName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function ProductManagementView({
  section,
  resumeRequest = null,
  onResumeHandled,
  onConfigureDependency,
  onSessionExpired,
}: ProductManagementViewProps) {
  const [scope, setScope] = useState<ProductScope>('active');
  const [activeProducts, setActiveProducts] = useState<AdminProduct[]>([]);
  const [trashProducts, setTrashProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [tags, setTags] = useState<AdminProductTag[]>([]);
  const [groups, setGroups] = useState<AdminConversionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyProductForm);
  const [media, setMedia] = useState<ProductEditorImage[]>([]);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [resumeNotice, setResumeNotice] = useState(false);
  const [saveStage, setSaveStage] = useState<SaveStage>('idle');
  const [handoffTarget, setHandoffTarget] = useState<ProductDependencyTarget | null>(
    null,
  );
  const [working, setWorking] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resumeOpenedProductId, setResumeOpenedProductId] = useState<string | null>(null);

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
      const [products, nextCategories, nextTags, nextGroups] = await Promise.all([
        fetchProducts(section.id, 'active'),
        fetchCategories(section.id, 'active'),
        fetchProductTags(section.id, 'active'),
        fetchConversionGroups(section.id, 'active'),
      ]);
      setActiveProducts(sortProducts(products));
      setCategories(nextCategories);
      setTags(nextTags);
      setGroups(nextGroups);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  }, [handleError, section.id]);

  useEffect(() => {
    setMedia([]);
    setCoverKey(null);
    setScope('active');
    setSearch('');
    setStatusFilter('all');
    setSelectedIds(new Set());
    setTrashProducts([]);
    setEditorOpen(false);
    setMediaPickerOpen(false);
    setResumeNotice(false);
    setErrorMessage('');
    setSuccessMessage('');
    setResumeOpenedProductId(null);
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    setSelectedIds(new Set());
    setErrorMessage('');
    setSuccessMessage('');
  }, [scope]);

  const openProductEditor = useCallback(
    async (productId: string, statusOverride?: ProductStatus): Promise<boolean> => {
      setWorking(true);
      setErrorMessage('');
      setSuccessMessage('');
      try {
        const detailed = await fetchProduct(section.id, productId);
        setEditingProduct(detailed);
        setForm({
          ...productToInput(detailed),
          ...(statusOverride ? { status: statusOverride } : {}),
        });
        setMedia(detailed.media.map(toRemoteProductImage));
        setCoverKey(detailed.coverAssetId ? `remote:${detailed.coverAssetId}` : null);
        setEditorOpen(true);
        return true;
      } catch (error) {
        handleError(error);
        return false;
      } finally {
        setWorking(false);
      }
    },
    [handleError, section.id],
  );

  useEffect(() => {
    if (!resumeRequest) {
      setResumeOpenedProductId(null);
      return;
    }
    if (loading || resumeOpenedProductId === resumeRequest.productId) return;

    setResumeOpenedProductId(resumeRequest.productId);
    void openProductEditor(resumeRequest.productId, resumeRequest.intendedStatus).then(
      (opened) => {
        if (!opened) return;
        setResumeNotice(resumeRequest.wasDowngradedToDraft);
        onResumeHandled?.();
      },
    );
  }, [loading, onResumeHandled, openProductEditor, resumeOpenedProductId, resumeRequest]);

  const sourceProducts = scope === 'active' ? activeProducts : trashProducts;
  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return sourceProducts.filter((product) => {
      if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      if (!keyword) return true;
      return `${product.title} ${product.categoryName ?? ''} ${product.tags.map((tag) => tag.name).join(' ')} ${product.conversionGroupName ?? ''}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [search, sourceProducts, statusFilter]);

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedIds.has(product.id));
  const reorderBlocked =
    scope !== 'active' || Boolean(search.trim()) || statusFilter !== 'all';
  const saving = saveStage !== 'idle';

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
    setCoverKey(null);
    setResumeNotice(false);
    setErrorMessage('');
    setSuccessMessage('');
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving || handoffTarget) return;
    setMediaPickerOpen(false);
    setMedia([]);
    setCoverKey(null);
    setResumeNotice(false);
    setEditorOpen(false);
  }

  function addMediaFromLibrary(asset: ManagedMediaAsset) {
    setMedia((current) => {
      if (
        current.length >= 12 ||
        current.some((item) => item.kind === 'remote' && item.media.id === asset.id)
      ) {
        return current;
      }
      return [
        ...current,
        toRemoteProductImage(managedMediaToProductMedia(asset, current.length * 10)),
      ];
    });
  }

  function removeMedia(key: string) {
    setMedia((current) => current.filter((item) => item.key !== key));
    if (coverKey === key) setCoverKey(null);
  }

  function moveMedia(key: string, direction: -1 | 1) {
    setMedia((current) => {
      const next = [...current];
      const index = next.findIndex((item) => item.key === key);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  async function persistEditor(nextForm: ProductInput): Promise<AdminProduct | null> {
    if (saving) return null;

    const localValidation = validateProductDraft(
      nextForm,
      media,
      categories,
      tags,
      groups,
    );
    if (localValidation) {
      setErrorMessage(localValidation);
      setSuccessMessage('');
      return null;
    }

    const requestedCover = coverKey
      ? (media.find((item) => item.key === coverKey) ?? null)
      : null;
    const selectedCover =
      requestedCover && isEditorMediaCoverEligible(requestedCover)
        ? requestedCover
        : (media.find(isEditorMediaCoverEligible) ?? null);
    const mediaAssetIds = media.flatMap((item) =>
      item.kind === 'remote' ? [item.media.id] : [],
    );
    const input: ProductInput = {
      ...nextForm,
      mediaAssetIds,
      coverAssetId:
        selectedCover?.kind === 'remote' && mediaAssetIds.includes(selectedCover.media.id)
          ? selectedCover.media.id
          : null,
    };

    setErrorMessage('');
    setSuccessMessage('');
    setSaveStage('saving');
    try {
      const saved = editingProduct
        ? await updateProduct(section.id, editingProduct.id, input)
        : await createProduct(section.id, input);

      setActiveProducts((current) => {
        const exists = current.some((product) => product.id === saved.id);
        return sortProducts(
          exists
            ? current.map((product) => (product.id === saved.id ? saved : product))
            : [...current, saved],
        );
      });
      setEditingProduct(saved);
      setForm(productToInput(saved));
      setMedia(saved.media.map(toRemoteProductImage));
      setCoverKey(saved.coverAssetId ? `remote:${saved.coverAssetId}` : null);
      return saved;
    } catch (error) {
      handleError(error);
      return null;
    } finally {
      setSaveStage('idle');
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wasEditing = editingProduct !== null;
    const saved = await persistEditor(form);
    if (!saved) return;

    setSuccessMessage(`产品“${saved.title}”已${wasEditing ? '更新' : '创建'}。`);
    setMedia([]);
    setCoverKey(null);
    setResumeNotice(false);
    setEditorOpen(false);
    setEditingProduct(null);
  }

  async function handleConfigureDependency(target: ProductDependencyTarget) {
    if (!onConfigureDependency || handoffTarget || saving) return;

    const intendedStatus = form.status;
    const currentValidation = validateProductDraft(form, media, categories, tags, groups);
    const handoffForm =
      currentValidation && intendedStatus === 'published'
        ? { ...form, status: 'draft' as const }
        : form;
    const handoffValidation = validateProductDraft(
      handoffForm,
      media,
      categories,
      tags,
      groups,
    );
    if (handoffValidation) {
      setErrorMessage(`暂存产品后才能切换配置：${handoffValidation}`);
      setSuccessMessage('');
      return;
    }

    setHandoffTarget(target);
    const saved = await persistEditor(handoffForm);
    if (!saved) {
      setHandoffTarget(null);
      return;
    }

    setMediaPickerOpen(false);
    setMedia([]);
    setCoverKey(null);
    setResumeNotice(false);
    setEditorOpen(false);
    setEditingProduct(null);
    setHandoffTarget(null);
    onConfigureDependency(target, {
      productId: saved.id,
      intendedStatus,
      wasDowngradedToDraft: handoffForm.status !== intendedStatus,
    });
  }

  async function handleCreateCategory(name: string): Promise<AdminCategory> {
    const normalized = normalizeInlineName(name);
    const existing = categories.find(
      (category) =>
        category.name.localeCompare(normalized, undefined, { sensitivity: 'accent' }) ===
        0,
    );
    if (existing) return existing;

    const sortOrder = categories.length
      ? Math.max(...categories.map((category) => category.sortOrder)) + 10
      : 0;
    try {
      const created = await createCategory(section.id, {
        name: normalized,
        sortOrder,
        isEnabled: true,
      });
      setCategories((current) =>
        [...current, created].sort((a, b) => a.sortOrder - b.sortOrder),
      );
      return created;
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
      throw error;
    }
  }

  async function handleCreateTag(name: string): Promise<AdminProductTag> {
    const normalized = normalizeInlineName(name);
    const existing = tags.find(
      (tag) =>
        tag.name.localeCompare(normalized, undefined, { sensitivity: 'accent' }) === 0,
    );
    if (existing) return existing;

    const sortOrder = tags.length
      ? Math.max(...tags.map((tag) => tag.sortOrder)) + 10
      : 0;
    try {
      const created = await createProductTag(section.id, {
        name: normalized,
        sortOrder,
        isEnabled: true,
      });
      setTags((current) =>
        [...current, created].sort((a, b) => a.sortOrder - b.sortOrder),
      );
      return created;
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
      throw error;
    }
  }

  async function persistProductOrder(nextProducts: AdminProduct[]) {
    if (reorderBlocked || working) return;
    const previous = sortProducts(activeProducts);
    const normalized = nextProducts.map((item, itemIndex) => ({
      ...item,
      sortOrder: itemIndex * 10,
    }));

    setActiveProducts(normalized);
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await reorderProducts(
        section.id,
        normalized.map((item) => ({ id: item.id, sortOrder: item.sortOrder })),
      );
      setSuccessMessage('产品顺序已更新。');
    } catch (error) {
      setActiveProducts(previous);
      handleError(error);
      await loadActive();
    } finally {
      setWorking(false);
    }
  }

  async function moveProduct(product: AdminProduct, direction: -1 | 1) {
    if (reorderBlocked || working) return;
    const ordered = sortProducts(activeProducts);
    const index = ordered.findIndex((item) => item.id === product.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    await persistProductOrder(next);
  }

  async function dragProduct(
    draggedId: string,
    targetId: string,
    position: ProductDropPosition,
  ) {
    if (reorderBlocked || working || draggedId === targetId) return;
    const ordered = sortProducts(activeProducts);
    const dragged = ordered.find((item) => item.id === draggedId);
    if (!dragged) return;

    const next = ordered.filter((item) => item.id !== draggedId);
    const targetIndex = next.findIndex((item) => item.id === targetId);
    if (targetIndex < 0) return;
    next.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, dragged);

    if (next.every((item, index) => item.id === ordered[index]?.id)) return;
    await persistProductOrder(next);
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0 || working) return;
    const deletingIds = [...pendingDeleteIds];
    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const firstId = deletingIds[0];
      if (deletingIds.length === 1 && firstId) await deleteProduct(section.id, firstId);
      else await batchDeleteProducts(section.id, deletingIds);
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

  const selectedMediaIds = media.flatMap((item) =>
    item.kind === 'remote' ? [item.media.id] : [],
  );

  return (
    <section className="product-management" aria-labelledby="product-management-title">
      <div className="product-management-toolbar">
        <div>
          <p>当前分区</p>
          <h2 id="product-management-title">{section.name} · 产品管理</h2>
          <span>产品、分类、标签和转化分组全部限制在“{section.name}”分区内。</span>
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
            placeholder="标题、分类、标签或转化分组"
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
        reorderDisabled={reorderBlocked}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onEdit={(product) => void openProductEditor(product.id)}
        onDelete={(product) => setPendingDeleteIds([product.id])}
        onRestore={(product) => void handleRestore(product)}
        onMove={(product, direction) => void moveProduct(product, direction)}
        onReorder={(draggedId, targetId, position) =>
          void dragProduct(draggedId, targetId, position)
        }
      />

      {editorOpen ? (
        <ProductEditorDialog
          sectionName={section.name}
          editingProduct={editingProduct}
          form={form}
          media={media}
          coverKey={coverKey}
          categories={categories}
          tags={tags}
          groups={groups}
          errorMessage={errorMessage}
          saveStage={saveStage}
          handoffBusy={handoffTarget !== null}
          resumeNotice={resumeNotice}
          onFormChange={(nextForm) => {
            setErrorMessage('');
            setForm(nextForm);
          }}
          onOpenMediaPicker={() => {
            setErrorMessage('');
            setMediaPickerOpen(true);
          }}
          onRemoveMedia={(key) => {
            setErrorMessage('');
            removeMedia(key);
          }}
          onMoveMedia={(key, direction) => {
            setErrorMessage('');
            moveMedia(key, direction);
          }}
          onSetCover={(key) => {
            setErrorMessage('');
            setCoverKey(key);
          }}
          onCreateCategory={handleCreateCategory}
          onCreateTag={handleCreateTag}
          onConfigureDependency={(target) => void handleConfigureDependency(target)}
          onClose={closeEditor}
          onSubmit={(event) => void handleSave(event)}
        />
      ) : null}

      {editorOpen && mediaPickerOpen ? (
        <MediaLibraryPickerDialog
          title="选择产品媒体"
          role="product"
          allowedKinds={['image', 'animated_image', 'video']}
          selectedIds={selectedMediaIds}
          maxSelections={12}
          onSessionExpired={onSessionExpired}
          onClose={() => setMediaPickerOpen(false)}
          onDone={() => setMediaPickerOpen(false)}
          onSelect={addMediaFromLibrary}
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
