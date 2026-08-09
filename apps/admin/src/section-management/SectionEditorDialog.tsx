import type { FormEvent } from 'react';
import {
  formatBrandingBytes,
  type LocalBrandingImage,
} from '../branding-media/local-branding-image';
import type { AdminSection } from '../api';
import { sectionIconOptions, type SectionEditorInput } from './config';

type SectionEditorDialogProps = {
  editingSection: AdminSection | null;
  form: SectionEditorInput;
  iconPreviewUrl: string | null;
  browseBackgroundPreviewUrl: string | null;
  localIcon: LocalBrandingImage | null;
  errorMessage: string;
  saving: boolean;
  processingIcon: boolean;
  onFormChange: (form: SectionEditorInput) => void;
  onSelectIconFile: (file: File) => void;
  onOpenMediaPicker: () => void;
  onOpenBrowseBackgroundPicker: () => void;
  onRemoveImageIcon: () => void;
  onRemoveBrowseBackground: () => void;
  onSelectFallbackIcon: (icon: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function SectionEditorDialog({
  editingSection,
  form,
  iconPreviewUrl,
  browseBackgroundPreviewUrl,
  localIcon,
  errorMessage,
  saving,
  processingIcon,
  onFormChange,
  onSelectIconFile,
  onOpenMediaPicker,
  onOpenBrowseBackgroundPicker,
  onRemoveImageIcon,
  onRemoveBrowseBackground,
  onSelectFallbackIcon,
  onClose,
  onSubmit,
}: SectionEditorDialogProps) {
  const busy = saving || processingIcon;

  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog section-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="section-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{editingSection ? '修改现有分区' : '创建业务分区'}</p>
            <h3 id="section-editor-title">{editingSection ? '编辑分区' : '新增分区'}</h3>
          </div>
          <button type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="section-editor-form" onSubmit={onSubmit}>
          {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}

          <label>
            <span>分区名称</span>
            <input
              type="text"
              value={form.name}
              placeholder="例如 Massage"
              autoFocus
              required
              maxLength={100}
              disabled={busy}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            />
            <small>请输入用户前端实际显示的 English 名称。</small>
          </label>

          <label>
            <span>分区简介</span>
            <textarea
              value={form.description}
              placeholder="简要说明这个分区包含什么内容"
              maxLength={280}
              rows={3}
              disabled={busy}
              onChange={(event) => onFormChange({ ...form, description: event.target.value })}
            />
            <small>用于 Browse 分区列表，建议 1–2 行；留空时前端不显示简介。</small>
          </label>

          <fieldset className="section-image-icon-fieldset">
            <legend>分区快捷图标</legend>
            <div className="section-icon-upload-row">
              <div className="section-icon-large-preview">
                {iconPreviewUrl ? (
                  <img src={iconPreviewUrl} alt="分区图标预览" />
                ) : (
                  <span aria-hidden="true">{form.iconValue || sectionIconOptions[0]}</span>
                )}
              </div>
              <div className="section-icon-upload-copy">
                <strong>{iconPreviewUrl ? '当前使用图片图标' : '当前使用字符图标'}</strong>
                <p>主要用于 Home 快捷分区入口。支持 JPG、PNG、WebP，也可从素材中心复用已有图片。</p>
                {localIcon ? (
                  <small>
                    压缩后 {localIcon.width} × {localIcon.height} ·{' '}
                    {formatBrandingBytes(localIcon.compressedFile.size)}；原图{' '}
                    {formatBrandingBytes(localIcon.originalByteSize)}
                  </small>
                ) : form.iconAssetId ? (
                  <small>已绑定素材中心图片。</small>
                ) : null}
                <div className="section-icon-upload-actions">
                  <label className={`branding-file-button${busy ? ' is-disabled' : ''}`}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = '';
                        if (file) onSelectIconFile(file);
                      }}
                    />
                    {processingIcon ? '浏览器压缩中…' : iconPreviewUrl ? '上传替换' : '上传图片图标'}
                  </label>
                  <button type="button" className="secondary-button" disabled={busy} onClick={onOpenMediaPicker}>
                    从素材中心选择
                  </button>
                  {iconPreviewUrl ? (
                    <button type="button" className="secondary-button" disabled={busy} onClick={onRemoveImageIcon}>
                      移除图片图标
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="section-browse-background-fieldset">
            <legend>Browse 分区背景图</legend>
            <div className="section-browse-background-control">
              <div className="section-browse-background-preview">
                {browseBackgroundPreviewUrl ? (
                  <img src={browseBackgroundPreviewUrl} alt="Browse 分区背景图预览" />
                ) : (
                  <span>未设置背景图</span>
                )}
              </div>
              <div className="section-icon-upload-copy">
                <strong>{browseBackgroundPreviewUrl ? '已设置背景图' : '使用主题默认背景'}</strong>
                <p>只用于 Browse 的详细分区卡片，不会显示在 Home 快捷入口，也不会替代产品封面。</p>
                <div className="section-icon-upload-actions">
                  <button type="button" className="secondary-button" disabled={busy} onClick={onOpenBrowseBackgroundPicker}>
                    从素材中心选择
                  </button>
                  {browseBackgroundPreviewUrl ? (
                    <button type="button" className="secondary-button" disabled={busy} onClick={onRemoveBrowseBackground}>
                      移除背景图
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>备用字符图标</legend>
            <small className="section-icon-help">未上传图片图标时用于 Home 快捷入口；选择任意字符会切换回字符图标。</small>
            <div className="icon-picker">
              {sectionIconOptions.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  disabled={busy}
                  className={!iconPreviewUrl && form.iconValue === icon ? 'is-selected' : undefined}
                  aria-label={`选择图标 ${icon}`}
                  onClick={() => onSelectFallbackIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            <span>排序</span>
            <input
              type="number"
              min="0"
              max="1000000"
              step="1"
              required
              value={form.sortOrder}
              disabled={busy}
              onChange={(event) => onFormChange({ ...form, sortOrder: Number(event.target.value) })}
            />
            <small>数字越小越靠前，也可以在列表中使用上下移动。</small>
          </label>

          <label className="switch-row">
            <span>
              <strong>是否启用</strong>
              <small>停用后不进入用户前端发布内容。</small>
            </span>
            <input
              type="checkbox"
              checked={form.isEnabled}
              disabled={busy}
              onChange={(event) => onFormChange({ ...form, isEnabled: event.target.checked })}
            />
          </label>

          <div className="admin-dialog-actions">
            <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {saving ? '正在上传并保存…' : editingSection ? '保存修改' : '创建分区'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
