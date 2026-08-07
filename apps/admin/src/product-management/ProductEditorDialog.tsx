import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { AdminCategory } from '../category-management/api';
import type { AdminConversionGroup } from '../conversion-pool/api';
import { MarkdownPreview } from '../faq-management/MarkdownPreview';
import type { AdminProductTag } from '../tag-management/api';
import {
  formatImageBytes,
  getEditorImageByteSize,
  getEditorImageDimensions,
  getEditorImageFileName,
  getEditorImagePreviewUrl,
  type ProductEditorImage,
} from './local-product-image';
import type {
  AdminProduct,
  ProductInput,
  ProductServiceMode,
  ProductStatus,
} from './api';

type ProductDependencyTarget = 'categories' | 'tags' | 'conversion-pool';

type ProductEditorDialogProps = {
  sectionName: string;
  editingProduct: AdminProduct | null;
  form: ProductInput;
  media: ProductEditorImage[];
  coverKey: string | null;
  categories: AdminCategory[];
  tags: AdminProductTag[];
  groups: AdminConversionGroup[];
  saveStage: 'idle' | 'uploading' | 'saving';
  processingImages: boolean;
  rotatingImageKey: string | null;
  handoffBusy?: boolean;
  resumeNotice?: boolean;
  onFormChange: (next: ProductInput) => void;
  onSelectLocalImages: (files: File[]) => void;
  onRotateLocalImage: (key: string, direction: -1 | 1) => void;
  onRemoveMedia: (key: string) => void;
  onMoveMedia: (key: string, direction: -1 | 1) => void;
  onSetCover: (key: string | null) => void;
  onCreateCategory?: (name: string) => Promise<AdminCategory>;
  onCreateTag?: (name: string) => Promise<AdminProductTag>;
  onConfigureDependency?: (target: ProductDependencyTarget) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type BodyMode = 'edit' | 'preview';
type InlineCreateKind = 'category' | 'tag' | null;

function modeLabel(mode: ProductServiceMode): string {
  return mode === 'online' ? '线上服务' : '线下服务';
}

function expectedConversionMode(mode: ProductServiceMode) {
  return mode === 'online' ? 'link' : 'customer_service';
}

function saveButtonLabel(
  saveStage: ProductEditorDialogProps['saveStage'],
  editingProduct: AdminProduct | null,
): string {
  if (saveStage === 'uploading') return '正在上传图片…';
  if (saveStage === 'saving') return '正在保存…';
  return editingProduct ? '保存修改' : '创建产品';
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function sameName(left: string, right: string): boolean {
  return normalizeName(left).localeCompare(normalizeName(right), undefined, { sensitivity: 'accent' }) === 0;
}

export function ProductEditorDialog({
  sectionName,
  editingProduct,
  form,
  media,
  coverKey,
  categories,
  tags,
  groups,
  saveStage,
  processingImages,
  rotatingImageKey,
  handoffBusy = false,
  resumeNotice = false,
  onFormChange,
  onSelectLocalImages,
  onRotateLocalImage,
  onRemoveMedia,
  onMoveMedia,
  onSetCover,
  onCreateCategory,
  onCreateTag,
  onConfigureDependency,
  onClose,
  onSubmit,
}: ProductEditorDialogProps) {
  const [bodyMode, setBodyMode] = useState<BodyMode>('edit');
  const [categoryText, setCategoryText] = useState(
    () => categories.find((category) => category.id === form.categoryId)?.name ?? '',
  );
  const [tagText, setTagText] = useState('');
  const [creatingInline, setCreatingInline] = useState<InlineCreateKind>(null);
  const [inlineError, setInlineError] = useState('');

  const matchingGroups = useMemo(
    () => groups.filter((group) => group.mode === expectedConversionMode(form.serviceMode)),
    [form.serviceMode, groups],
  );
  const selectedTags = useMemo(
    () => form.tagIds.flatMap((id) => {
      const tag = tags.find((item) => item.id === id);
      return tag ? [tag] : [];
    }),
    [form.tagIds, tags],
  );
  const effectiveCoverKey = coverKey ?? media[0]?.key ?? null;
  const saving = saveStage !== 'idle';
  const busy = saving || processingImages || rotatingImageKey !== null || handoffBusy || creatingInline !== null;

  function patch(patchValue: Partial<ProductInput>) {
    onFormChange({ ...form, ...patchValue });
  }

  function changeServiceMode(nextMode: ProductServiceMode) {
    const currentGroup = groups.find((group) => group.id === form.conversionGroupId);
    patch({
      serviceMode: nextMode,
      address: nextMode === 'online' ? null : form.address,
      conversionGroupId:
        currentGroup?.mode === expectedConversionMode(nextMode) ? currentGroup.id : null,
    });
  }

  function handleCategoryInput(value: string) {
    setCategoryText(value);
    setInlineError('');
    const normalized = normalizeName(value);
    if (!normalized) {
      patch({ categoryId: null });
      return;
    }
    const existing = categories.find((category) => sameName(category.name, normalized));
    patch({ categoryId: existing?.isEnabled ? existing.id : null });
  }

  async function commitCategory() {
    const name = normalizeName(categoryText);
    if (!name) {
      patch({ categoryId: null });
      return;
    }

    const existing = categories.find((category) => sameName(category.name, name));
    if (existing) {
      if (!existing.isEnabled) {
        setInlineError(`分类“${existing.name}”已存在但当前停用。`);
        return;
      }
      setCategoryText(existing.name);
      patch({ categoryId: existing.id });
      return;
    }

    if (!onCreateCategory) return;
    setCreatingInline('category');
    setInlineError('');
    try {
      const created = await onCreateCategory(name);
      setCategoryText(created.name);
      patch({ categoryId: created.id });
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : '新增分类失败。');
    } finally {
      setCreatingInline(null);
    }
  }

  function removeTag(tagId: string) {
    patch({ tagIds: form.tagIds.filter((id) => id !== tagId) });
  }

  async function commitTag() {
    const name = normalizeName(tagText);
    if (!name) return;
    if (form.tagIds.length >= 12) {
      setInlineError('每个产品最多选择 12 个标签。');
      return;
    }

    const existing = tags.find((tag) => sameName(tag.name, name));
    if (existing) {
      if (!existing.isEnabled) {
        setInlineError(`标签“${existing.name}”已存在但当前停用。`);
        return;
      }
      if (!form.tagIds.includes(existing.id)) patch({ tagIds: [...form.tagIds, existing.id] });
      setTagText('');
      setInlineError('');
      return;
    }

    if (!onCreateTag) return;
    setCreatingInline('tag');
    setInlineError('');
    try {
      const created = await onCreateTag(name);
      patch({ tagIds: [...form.tagIds, created.id] });
      setTagText('');
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : '新增标签失败。');
    } finally {
      setCreatingInline(null);
    }
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    void commitTag();
  }

  return (
    <div className="admin-dialog-backdrop product-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog product-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{sectionName} · 产品内容</p>
            <h3 id="product-editor-title">{editingProduct ? '编辑产品' : '新增产品'}</h3>
          </div>
          <button type="button" aria-label="关闭" disabled={busy} onClick={onClose}>×</button>
        </div>

        <form className="product-editor-form" onSubmit={onSubmit}>
          {resumeNotice ? (
            <div className="product-handoff-notice" role="status">
              已返回当前产品草稿，可继续编辑后保存。
            </div>
          ) : null}

          <div className="product-core-grid">
            <label className="product-field product-core-title">
              <span>产品标题</span>
              <input
                type="text"
                value={form.title}
                autoFocus
                maxLength={200}
                placeholder="输入产品名称"
                onChange={(event) => patch({ title: event.target.value })}
              />
            </label>

            <label className="product-field product-core-service-mode">
              <span>服务类型</span>
              <select
                value={form.serviceMode}
                onChange={(event) => changeServiceMode(event.target.value as ProductServiceMode)}
              >
                <option value="offline">线下服务</option>
                <option value="online">线上服务</option>
              </select>
            </label>

            <div className="product-field product-core-category">
              <span>所属分类</span>
              <div className="product-inline-entry">
                <input
                  type="text"
                  list="product-category-options"
                  value={categoryText}
                  placeholder="选择或输入新分类"
                  disabled={busy}
                  onChange={(event) => handleCategoryInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void commitCategory();
                  }}
                />
                <datalist id="product-category-options">
                  {categories.filter((category) => category.isEnabled).map((category) => (
                    <option key={category.id} value={category.name} />
                  ))}
                </datalist>
                <button type="button" disabled={busy || !categoryText.trim()} onClick={() => void commitCategory()}>
                  {creatingInline === 'category' ? '新增中…' : '确定'}
                </button>
              </div>
            </div>

            <div className="product-field product-core-conversion">
              <div className="product-field-heading">
                <span>{modeLabel(form.serviceMode)}转化分组</span>
                {onConfigureDependency ? (
                  <button type="button" disabled={busy} onClick={() => onConfigureDependency('conversion-pool')}>管理</button>
                ) : null}
              </div>
              <select
                aria-label={`${modeLabel(form.serviceMode)}转化分组`}
                value={form.conversionGroupId ?? ''}
                onChange={(event) => patch({ conversionGroupId: event.target.value || null })}
              >
                <option value="">暂不选择</option>
                {matchingGroups.map((group) => (
                  <option key={group.id} value={group.id} disabled={!group.isEnabled || group.activeTargetCount < 1}>
                    {group.name} · {group.buttonLabel}
                  </option>
                ))}
              </select>
            </div>

            <div className="product-field product-tags-field product-core-tags">
              <div className="product-tags-heading">
                <span>产品标签</span>
                <small>{form.tagIds.length}/12</small>
              </div>
              <div className="product-inline-entry product-tag-entry">
                <input
                  type="text"
                  list="product-tag-options"
                  value={tagText}
                  placeholder="选择或输入标签，回车添加"
                  disabled={busy || form.tagIds.length >= 12}
                  onChange={(event) => {
                    setTagText(event.target.value);
                    setInlineError('');
                  }}
                  onKeyDown={handleTagKeyDown}
                />
                <datalist id="product-tag-options">
                  {tags.filter((tag) => tag.isEnabled && !form.tagIds.includes(tag.id)).map((tag) => (
                    <option key={tag.id} value={tag.name} />
                  ))}
                </datalist>
                <button type="button" disabled={busy || !tagText.trim() || form.tagIds.length >= 12} onClick={() => void commitTag()}>
                  {creatingInline === 'tag' ? '新增中…' : '添加'}
                </button>
              </div>
              {selectedTags.length > 0 ? (
                <div className="product-selected-tags">
                  {selectedTags.map((tag) => (
                    <button key={tag.id} type="button" disabled={busy} onClick={() => removeTag(tag.id)} title="移除标签">
                      {tag.name}<span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {form.serviceMode === 'offline' ? (
              <label className="product-field product-core-address">
                <span>服务地址</span>
                <input
                  type="text"
                  value={form.address ?? ''}
                  maxLength={500}
                  placeholder="门店或服务区域"
                  onChange={(event) => patch({ address: event.target.value || null })}
                />
              </label>
            ) : null}

            <label className="product-field product-core-status">
              <span>发布状态</span>
              <select value={form.status} onChange={(event) => patch({ status: event.target.value as ProductStatus })}>
                <option value="draft">草稿</option>
                <option value="published">发布</option>
                <option value="archived">归档</option>
              </select>
            </label>

            <label className="product-field product-core-sort">
              <span>产品排序</span>
              <input type="number" min={0} max={1_000_000} value={form.sortOrder} onChange={(event) => patch({ sortOrder: Number(event.target.value) })} />
            </label>

            <label className="product-switch-field product-core-featured">
              <input type="checkbox" checked={form.isFeatured} onChange={(event) => patch({ isFeatured: event.target.checked })} />
              <span><strong>热门推荐</strong></span>
            </label>

            <label className="product-field product-core-featured-sort">
              <span>热门排序</span>
              <input type="number" min={0} max={1_000_000} value={form.featuredOrder} disabled={!form.isFeatured} onChange={(event) => patch({ featuredOrder: Number(event.target.value) })} />
            </label>
          </div>

          {inlineError ? <div className="product-inline-error" role="alert">{inlineError}</div> : null}

          <div className="product-content-grid">
            <div className="product-body-field">
              <div className="product-body-heading">
                <strong>产品正文</strong>
                <div className="product-editor-tabs" role="tablist" aria-label="正文编辑模式">
                  <button type="button" className={bodyMode === 'edit' ? 'is-active' : undefined} onClick={() => setBodyMode('edit')}>编辑</button>
                  <button type="button" className={bodyMode === 'preview' ? 'is-active' : undefined} onClick={() => setBodyMode('preview')}>预览</button>
                </div>
              </div>
              {bodyMode === 'edit' ? (
                <textarea
                  value={form.body}
                  maxLength={20_000}
                  placeholder="输入产品介绍、服务内容和注意事项"
                  onChange={(event) => patch({ body: event.target.value })}
                />
              ) : (
                <div className="product-markdown-preview">
                  {form.body.trim() ? <MarkdownPreview source={form.body} /> : <p className="product-preview-empty">正文为空。</p>}
                </div>
              )}
            </div>

            <section className="product-media-section" aria-labelledby="product-media-title">
              <div className="product-media-heading">
                <strong id="product-media-title">产品图片</strong>
                <label className={`product-upload-button${busy ? ' is-disabled' : ''}`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={busy || media.length >= 12}
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.currentTarget.value = '';
                      if (files.length > 0) onSelectLocalImages(files);
                    }}
                  />
                  {processingImages ? '处理中…' : '选择图片'}
                </label>
              </div>

              {media.length > 0 ? (
                <div className="product-media-grid">
                  {media.map((item, index) => {
                    const previewUrl = getEditorImagePreviewUrl(item);
                    const dimensions = getEditorImageDimensions(item);
                    const fileName = getEditorImageFileName(item);
                    const isCover = effectiveCoverKey === item.key;
                    const rotating = rotatingImageKey === item.key;
                    return (
                      <article className={`product-media-card${isCover ? ' is-cover' : ''}${item.kind === 'local' ? ' is-local' : ''}`} key={item.key}>
                        <div className="product-media-preview">
                          {previewUrl ? <img src={previewUrl} alt={fileName} /> : <span>无预览</span>}
                          <div className="product-media-badges">
                            {isCover ? <b>封面</b> : null}
                            {item.kind === 'local' ? <b className="is-local-badge">待保存</b> : null}
                          </div>
                        </div>
                        <div className="product-media-meta">
                          <strong title={fileName}>{fileName}</strong>
                          <small>
                            {dimensions.width && dimensions.height ? `${dimensions.width} × ${dimensions.height}` : '尺寸未知'} · {formatImageBytes(getEditorImageByteSize(item))}
                          </small>
                        </div>
                        <div className="product-media-actions">
                          <button type="button" disabled={index === 0 || busy} onClick={() => onMoveMedia(item.key, -1)}>前移</button>
                          <button type="button" disabled={index === media.length - 1 || busy} onClick={() => onMoveMedia(item.key, 1)}>后移</button>
                          {item.kind === 'local' ? (
                            <>
                              <button type="button" disabled={busy} onClick={() => onRotateLocalImage(item.key, -1)}>左转</button>
                              <button type="button" disabled={busy} onClick={() => onRotateLocalImage(item.key, 1)}>{rotating ? '处理中…' : '右转'}</button>
                            </>
                          ) : null}
                          <button type="button" disabled={isCover || busy} onClick={() => onSetCover(item.key)}>封面</button>
                          <button className="text-danger" type="button" disabled={busy} onClick={() => onRemoveMedia(item.key)}>删除</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="product-media-empty">尚未选择图片</div>}

              {coverKey ? (
                <button className="product-auto-cover" type="button" disabled={busy} onClick={() => onSetCover(null)}>
                  自动使用第一张图
                </button>
              ) : null}
            </section>
          </div>

          <div className="admin-dialog-actions">
            <button type="button" disabled={busy} onClick={onClose}>取消</button>
            <button className="primary-button" type="submit" disabled={busy}>{saveButtonLabel(saveStage, editingProduct)}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
