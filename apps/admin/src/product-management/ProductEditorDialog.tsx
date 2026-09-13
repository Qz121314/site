import { X } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MediaLibraryPickerDialog } from '../asset-library/MediaLibraryPickerDialog';
import type { ManagedMediaAsset } from '../asset-library/api';
import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';
import { adminConfirm } from '../admin-dialog-service';
import { useAdminDirtySource } from '../admin-unsaved-state';
import type { AdminCategory } from '../category-management/api';
import type { AdminConversionGroup } from '../conversion-pool/api';
import { MarkdownPreview } from '../faq-management/MarkdownPreview';
import type { AdminProductTag } from '../tag-management/api';
import {
  editorMediaKindLabel,
  formatImageBytes,
  getEditorImageByteSize,
  getEditorImageDimensions,
  getEditorImageFileName,
  getEditorImagePreviewUrl,
  isEditorMediaCoverEligible,
  isEditorMediaVideo,
  type ProductEditorImage,
} from './product-editor-media';
import type {
  AdminProduct,
  ProductInput,
  ProductServiceMode,
  ProductStatus,
} from './api';

type ProductDependencyTarget = 'categories' | 'tags' | 'conversion-pool';

type ProductEditorDialogProps = {
  editingProduct: AdminProduct | null;
  form: ProductInput;
  media: ProductEditorImage[];
  coverKey: string | null;
  categories: AdminCategory[];
  tags: AdminProductTag[];
  groups: AdminConversionGroup[];
  errorMessage: string;
  saveStage: 'idle' | 'saving';
  handoffBusy?: boolean;
  resumeNotice?: boolean;
  onFormChange: (next: ProductInput) => void;
  onOpenMediaPicker: () => void;
  onSessionExpired: () => void;
  onRemoveMedia: (key: string) => void;
  onReorderMedia: (draggedKey: string, targetKey: string) => void;
  onSetCover: (key: string | null) => void;
  onCreateCategory?: (name: string) => Promise<AdminCategory>;
  onCreateTag?: (name: string) => Promise<AdminProductTag>;
  onConfigureDependency?: (target: ProductDependencyTarget) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type InlineCreateKind = 'category' | 'tag' | null;

type MarkdownAction = {
  label: string;
  title: string;
  before: string;
  after?: string;
  placeholder: string;
};

const markdownActions: MarkdownAction[] = [
  {
    label: 'H2',
    title: '插入二级标题',
    before: '## ',
    placeholder: '小标题',
  },
  {
    label: '粗体',
    title: '加粗选中文字',
    before: '**',
    after: '**',
    placeholder: '重点文字',
  },
  {
    label: '列表',
    title: '插入列表项',
    before: '- ',
    placeholder: '列表内容',
  },
  {
    label: '提示',
    title: '插入提示引用块',
    before: '> ',
    placeholder: '提示内容',
  },
  {
    label: '链接',
    title: '插入安全链接',
    before: '[',
    after: '](https://example.com)',
    placeholder: '链接文字',
  },
  {
    label: '代码',
    title: '插入行内代码',
    before: '`',
    after: '`',
    placeholder: '代码内容',
  },
  {
    label: '分隔线',
    title: '插入分隔线',
    before: '---',
    placeholder: '',
  },
  {
    label: '品牌色',
    title: '插入跟随当前主题的品牌色文字',
    before: '{accent}',
    after: '{/accent}',
    placeholder: '重点文字',
  },
  {
    label: '高亮',
    title: '插入带背景的高亮文字',
    before: '{highlight}',
    after: '{/highlight}',
    placeholder: '高亮文字',
  },
  {
    label: '弱化',
    title: '插入辅助说明文字',
    before: '{muted}',
    after: '{/muted}',
    placeholder: '辅助说明',
  },
  {
    label: '标签',
    title: '插入主题化小标签',
    before: '{badge}',
    after: '{/badge}',
    placeholder: '标签文字',
  },
  {
    label: '提示卡',
    title: '插入重要提示卡片',
    before: ':::notice Important Note\n',
    after: '\n:::',
    placeholder: '提示内容',
  },
  {
    label: '说明卡',
    title: '插入普通说明卡片',
    before: ':::tip\n',
    after: '\n:::',
    placeholder: '说明内容',
  },
  {
    label: 'CTA',
    title: '插入正文转化卡片',
    before: ':::cta Ready to continue?\n',
    after: '\n:::',
    placeholder: 'Use the product action button below to continue.',
  },
];

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
  if (saveStage === 'saving') return '正在保存…';
  return editingProduct ? '保存修改' : '创建产品';
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function sameName(left: string, right: string): boolean {
  return (
    normalizeName(left).localeCompare(normalizeName(right), undefined, {
      sensitivity: 'accent',
    }) === 0
  );
}

function formWithoutMedia(input: ProductInput) {
  const { coverAssetId: _coverAssetId, mediaAssetIds: _mediaAssetIds, ...rest } = input;
  return rest;
}

function baselineForm(
  product: AdminProduct | null,
  currentSortOrder: number,
): ReturnType<typeof formWithoutMedia> {
  if (!product) {
    return formWithoutMedia({
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
      sortOrder: currentSortOrder,
      status: 'draft',
    });
  }
  return formWithoutMedia({
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
  });
}

function mediaIds(media: ProductEditorImage[]): string[] {
  return media.map((item) => item.media.id);
}

export function ProductEditorDialog({
  editingProduct,
  form,
  media,
  coverKey,
  categories,
  tags,
  groups,
  errorMessage,
  saveStage,
  handoffBusy = false,
  resumeNotice = false,
  onFormChange,
  onOpenMediaPicker,
  onSessionExpired,
  onRemoveMedia,
  onReorderMedia,
  onSetCover,
  onCreateCategory,
  onCreateTag,
  onConfigureDependency,
  onClose,
  onSubmit,
}: ProductEditorDialogProps) {
  const [categoryText, setCategoryText] = useState(
    () => categories.find((category) => category.id === form.categoryId)?.name ?? '',
  );
  const [tagText, setTagText] = useState('');
  const [creatingInline, setCreatingInline] = useState<InlineCreateKind>(null);
  const [inlineError, setInlineError] = useState('');
  const [draggingMediaKey, setDraggingMediaKey] = useState<string | null>(null);
  const [markdownMediaPickerOpen, setMarkdownMediaPickerOpen] = useState(false);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const baselineCategoryText = editingProduct?.categoryId
    ? (categories.find((category) => category.id === editingProduct.categoryId)?.name ??
      '')
    : '';
  const editorFingerprint = JSON.stringify({
    form: formWithoutMedia(form),
    media: mediaIds(media),
    coverKey,
    categoryText,
    tagText,
  });
  const baselineFingerprint = JSON.stringify({
    form: baselineForm(editingProduct, form.sortOrder),
    media: editingProduct?.media.map((item) => item.id) ?? [],
    coverKey: editingProduct?.coverAssetId
      ? `remote:${editingProduct.coverAssetId}`
      : null,
    categoryText: baselineCategoryText,
    tagText: '',
  });
  const editorDirty = editorFingerprint !== baselineFingerprint;
  useAdminDirtySource(
    'product-editor',
    editingProduct ? `产品：${editingProduct.title}` : '新增产品',
    editorDirty,
  );

  const matchingGroups = useMemo(
    () =>
      groups.filter((group) => group.mode === expectedConversionMode(form.serviceMode)),
    [form.serviceMode, groups],
  );
  const selectedTags = useMemo(
    () =>
      form.tagIds.flatMap((id) => {
        const tag = tags.find((item) => item.id === id);
        return tag ? [tag] : [];
      }),
    [form.tagIds, tags],
  );
  const effectiveCoverKey =
    coverKey ?? media.find(isEditorMediaCoverEligible)?.key ?? null;
  const saving = saveStage !== 'idle';
  const busy = saving || handoffBusy || creatingInline !== null;

  function patch(patchValue: Partial<ProductInput>) {
    onFormChange({ ...form, ...patchValue });
  }

  function applyMarkdownAction(action: MarkdownAction) {
    const textarea = markdownTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = form.body.slice(start, end);
    const content = selected || action.placeholder;
    const replacement = `${action.before}${content}${action.after ?? ''}`;
    const nextBody = `${form.body.slice(0, start)}${replacement}${form.body.slice(end)}`;
    patch({ body: nextBody });

    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + action.before.length;
      textarea.setSelectionRange(selectionStart, selectionStart + content.length);
    });
  }

  function insertMarkdownImage(asset: ManagedMediaAsset) {
    if (!asset.publicUrl) {
      setInlineError('该素材暂无公开地址，请先配置媒体域名后再插入正文。');
      return;
    }
    const textarea = markdownTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const altText = asset.fileName.replace(/\.[^.]+$/, '') || '图片';
    const replacement = `![${altText}](${asset.publicUrl})`;
    patch({
      body: `${form.body.slice(0, start)}${replacement}${form.body.slice(end)}`,
    });
    setMarkdownMediaPickerOpen(false);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + replacement.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function requestClose() {
    if (busy) return;
    if (editorDirty) {
      const confirmed = await adminConfirm({
        eyebrow: '未保存修改',
        title: '放弃当前产品修改？',
        message: '当前产品编辑内容尚未保存。关闭后，本次修改会被放弃。',
        confirmLabel: '放弃修改',
        danger: true,
      });
      if (!confirmed) return;
    }
    onClose();
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
      if (!form.tagIds.includes(existing.id))
        patch({ tagIds: [...form.tagIds, existing.id] });
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
    <AdminDialog
      open
      title={editingProduct ? '编辑产品' : '新增产品'}
      ariaLabel={`${editingProduct ? '编辑' : '新增'}产品`}
      showHeading={false}
      onClose={() => void requestClose()}
      closeDisabled={busy}
      size="large"
      className="product-editor-dialog"
      headerActions={
        <div className="product-editor-header-actions">
          <div
            className="product-header-settings product-header-settings-left"
            aria-label="产品状态设置"
          >
            <label className="product-header-setting">
              <span>发布状态</span>
              <select
                aria-label="发布状态"
                value={form.status}
                onChange={(event) =>
                  patch({ status: event.target.value as ProductStatus })
                }
              >
                <option value="draft">草稿</option>
                <option value="published">发布</option>
                <option value="archived">归档</option>
              </select>
            </label>
            <label className="product-header-featured-setting">
              <input
                type="checkbox"
                checked={form.isVisible !== false}
                onChange={(event) => patch({ isVisible: event.target.checked })}
              />
              <span>前端展示</span>
            </label>
            <label className="product-header-featured-setting">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) => patch({ isFeatured: event.target.checked })}
              />
              <span>首页推荐</span>
            </label>
          </div>
          <div
            className="product-header-settings product-header-settings-right"
            aria-label="产品排序设置"
          >
            <label className="product-header-setting product-header-order-setting">
              <span>排序</span>
              <input
                aria-label="产品排序"
                type="number"
                min={0}
                max={1_000_000}
                value={form.sortOrder}
                onChange={(event) => patch({ sortOrder: Number(event.target.value) })}
              />
            </label>
            <label className="product-header-setting product-header-order-setting">
              <span>推荐排序</span>
              <input
                aria-label="首页推荐排序"
                type="number"
                min={0}
                max={1_000_000}
                value={form.featuredOrder}
                disabled={!form.isFeatured}
                onChange={(event) => patch({ featuredOrder: Number(event.target.value) })}
              />
            </label>
            <Button
              type="submit"
              form="product-editor-form"
              variant="primary"
              loading={saveStage === 'saving'}
              disabled={handoffBusy}
            >
              {saveButtonLabel(saveStage, editingProduct)}
            </Button>
          </div>
        </div>
      }
    >
      <form id="product-editor-form" className="product-editor-form" onSubmit={onSubmit}>
        {errorMessage ? (
          <div className="notice notice-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

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
              onChange={(event) =>
                changeServiceMode(event.target.value as ProductServiceMode)
              }
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
                {categories
                  .filter((category) => category.isEnabled)
                  .map((category) => (
                    <option key={category.id} value={category.name} />
                  ))}
              </datalist>
              <button
                type="button"
                disabled={busy || !categoryText.trim()}
                onClick={() => void commitCategory()}
              >
                {creatingInline === 'category' ? '新增中…' : '确定'}
              </button>
            </div>
          </div>

          <div className="product-field product-core-conversion">
            <div className="product-field-heading">
              <span>{modeLabel(form.serviceMode)}转化分组</span>
              {onConfigureDependency ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onConfigureDependency('conversion-pool')}
                >
                  管理
                </button>
              ) : null}
            </div>
            <select
              aria-label={`${modeLabel(form.serviceMode)}转化分组`}
              value={form.conversionGroupId ?? ''}
              onChange={(event) =>
                patch({ conversionGroupId: event.target.value || null })
              }
            >
              <option value="">暂不选择</option>
              {matchingGroups.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                  disabled={!group.isEnabled || group.activeTargetCount < 1}
                >
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
                {tags
                  .filter((tag) => tag.isEnabled && !form.tagIds.includes(tag.id))
                  .map((tag) => (
                    <option key={tag.id} value={tag.name} />
                  ))}
              </datalist>
              <button
                type="button"
                disabled={busy || !tagText.trim() || form.tagIds.length >= 12}
                onClick={() => void commitTag()}
              >
                {creatingInline === 'tag' ? '新增中…' : '添加'}
              </button>
            </div>
            {selectedTags.length > 0 ? (
              <div className="product-selected-tags">
                {selectedTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={busy}
                    onClick={() => removeTag(tag.id)}
                    title="移除标签"
                  >
                    {tag.name}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {inlineError ? (
          <div className="product-inline-error" role="alert">
            {inlineError}
          </div>
        ) : null}

        <div className="product-content-grid">
          <div className="product-body-field">
            <div className="product-body-heading">
              <div>
                <strong>产品正文 · Markdown</strong>
                <small>内容将按详情页样式实时渲染</small>
              </div>
              <div className="product-markdown-toolbar" aria-label="Markdown 快捷格式">
                {markdownActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    title={action.title}
                    disabled={busy}
                    onClick={() => applyMarkdownAction(action)}
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  type="button"
                  title="从素材中心插入图片"
                  disabled={busy}
                  onClick={() => setMarkdownMediaPickerOpen(true)}
                >
                  图片
                </button>
              </div>
            </div>
            <div className="product-body-content">
              <textarea
                ref={markdownTextareaRef}
                value={form.body}
                maxLength={20_000}
                placeholder={'输入产品介绍、服务内容和注意事项。可使用上方快捷格式。'}
                onChange={(event) => patch({ body: event.target.value })}
              />
              <div className="product-markdown-preview">
                {form.body.trim() ? (
                  <MarkdownPreview source={form.body} />
                ) : (
                  <p className="product-preview-empty">正文为空。</p>
                )}
              </div>
            </div>
            <div className="product-markdown-footer">
              <span>支持主题色、高亮、标签、提示卡、说明卡和 CTA 卡片</span>
              <span>{form.body.length.toLocaleString()} / 20,000</span>
            </div>
          </div>

          <section
            className="product-media-section"
            aria-labelledby="product-media-title"
          >
            <div className="product-media-heading">
              <strong id="product-media-title">产品媒体</strong>
              <button
                type="button"
                className="product-upload-button"
                disabled={busy || media.length >= 12}
                onClick={onOpenMediaPicker}
              >
                从素材中心选择
              </button>
            </div>

            {media.length > 0 ? (
              <div className="product-media-grid">
                {media.map((item, index) => {
                  const previewUrl = getEditorImagePreviewUrl(item);
                  const fileName = getEditorImageFileName(item);
                  const video = isEditorMediaVideo(item);
                  const coverEligible = isEditorMediaCoverEligible(item);
                  const isCover = effectiveCoverKey === item.key;
                  return (
                    <article
                      className={`product-media-card${isCover ? ' is-cover' : ''}${draggingMediaKey === item.key ? ' is-dragging' : ''}`}
                      key={item.key}
                      tabIndex={0}
                      aria-label={`媒体 ${index + 1}：${fileName}，可拖拽调整顺序`}
                      draggable={!busy}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', item.key);
                        setDraggingMediaKey(item.key);
                      }}
                      onDragOver={(event) => {
                        if (!draggingMediaKey || draggingMediaKey === item.key) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedKey = event.dataTransfer.getData('text/plain');
                        if (draggedKey && draggedKey !== item.key) {
                          onReorderMedia(draggedKey, item.key);
                        }
                        setDraggingMediaKey(null);
                      }}
                      onDragEnd={() => setDraggingMediaKey(null)}
                    >
                      <div className="product-media-preview">
                        {previewUrl ? (
                          video ? (
                            <video
                              src={previewUrl}
                              controls
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img src={previewUrl} alt={fileName} />
                          )
                        ) : (
                          <span>无预览</span>
                        )}
                        <div className="product-media-badges">
                          <b className="is-kind-badge">{editorMediaKindLabel(item)}</b>
                          {coverEligible ? (
                            <button
                              className={`product-media-cover-button${isCover ? ' is-active' : ''}`}
                              type="button"
                              disabled={isCover || busy}
                              title={isCover ? '当前封面' : '设为封面'}
                              aria-label={isCover ? '当前封面' : `设为封面 ${fileName}`}
                              onClick={() => onSetCover(item.key)}
                            >
                              {isCover ? '封面' : '设为封面'}
                            </button>
                          ) : null}
                        </div>
                        <button
                          className="product-media-remove-button"
                          type="button"
                          disabled={busy}
                          aria-label={`移除媒体 ${fileName}`}
                          onClick={() => onRemoveMedia(item.key)}
                        >
                          <X aria-hidden="true" size={12} />
                        </button>
                      </div>
                      <div className="product-media-meta">
                        <strong title={fileName}>{fileName}</strong>
                        <small>
                          {(() => {
                            const dimensions = getEditorImageDimensions(item);
                            return dimensions.width && dimensions.height
                              ? `${dimensions.width} × ${dimensions.height}`
                              : '尺寸未知';
                          })()}{' '}
                          · {formatImageBytes(getEditorImageByteSize(item))}
                        </small>
                      </div>
                      <div className="product-media-drag-hint" aria-hidden="true">
                        拖拽调整顺序
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="product-media-empty">
                <strong>尚未选择产品媒体</strong>
              </div>
            )}

            {coverKey ? (
              <button
                className="product-auto-cover"
                type="button"
                disabled={busy}
                onClick={() => onSetCover(null)}
              >
                自动使用第一张图片或 GIF
              </button>
            ) : null}
          </section>
        </div>
      </form>
      {markdownMediaPickerOpen ? (
        <MediaLibraryPickerDialog
          title="插入正文图片"
          role="content"
          allowedKinds={['image', 'animated_image']}
          maxSelections={1}
          onSessionExpired={onSessionExpired}
          onClose={() => setMarkdownMediaPickerOpen(false)}
          onDone={() => setMarkdownMediaPickerOpen(false)}
          onSelect={insertMarkdownImage}
        />
      ) : null}
    </AdminDialog>
  );
}
