import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
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
  prepareLocalProductImage,
  releaseLocalProductImage,
  releaseLocalProductImages,
  rotateLocalProductImage,
  toRemoteProductImage,
  type ProductEditorImage,
} from './product-management/local-product-image';
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
  type ProductInput,
  type ProductStatus,
} from './product-management/api';
import { fetchProductTags, type AdminProductTag } from './tag-management/api';

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
type SaveStage = 'idle' | 'uploading' | 'saving';

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
    (left, right) => left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt),
  );
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
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

function validateBeforeImageUpload(
  form: ProductInput,
  media: ProductEditorImage[],
  categories: AdminCategory[],
  tags: AdminProductTag[],
  groups: AdminConversionGroup[],
): string | null {
  if (!form.title.trim()) return '请填写产品标题。';
  if (!form.body.trim()) return '请填写产品正文。';
  if (form.tagIds.length > 12) return '每个产品最多选择 12 个标签。';
  if (form.status !== 'published') return null;

  const category = categories.find((item) => item.id === form.categoryId);
  if (!category || !category.isEnabled) return '发布产品前必须选择一个启用分类。';

  if (form.tagIds.some((id) => !tags.some((tag) => tag.id === id && tag.isEnabled))) {
    return '发布产品不能使用已停用或不存在的标签。';
  }

  const group = groups.find((item) => item.id === form.conversionGroupId);
  const expectedMode = form.serviceMode === 'online' ? 'link' : 'customer_service';
  if (!group || !group.isEnabled || group.mode !== expectedMode) {
    return form.serviceMode === 'online'
      ? '线上产品必须选择一个启用的外部链接分组。'
      : '线下产品必须选择一个启用的在线客服分组。';
  }
  if (group.activeTargetCount < 1) return '所选转化分组至少需要一个启用入口。';
  if (media.length < 1) return '发布产品前至少需要一张产品图片。';
  if (form.serviceMode === 'offline' && !form.address?.trim()) {
    return '发布线下产品前必须填写服务地址。';
  }
  return null;
}

function dedupeRemoteImages(images: ProductEditorImage[]): ProductEditorImage[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (image.kind !== 'remote') return true;
    if (seen.has(image.media.id)) return false;
    seen.add(image.media.id);
    return true;
  });
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
  const mediaRef = useRef<ProductEditorImage[]>([]);
  const resumeOpenedRef = useRef<string | null>(null);
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [resumeNotice, setResumeNotice] = useState(false);
  const [saveStage, setSaveStage] = useState<SaveStage>('idle');
  const [handoffTarget, setHandoffTarget] = useState<ProductDependencyTarget | null>(null);
  const [processingImages, setProcessingImages] = useState(false);
  const [rotatingImageKey, setRotatingImageKey] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(
    () => () => {
      releaseLocalProductImages(mediaRef.current);
    },
    [],
  );

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
    releaseLocalProductImages(mediaRef.current);
    setMedia([]);
    setCoverKey(null);
    setScope('active');
    setSearch('');
    setStatusFilter('all');
    setSelectedIds(new Set());
    setTrashProducts([]);
    setEditorOpen(false);
    setResumeNotice(false);
    setErrorMessage('');
    setSuccessMessage('');
    resumeOpenedRef.current = null;
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
        releaseLocalProductImages(mediaRef.current);
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
      resumeOpenedRef.current = null;
      return;
    }
    if (loading || resumeOpenedRef.current === resumeRequest.productId) return;

    resumeOpenedRef.current = resumeRequest.productId;
    void openProductEditor(resumeRequest.productId, resumeRequest.intendedStatus).then((opened) => {
      if (!opened) return;
      setResumeNotice(resumeRequest.wasDowngradedToDraft);
      onResumeHandled?.();
    });
  }, [loading, onResumeHandled, openProductEditor, resumeRequest]);

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
    filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.has(product.id));
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

  function resetEditorImages(next: ProductEditorImage[], nextCoverKey: string | null) {
    releaseLocalProductImages(mediaRef.current);
    setMedia(next);
    setCoverKey(nextCoverKey);
  }

  function openCreateEditor() {
    const sortOrder = activeProducts.length
      ? Math.max(...activeProducts.map((product) => product.sortOrder)) + 10
      : 0;
    setEditingProduct(null);
    setForm({ ...emptyProductForm, sortOrder });
    resetEditorImages([], null);
    setResumeNotice(false);
    setErrorMessage('');
    setSuccessMessage('');
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving || processingImages || rotatingImageKey || handoffTarget) return;
    releaseLocalProductImages(mediaRef.current);
    setMedia([]);
    setCoverKey(null);
    setResumeNotice(false);
    setEditorOpen(false);
  }

  async function handleSelectLocalImages(files: File[]) {
    const availableSlots = Math.max(0, 12 - mediaRef.current.length);
    const selected = files.slice(0, availableSlots);
    if (selected.length === 0) return;

    setProcessingImages(true);
    setErrorMessage('');
    setSuccessMessage('');
    const next = [...mediaRef.current];
    let preparedCount = 0;
    try {
      for (const file of selected) {
        next.push(await prepareLocalProductImage(file));
        preparedCount += 1;
      }
      setMedia(next);
      const skipped = Math.max(0, files.length - selected.length);
      setSuccessMessage(
        `已在浏览器压缩 ${preparedCount} 张图片，点击保存产品后才会上传到 R2。${
          skipped > 0 ? ` 另有 ${skipped} 张因超过 12 张上限未加入。` : ''
        }`,
      );
    } catch (error) {
      setMedia(next);
      handleError(error);
    } finally {
      setProcessingImages(false);
    }
  }

  function removeMedia(key: string) {
    const target = mediaRef.current.find((item) => item.key === key);
    if (target?.kind === 'local') releaseLocalProductImage(target);
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

  async function rotateMedia(key: string, direction: -1 | 1) {
    const current = mediaRef.current.find((item) => item.key === key);
    if (!current || current.kind !== 'local' || rotatingImageKey) return;
    setRotatingImageKey(key);
    setErrorMessage('');
    try {
      const rotated = await rotateLocalProductImage(current, direction);
      setMedia((items) => items.map((item) => (item.key === key ? rotated : item)));
      releaseLocalProductImage(current);
    } catch (error) {
      handleError(error);
    } finally {
      setRotatingImageKey(null);
    }
  }

  async function persistEditor(nextForm: ProductInput): Promise<AdminProduct | null> {
    if (saving || processingImages || rotatingImageKey) return null;

    const localValidation = validateBeforeImageUpload(
      nextForm,
      mediaRef.current,
      categories,
      tags,
      groups,
    );
    if (localValidation) {
      setErrorMessage(localValidation);
      setSuccessMessage('');
      return null;
    }

    setErrorMessage('');
    setSuccessMessage('');
    let resolvedImages = [...mediaRef.current];
    let resolvedCoverKey = coverKey;

    try {
      if (resolvedImages.some((image) => image.kind === 'local')) setSaveStage('uploading');
      else setSaveStage('saving');

      for (let index = 0; index < resolvedImages.length; index += 1) {
        const image = resolvedImages[index];
        if (!image || image.kind !== 'local') continue;
        const result = await uploadProductImage(section.id, image.compressedFile);
        const remote = toRemoteProductImage(result.media);
        resolvedImages[index] = remote;
        if (resolvedCoverKey === image.key) resolvedCoverKey = remote.key;
        releaseLocalProductImage(image);
        setMedia([...resolvedImages]);
        setCoverKey(resolvedCoverKey);
      }

      resolvedImages = dedupeRemoteImages(resolvedImages);
      const selectedCover = resolvedCoverKey
        ? resolvedImages.find((image) => image.key === resolvedCoverKey)
        : null;
      const mediaAssetIds = resolvedImages.flatMap((image) =>
        image.kind === 'remote' ? [image.media.id] : [],
      );
      const input: ProductInput = {
        ...nextForm,
        mediaAssetIds,
        coverAssetId:
          selectedCover?.kind === 'remote' && mediaAssetIds.includes(selectedCover.media.id)
            ? selectedCover.media.id
            : null,
      };

      setSaveStage('saving');
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
    const saved = await persistEditor(form);
    if (!saved) return;

    setSuccessMessage(`产品“${saved.title}”已${editingProduct ? '更新' : '创建'}。`);
    setMedia([]);
    setCoverKey(null);
    setResumeNotice(false);
    setEditorOpen(false);
    setEditingProduct(null);
  }

  async function handleConfigureDependency(target: ProductDependencyTarget) {
    if (!onConfigureDependency || handoffTarget || saving || processingImages || rotatingImageKey) return;

    const intendedStatus = form.status;
    const currentValidation = validateBeforeImageUpload(form, mediaRef.current, categories, tags, groups);
    const handoffForm = currentValidation && intendedStatus === 'published'
      ? { ...form, status: 'draft' as const }
      : form;
    const handoffValidation = validateBeforeImageUpload(
      handoffForm,
      mediaRef.current,
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
      if (deletingIds.length === 1 && firstId) await deleteProduct(section.id, firstId);
      else await batchDeleteProducts(section.id, deletingIds);
      setActiveProducts((current) => current.filter((product) => !deletingIds.includes(product.id)));
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

  const editorDialog = editorOpen ? (
    <ProductEditorDialog
      sectionName={section.name}
      editingProduct={editingProduct}
      form={form}
      media={media}
      coverKey={coverKey}
      categories={categories}
      tags={tags}
      groups={groups}
      saveStage={saveStage}
      processingImages={processingImages}
      rotatingImageKey={rotatingImageKey}
      handoffBusy={handoffTarget !== null}
      resumeNotice={resumeNotice}
      onFormChange={setForm}
      onSelectLocalImages={(files) => void handleSelectLocalImages(files)}
      onRotateLocalImage={(key, direction) => void rotateMedia(key, direction)}
      onRemoveMedia={removeMedia}
      onMoveMedia={moveMedia}
      onSetCover={setCoverKey}
      onConfigureDependency={(target) => void handleConfigureDependency(target)}
      onClose={closeEditor}
      onSubmit={(event) => void handleSave(event)}
    />
  ) : null;

  return (
    <section className="product-management" aria-labelledby="product-management-title">
      <div className="product-management-toolbar">
        <div>
          <p>当前分区</p>
          <h2 id="product-management-title">{section.name} · 产品管理</h2>
          <span>产品、分类、标签和转化分组全部限制在“{section.name}”分区内。</span>
        </div>
        <button className="primary-button" type="button" onClick={openCreateEditor}>新增产品</button>
      </div>

      <div className="product-filter-bar">
        <div className="scope-tabs" role="tablist" aria-label="产品范围">
          <button type="button" className={scope === 'active' ? 'is-active' : undefined} onClick={() => void changeScope('active')}>当前产品 <span>{activeProducts.length}</span></button>
          <button type="button" className={scope === 'trash' ? 'is-active' : undefined} onClick={() => void changeScope('trash')}>回收站 <span>{trashProducts.length}</span></button>
        </div>

        <label className="product-search">
          <span>搜索</span>
          <input type="search" value={search} placeholder="标题、分类、标签或转化分组" onChange={(event) => setSearch(event.target.value)} />
        </label>

        <label className="product-status-filter">
          <span>状态</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
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
        <div className="selection-toolbar"><span>已选择 {selectedIds.size} 个产品</span><button className="danger-button" type="button" disabled={working} onClick={() => setPendingDeleteIds([...selectedIds])}>批量删除</button></div>
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
        onEdit={(product) => void openProductEditor(product.id)}
        onDelete={(product) => setPendingDeleteIds([product.id])}
        onRestore={(product) => void handleRestore(product)}
        onMove={(product, direction) => void moveProduct(product, direction)}
      />

      {editorDialog}

      {pendingDeleteIds.length > 0 ? (
        <DeleteProductDialog count={pendingDeleteIds.length} working={working} onCancel={() => setPendingDeleteIds([])} onConfirm={() => void confirmDelete()} />
      ) : null}
    </section>
  );
}
