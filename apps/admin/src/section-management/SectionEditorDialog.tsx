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
            <h3 id="section-editor-title">{editingSection ? '编辑分区' : '新增分区'}</h3>
            <p className="section-editor-header-note">
              配置前端显示内容、快捷入口和 Browse 卡片样式。
            </p>
          </div>
          <button type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="section-editor-form" onSubmit={onSubmit}>
          {errorMessage ? (
            <div className="notice notice-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <section className="section-editor-card section-editor-basic-card">
            <div className="section-editor-card-heading">
              <div>
                <strong>基本信息</strong>
                <small>这里的内容直接用于前端展示。</small>
              </div>
            </div>
            <div className="section-editor-fields-grid">
              <label>
                <span>分区名称</span>
                <input
                  type="text"
                  value={form.name}
                  placeholder="例如 ESCORTS"
                  autoFocus
                  required
                  maxLength={100}
                  disabled={busy}
                  onChange={(event) =>
                    onFormChange({ ...form, name: event.target.value })
                  }
                />
                <small>填写用户前端实际显示的 English 名称。</small>
              </label>

              <label>
                <span>分区简介</span>
                <textarea
                  value={form.description}
                  placeholder="简要说明这个分区包含什么内容"
                  maxLength={280}
                  rows={2}
                  disabled={busy}
                  onChange={(event) =>
                    onFormChange({ ...form, description: event.target.value })
                  }
                />
                <small>用于 Browse 列表；留空时前端不显示简介。</small>
              </label>
            </div>
          </section>

          <div className="section-editor-visual-grid">
            <fieldset className="section-editor-card section-image-icon-fieldset">
              <legend>分区快捷图标</legend>
              <div className="section-editor-media-row section-editor-icon-row">
                <div className="section-icon-large-preview">
                  {iconPreviewUrl ? (
                    <img src={iconPreviewUrl} alt="分区图标预览" />
                  ) : (
                    <span aria-hidden="true">
                      {form.iconValue || sectionIconOptions[0]}
                    </span>
                  )}
                </div>
                <div className="section-icon-upload-copy">
                  <strong>{iconPreviewUrl ? '图片图标' : '字符图标'}</strong>
                  <p>用于 Home 的快捷分区入口。支持 JPG、PNG、WebP 或素材中心图片。</p>
                  {localIcon ? (
                    <small>
                      {localIcon.width} × {localIcon.height} ·{' '}
                      {formatBrandingBytes(localIcon.compressedFile.size)}
                    </small>
                  ) : form.iconAssetId ? (
                    <small>已绑定素材中心图片。</small>
                  ) : null}
                  <div className="section-icon-upload-actions">
                    <label
                      className={`branding-file-button${busy ? ' is-disabled' : ''}`}
                    >
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
                      {processingIcon
                        ? '压缩中…'
                        : iconPreviewUrl
                          ? '上传替换'
                          : '上传图片'}
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={onOpenMediaPicker}
                    >
                      素材中心
                    </button>
                    {iconPreviewUrl ? (
                      <button
                        type="button"
                        className="admin-text-button"
                        disabled={busy}
                        onClick={onRemoveImageIcon}
                      >
                        移除图片
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="section-editor-card section-browse-background-fieldset">
              <legend>Browse 分区背景图</legend>
              <div className="section-editor-media-row">
                <div className="section-browse-background-preview">
                  {browseBackgroundPreviewUrl ? (
                    <img src={browseBackgroundPreviewUrl} alt="Browse 分区背景图预览" />
                  ) : (
                    <span>主题默认</span>
                  )}
                </div>
                <div className="section-icon-upload-copy">
                  <strong>
                    {browseBackgroundPreviewUrl ? '已设置背景图' : '使用主题背景'}
                  </strong>
                  <p>只用于 Browse 的详细分区卡片，不影响 Home 入口和产品封面。</p>
                  <div className="section-icon-upload-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={onOpenBrowseBackgroundPicker}
                    >
                      {browseBackgroundPreviewUrl ? '更换图片' : '选择图片'}
                    </button>
                    {browseBackgroundPreviewUrl ? (
                      <button
                        type="button"
                        className="admin-text-button"
                        disabled={busy}
                        onClick={onRemoveBrowseBackground}
                      >
                        移除背景
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          <div className="section-editor-bottom-grid">
            <fieldset className="section-editor-card section-editor-fallback-card">
              <legend>备用字符图标</legend>
              <small className="section-icon-help">
                没有图片图标时使用；点击字符会直接切回字符图标。
              </small>
              <div className="icon-picker">
                {sectionIconOptions.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    disabled={busy}
                    className={
                      !iconPreviewUrl && form.iconValue === icon
                        ? 'is-selected'
                        : undefined
                    }
                    aria-label={`选择图标 ${icon}`}
                    onClick={() => onSelectFallbackIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </fieldset>

            <section className="section-editor-card section-editor-settings-card">
              <label className="section-editor-sort-field">
                <span>排序</span>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  required
                  value={form.sortOrder}
                  disabled={busy}
                  onChange={(event) =>
                    onFormChange({ ...form, sortOrder: Number(event.target.value) })
                  }
                />
                <small>数字越小越靠前。</small>
              </label>

              <label className="switch-row section-editor-switch-row">
                <span>
                  <strong>启用分区</strong>
                  <small>关闭后不进入前端发布内容。</small>
                </span>
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  disabled={busy}
                  onChange={(event) =>
                    onFormChange({ ...form, isEnabled: event.target.checked })
                  }
                />
              </label>
            </section>
          </div>

          <div className="admin-dialog-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={onClose}
            >
              取消
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {saving ? '保存中…' : editingSection ? '保存修改' : '创建分区'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
