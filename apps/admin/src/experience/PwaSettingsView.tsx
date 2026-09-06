import { useState, type FormEvent } from 'react';
import { useAdminDirtySource } from '../admin-unsaved-state';
import { MediaPickerDialog } from '../asset-library/MediaPickerDialog';
import { formatBrandingBytes } from '../branding-media/local-branding-image';
import type { SiteSettings, SiteSettingsWithHero } from '../site-hero-settings-api';
import {
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import { useBrandingImageDraft } from '../settings/useBrandingImageDraft';

type InstallPrompt = SiteSettingsWithHero['installPrompt'];
type PwaDraft = {
  pwaIconAssetId: string | null;
  installPrompt: InstallPrompt;
};

function createPwaDraft(settings: SiteSettingsWithHero): PwaDraft {
  return {
    pwaIconAssetId: settings.pwaIconAssetId,
    installPrompt: { ...settings.installPrompt },
  };
}

export function PwaSettingsView({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState<PwaDraft>(() => createPwaDraft(settings));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const branding = useBrandingImageDraft({
    kind: 'pwa-icon',
    assetId: draft.pwaIconAssetId,
    onAssetIdChange: (pwaIconAssetId) =>
      setDraft((current) => ({ ...current, pwaIconAssetId })),
  });
  const dirty =
    Boolean(branding.localImage) || !settingsValueEqual(draft, createPwaDraft(settings));

  useAdminDirtySource('pwa-settings', 'PWA 设置', dirty);

  function updateInstallPrompt(patch: Partial<InstallPrompt>) {
    setDraft((current) => ({
      ...current,
      installPrompt: { ...current.installPrompt, ...patch },
    }));
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving || branding.processing) return;
    setSaving(true);
    setMessage(null);
    try {
      const pwaIconAssetId = await branding.uploadPending();
      const base = toSiteSettingsUpdateInput(settings);
      const updated = await saveSettings({
        ...base,
        pwaIconAssetId,
        installPrompt: { ...draft.installPrompt },
      });
      setDraft(createPwaDraft(updated));
      setMessage({ type: 'success', text: 'PWA 设置已保存。' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'PWA 设置保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || branding.processing;

  return (
    <>
      <form className="settings-workspace is-medium" onSubmit={handleSubmit}>
        <section className="settings-workspace-section" aria-labelledby="pwa-icon-title">
          <div className="settings-workspace-heading">
            <div>
              <h2 id="pwa-icon-title">应用图标</h2>
              <p>用于桌面图标、favicon 与 Apple Touch Icon。建议使用 1:1 正方形图片。</p>
            </div>
          </div>

          <div className="settings-media-control">
            <div className="settings-media-preview">
              {branding.previewUrl ? (
                <img src={branding.previewUrl} alt="PWA 图标预览" />
              ) : (
                <span>App</span>
              )}
            </div>
            <div className="settings-media-copy">
              <p>
                {branding.localImage
                  ? `待保存 · ${branding.localImage.width} × ${branding.localImage.height} · ${formatBrandingBytes(branding.localImage.compressedFile.size)}`
                  : draft.pwaIconAssetId
                    ? '已设置独立 PWA 图标。'
                    : '当前使用默认图标。'}
              </p>
              <div className="settings-media-actions">
                <label className={`branding-file-button${busy ? ' is-disabled' : ''}`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      if (!file) return;
                      setMessage(null);
                      void branding.selectFile(file).catch((error: unknown) => {
                        setMessage({
                          type: 'error',
                          text:
                            error instanceof Error ? error.message : 'PWA 图标本地处理失败。',
                        });
                      });
                    }}
                  />
                  {branding.processing ? '处理中…' : branding.previewUrl ? '上传替换' : '上传'}
                </label>
                <button
                  className="admin-text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setPickerOpen(true)}
                >
                  从素材中心选择
                </button>
                {branding.previewUrl ? (
                  <button
                    className="admin-text-button"
                    type="button"
                    disabled={busy}
                    onClick={branding.clear}
                  >
                    恢复默认图标
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="settings-workspace-section" aria-labelledby="pwa-prompt-title">
          <div className="settings-workspace-heading">
            <div>
              <h2 id="pwa-prompt-title">安装提示</h2>
              <p>控制用户停留一段时间后看到的轻量安装提示，不影响网页首屏。</p>
            </div>
            <label className="settings-inline-switch">
              <input
                type="checkbox"
                checked={draft.installPrompt.enabled}
                disabled={busy}
                onChange={(event) => updateInstallPrompt({ enabled: event.target.checked })}
              />
              <span>{draft.installPrompt.enabled ? '已开启' : '已关闭'}</span>
            </label>
          </div>

          <div className="settings-workspace-fields is-two-column">
            <label className="field-group">
              <span>延迟显示（秒）</span>
              <input
                type="number"
                min={5}
                max={120}
                value={draft.installPrompt.delaySeconds}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) =>
                  updateInstallPrompt({
                    delaySeconds: Math.max(5, Math.min(120, Number(event.target.value) || 30)),
                  })
                }
              />
            </label>
            <label className="field-group">
              <span>提示标题</span>
              <input
                type="text"
                maxLength={80}
                value={draft.installPrompt.title}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) => updateInstallPrompt({ title: event.target.value })}
              />
            </label>
            <label className="field-group settings-field-span-two">
              <span>桌面端说明</span>
              <input
                type="text"
                maxLength={160}
                value={draft.installPrompt.description}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) => updateInstallPrompt({ description: event.target.value })}
              />
            </label>
            <label className="field-group settings-field-span-two">
              <span>iPhone / iPad 说明</span>
              <input
                type="text"
                maxLength={160}
                value={draft.installPrompt.iosDescription}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) => updateInstallPrompt({ iosDescription: event.target.value })}
              />
            </label>
            <label className="field-group">
              <span>安装按钮</span>
              <input
                type="text"
                maxLength={32}
                value={draft.installPrompt.installLabel}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) => updateInstallPrompt({ installLabel: event.target.value })}
              />
            </label>
            <label className="field-group">
              <span>关闭提示</span>
              <input
                type="text"
                maxLength={32}
                value={draft.installPrompt.dismissLabel}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) => updateInstallPrompt({ dismissLabel: event.target.value })}
              />
            </label>
          </div>
        </section>

        <div className="settings-workspace-actions">
          {message ? (
            <span
              className={`settings-workspace-status is-${message.type}`}
              role={message.type === 'error' ? 'alert' : 'status'}
            >
              {message.text}
            </span>
          ) : null}
          <button className="primary-button" type="submit" disabled={!dirty || busy}>
            {saving ? '保存中…' : '保存 PWA 设置'}
          </button>
        </div>
      </form>

      {pickerOpen ? (
        <MediaPickerDialog
          title="选择 PWA 图标"
          role="icon"
          allowedKinds={['image']}
          selectedIds={draft.pwaIconAssetId ? [draft.pwaIconAssetId] : []}
          onSessionExpired={onSessionExpired}
          onClose={() => setPickerOpen(false)}
          onSelect={(asset) => {
            branding.chooseAsset(asset.id);
            setPickerOpen(false);
            setMessage(null);
          }}
        />
      ) : null}
    </>
  );
}
