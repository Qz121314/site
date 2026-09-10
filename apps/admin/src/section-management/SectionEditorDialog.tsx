import type { FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { AdminDialog } from '../components/ui/dialog';
import {
  formatBrandingBytes,
  type LocalBrandingImage,
} from '../branding-media/local-branding-image';
import type { AdminSection } from '../api';
import type { SectionEditorInput } from './config';

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
  onClose,
  onSubmit,
}: SectionEditorDialogProps) {
  const busy = saving || processingIcon;

  return (
    <AdminDialog
      open
      title={editingSection ? '编辑分区' : '新增分区'}
      onClose={onClose}
      closeDisabled={busy}
      size="large"
      className="section-editor-dialog"
    >
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
                onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              />
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
                  <span className="section-icon-empty">未选择</span>
                )}
              </div>
              <div className="section-icon-upload-copy">
                <strong>快捷图标</strong>
                {localIcon ? (
                  <small>
                    {localIcon.width} × {localIcon.height} ·{' '}
                    {formatBrandingBytes(localIcon.compressedFile.size)}
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
                onFormChange({ ...form, sortOrder: Number(event.target.value) || 0 })
              }
            />
          </label>
        </section>

        <div className="admin-dialog-actions">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={processingIcon}
          >
            保存修改
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
