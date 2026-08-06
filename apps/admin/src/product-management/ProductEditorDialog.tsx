import { useMemo, useState, type FormEvent } from 'react';
import type { AdminCategory } from '../category-management/api';
import type { AdminConversionGroup } from '../conversion-pool/api';
import { MarkdownPreview } from '../faq-management/MarkdownPreview';
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

type ProductEditorDialogProps = {
  sectionName: string;
  editingProduct: AdminProduct | null;
  form: ProductInput;
  media: ProductEditorImage[];
  coverKey: string | null;
  categories: AdminCategory[];
  groups: AdminConversionGroup[];
  saveStage: 'idle' | 'uploading' | 'saving';
  processingImages: boolean;
  rotatingImageKey: string | null;
  onFormChange: (next: ProductInput) => void;
  onSelectLocalImages: (files: File[]) => void;
  onRotateLocalImage: (key: string, direction: -1 | 1) => void;
  onRemoveMedia: (key: string) => void;
  onMoveMedia: (key: string, direction: -1 | 1) => void;
  onSetCover: (key: string | null) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type BodyMode = 'edit' | 'preview';

function modeLabel(mode: ProductServiceMode): string {
  return mode === 'online' ? '线上服务' : '线下服务';
}

function statusLabel(status: ProductStatus): string {
  switch (status) {
    case 'published':
      return '已发布';
    case 'archived':
      return '已归档';
    default:
      return '草稿';
  }
}

function expectedConversionMode(mode: ProductServiceMode) {
  return mode === 'online' ? 'link' : 'customer_service';
}

function saveButtonLabel(
  saveStage: ProductEditorDialogProps['saveStage'],
  editingProduct: AdminProduct | null,
): string {
  if (saveStage === 'uploading') return '正在上传压缩图片…';
  if (saveStage === 'saving') return '正在保存产品…';
  return editingProduct ? '保存修改' : '创建产品';
}

export function ProductEditorDialog({
  sectionName,
  editingProduct,
  form,
  media,
  coverKey,
  categories,
  groups,
  saveStage,
  processingImages,
  rotatingImageKey,
  onFormChange,
  onSelectLocalImages,
  onRotateLocalImage,
  onRemoveMedia,
  onMoveMedia,
  onSetCover,
  onClose,
  onSubmit,
}: ProductEditorDialogProps) {
  const [bodyMode, setBodyMode] = useState<BodyMode>('edit');
  const matchingGroups = useMemo(
    () => groups.filter((group) => group.mode === expectedConversionMode(form.serviceMode)),
    [form.serviceMode, groups],
  );
  const effectiveCoverKey = coverKey ?? media[0]?.key ?? null;
  const saving = saveStage !== 'idle';
  const busy = saving || processingImages || rotatingImageKey !== null;

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
          <button type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="product-editor-form" onSubmit={onSubmit}>
          <div className="product-form-grid">
            <label className="product-field product-field-wide">
              <span>产品标题</span>
              <input
                type="text"
                value={form.title}
                autoFocus
                maxLength={200}
                placeholder="输入面向用户的产品名称"
                onChange={(event) => patch({ title: event.target.value })}
              />
            </label>

            <label className="product-field">
              <span>服务类型</span>
              <select
                value={form.serviceMode}
                onChange={(event) => changeServiceMode(event.target.value as ProductServiceMode)}
              >
                <option value="offline">线下服务</option>
                <option value="online">线上服务</option>
              </select>
              <small>
                {form.serviceMode === 'offline'
                  ? 'CTA 将打开在线客服分组。'
                  : 'CTA 将跳转外部链接分组。'}
              </small>
            </label>

            <label className="product-field">
              <span>所属分类</span>
              <select
                value={form.categoryId ?? ''}
                onChange={(event) => patch({ categoryId: event.target.value || null })}
              >
                <option value="">暂不选择</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id} disabled={!category.isEnabled}>
                    {category.name}{category.isEnabled ? '' : '（已停用）'}
                  </option>
                ))}
              </select>
            </label>

            <label className="product-field product-field-wide">
              <span>{modeLabel(form.serviceMode)}转化分组</span>
              <select
                value={form.conversionGroupId ?? ''}
                onChange={(event) => patch({ conversionGroupId: event.target.value || null })}
              >
                <option value="">暂不选择</option>
                {matchingGroups.map((group) => (
                  <option
                    key={group.id}
                    value={group.id}
                    disabled={!group.isEnabled || group.activeTargetCount < 1}
                  >
                    {group.name} · {group.buttonLabel} · {group.activeTargetCount} 个启用入口
                    {!group.isEnabled ? '（已停用）' : ''}
                  </option>
                ))}
              </select>
              {matchingGroups.length === 0 ? (
                <small className="field-warning">
                  当前分区还没有可匹配的转化分组，请先到“转化池”创建。
                </small>
              ) : null}
            </label>

            {form.serviceMode === 'offline' ? (
              <label className="product-field product-field-wide">
                <span>服务地址</span>
                <input
                  type="text"
                  value={form.address ?? ''}
                  maxLength={500}
                  placeholder="线下门店或服务区域"
                  onChange={(event) => patch({ address: event.target.value || null })}
                />
              </label>
            ) : null}
          </div>

          <div className="product-body-field">
            <div className="product-body-heading">
              <div>
                <strong>产品正文</strong>
                <small>普通文本可直接输入，也支持 Markdown。</small>
              </div>
              <div className="product-editor-tabs" role="tablist" aria-label="正文编辑模式">
                <button
                  type="button"
                  className={bodyMode === 'edit' ? 'is-active' : undefined}
                  onClick={() => setBodyMode('edit')}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className={bodyMode === 'preview' ? 'is-active' : undefined}
                  onClick={() => setBodyMode('preview')}
                >
                  预览
                </button>
              </div>
            </div>
            {bodyMode === 'edit' ? (
              <textarea
                value={form.body}
                rows={12}
                maxLength={20_000}
                placeholder="输入产品介绍、服务内容和注意事项"
                onChange={(event) => patch({ body: event.target.value })}
              />
            ) : (
              <div className="product-markdown-preview">
                {form.body.trim() ? (
                  <MarkdownPreview source={form.body} />
                ) : (
                  <p className="product-preview-empty">正文为空，暂无预览。</p>
                )}
              </div>
            )}
          </div>

          <section className="product-media-section" aria-labelledby="product-media-title">
            <div className="product-media-heading">
              <div>
                <strong id="product-media-title">产品图片</strong>
                <small>
                  选择后在浏览器压缩为最长边 1400px、质量 0.82 的 WebP；可本地旋转、排序、删除和设封面。只有点击保存产品后才上传压缩图，原图不会上传到 R2。
                </small>
              </div>
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
                {processingImages ? '浏览器压缩中…' : '选择本地图片'}
              </label>
            </div>

            <div className="product-local-first-note">
              <strong>本地优先</strong>
              <span>支持 JPG、PNG、WebP，最多 12 张。GIF 和 SVG 不上传原图，请先转换为静态图片。</span>
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
                    <article
                      className={`product-media-card${isCover ? ' is-cover' : ''}${
                        item.kind === 'local' ? ' is-local' : ''
                      }`}
                      key={item.key}
                    >
                      <div className="product-media-preview">
                        {previewUrl ? (
                          <img src={previewUrl} alt={fileName} />
                        ) : (
                          <span>无公开预览</span>
                        )}
                        <div className="product-media-badges">
                          {isCover ? <b>封面</b> : null}
                          {item.kind === 'local' ? <b className="is-local-badge">本地待保存</b> : null}
                        </div>
                      </div>
                      <div className="product-media-meta">
                        <strong title={fileName}>{fileName}</strong>
                        <small>
                          {dimensions.width && dimensions.height
                            ? `${dimensions.width} × ${dimensions.height}`
                            : '尺寸未知'}
                          {' · '}
                          {formatImageBytes(getEditorImageByteSize(item))}
                        </small>
                        {item.kind === 'local' ? (
                          <small>
                            原图 {formatImageBytes(item.originalByteSize)}，仅保留在当前浏览器会话
                          </small>
                        ) : (
                          <small>已存储于 R2</small>
                        )}
                      </div>
                      <div className="product-media-actions">
                        <button
                          type="button"
                          disabled={index === 0 || busy}
                          onClick={() => onMoveMedia(item.key, -1)}
                        >
                          前移
                        </button>
                        <button
                          type="button"
                          disabled={index === media.length - 1 || busy}
                          onClick={() => onMoveMedia(item.key, 1)}
                        >
                          后移
                        </button>
                        {item.kind === 'local' ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onRotateLocalImage(item.key, -1)}
                            >
                              左转
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onRotateLocalImage(item.key, 1)}
                            >
                              {rotating ? '处理中…' : '右转'}
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          disabled={isCover || busy}
                          onClick={() => onSetCover(item.key)}
                        >
                          设为封面
                        </button>
                        <button
                          className="text-danger"
                          type="button"
                          disabled={busy}
                          onClick={() => onRemoveMedia(item.key)}
                        >
                          移除
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="product-media-empty">尚未选择产品图片。</div>
            )}

            {coverKey ? (
              <button className="product-auto-cover" type="button" disabled={busy} onClick={() => onSetCover(null)}>
                改为自动使用第一张图片作为封面
              </button>
            ) : null}
          </section>

          <div className="product-form-grid product-publishing-grid">
            <label className="product-field">
              <span>发布状态</span>
              <select
                value={form.status}
                onChange={(event) => patch({ status: event.target.value as ProductStatus })}
              >
                <option value="draft">草稿</option>
                <option value="published">发布</option>
                <option value="archived">归档</option>
              </select>
              <small>当前选择：{statusLabel(form.status)}</small>
            </label>

            <label className="product-field">
              <span>产品排序</span>
              <input
                type="number"
                min={0}
                max={1_000_000}
                value={form.sortOrder}
                onChange={(event) => patch({ sortOrder: Number(event.target.value) })}
              />
            </label>

            <label className="product-switch-field">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) => patch({ isFeatured: event.target.checked })}
              />
              <span>
                <strong>热门推荐</strong>
                <small>启用后进入前端热门产品列表。</small>
              </span>
            </label>

            <label className="product-field">
              <span>热门排序</span>
              <input
                type="number"
                min={0}
                max={1_000_000}
                value={form.featuredOrder}
                disabled={!form.isFeatured}
                onChange={(event) => patch({ featuredOrder: Number(event.target.value) })}
              />
            </label>
          </div>

          <div className="product-publish-checklist">
            <strong>发布检查</strong>
            <span className={form.categoryId ? 'is-ready' : undefined}>分类</span>
            <span className={form.conversionGroupId ? 'is-ready' : undefined}>转化分组</span>
            <span className={media.length > 0 ? 'is-ready' : undefined}>产品图片</span>
            {form.serviceMode === 'offline' ? (
              <span className={form.address ? 'is-ready' : undefined}>服务地址</span>
            ) : null}
          </div>

          <div className="admin-dialog-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              取消
            </button>
            <button className="primary-button" type="submit" disabled={busy}>
              {saveButtonLabel(saveStage, editingProduct)}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
