import { useMemo, useState, type FormEvent } from 'react';
import type { AdminCategory } from '../category-management/api';
import type { AdminConversionGroup } from '../conversion-pool/api';
import { MarkdownPreview } from '../faq-management/MarkdownPreview';
import type {
  AdminProduct,
  AdminProductMedia,
  ProductInput,
  ProductServiceMode,
  ProductStatus,
} from './api';

type ProductEditorDialogProps = {
  sectionName: string;
  editingProduct: AdminProduct | null;
  form: ProductInput;
  media: AdminProductMedia[];
  categories: AdminCategory[];
  groups: AdminConversionGroup[];
  saving: boolean;
  uploading: boolean;
  onFormChange: (next: ProductInput) => void;
  onUpload: (files: File[]) => void;
  onRemoveMedia: (id: string) => void;
  onMoveMedia: (id: string, direction: -1 | 1) => void;
  onSetCover: (id: string | null) => void;
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

export function ProductEditorDialog({
  sectionName,
  editingProduct,
  form,
  media,
  categories,
  groups,
  saving,
  uploading,
  onFormChange,
  onUpload,
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
  const effectiveCoverId = form.coverAssetId ?? media[0]?.id ?? null;

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
          <button type="button" aria-label="关闭" disabled={saving || uploading} onClick={onClose}>
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
                  最多 12 张；支持 JPG、PNG、WebP、GIF；单张不超过 10 MB。未指定封面时使用第一张。
                </small>
              </div>
              <label className={`product-upload-button${uploading ? ' is-disabled' : ''}`}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  disabled={uploading || media.length >= 12}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.currentTarget.value = '';
                    if (files.length > 0) onUpload(files);
                  }}
                />
                {uploading ? '正在上传…' : '上传图片'}
              </label>
            </div>

            {media.length > 0 ? (
              <div className="product-media-grid">
                {media.map((item, index) => (
                  <article
                    className={`product-media-card${effectiveCoverId === item.id ? ' is-cover' : ''}`}
                    key={item.id}
                  >
                    <div className="product-media-preview">
                      {item.publicUrl ? (
                        <img src={item.publicUrl} alt={item.fileName} />
                      ) : (
                        <span>无公开预览</span>
                      )}
                      {effectiveCoverId === item.id ? <b>封面</b> : null}
                    </div>
                    <div className="product-media-meta">
                      <strong title={item.fileName}>{item.fileName}</strong>
                      <small>
                        {item.width && item.height ? `${item.width} × ${item.height}` : '尺寸未知'}
                      </small>
                    </div>
                    <div className="product-media-actions">
                      <button
                        type="button"
                        disabled={index === 0 || uploading}
                        onClick={() => onMoveMedia(item.id, -1)}
                      >
                        前移
                      </button>
                      <button
                        type="button"
                        disabled={index === media.length - 1 || uploading}
                        onClick={() => onMoveMedia(item.id, 1)}
                      >
                        后移
                      </button>
                      <button
                        type="button"
                        disabled={effectiveCoverId === item.id || uploading}
                        onClick={() => onSetCover(item.id)}
                      >
                        设为封面
                      </button>
                      <button
                        className="text-danger"
                        type="button"
                        disabled={uploading}
                        onClick={() => onRemoveMedia(item.id)}
                      >
                        移除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="product-media-empty">尚未上传产品图片。</div>
            )}

            {form.coverAssetId ? (
              <button className="product-auto-cover" type="button" onClick={() => onSetCover(null)}>
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
            <button type="button" disabled={saving || uploading} onClick={onClose}>
              取消
            </button>
            <button className="primary-button" type="submit" disabled={saving || uploading}>
              {saving ? '正在保存…' : editingProduct ? '保存修改' : '创建产品'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
