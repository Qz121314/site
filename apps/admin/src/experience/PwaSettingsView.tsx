import { useState, type FormEvent } from 'react';
import { useAdminDirtySource } from '../admin-unsaved-state';
import { MediaPickerDialog } from '../asset-library/MediaPickerDialog';
import type { SiteSettingsWithHero } from '../site-hero-settings-api';
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

export function PwaSettingsView({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState<PwaDraft>(() => createPwaDraft(settings));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
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
      window.dispatchEvent(
        new CustomEvent('admin:pwa-icon-updated', {
          detail: { assetId: updated.pwaIconAssetId },
        }),
      );
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
  const pwaInstallUrl = new URL('/?pwa-install=1', window.location.origin).toString();

  async function copyPwaInstallUrl() {
    try {
      await navigator.clipboard.writeText(pwaInstallUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setMessage({ type: 'error', text: '链接复制失败，请手动复制。' });
    }
  }

  return (
    <>
      <form
        className="settings-workspace settings-workspace--pwa is-medium"
        onSubmit={handleSubmit}
      >
        <section
          className="settings-workspace-section pwa-settings-panel"
          aria-label="应用安装"
        >
          <div className="pwa-settings-top-row">
            <div className="pwa-icon-layout">
              <div className="settings-media-control" aria-label="应用图标">
                <button
                  className={`pwa-icon-upload-target${busy ? ' is-disabled' : ''}`}
                  type="button"
                  aria-label="从素材中心选择应用图标"
                  disabled={busy}
                  onClick={() => setPickerOpen(true)}
                >
                  {branding.previewUrl ? (
                    <img src={branding.previewUrl} alt="PWA 图标预览" />
                  ) : (
                    <span aria-hidden="true">+</span>
                  )}
                </button>
                <div className="settings-media-copy">
                  <div className="settings-media-actions">
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
            </div>
            <div className="pwa-settings-heading-actions">
              <button
                className="ui-button ui-button--primary ui-button--compact pwa-save-button"
                type="submit"
                disabled={!dirty || busy}
              >
                {saving ? '保存中…' : '保存 PWA 设置'}
              </button>
              <label className="settings-inline-switch">
                <input
                  type="checkbox"
                  checked={draft.installPrompt.enabled}
                  disabled={busy}
                  onChange={(event) =>
                    updateInstallPrompt({ enabled: event.target.checked })
                  }
                />
                <span>{draft.installPrompt.enabled ? '已开启' : '已关闭'}</span>
              </label>
            </div>
          </div>

          <div className="settings-workspace-fields is-two-column pwa-install-fields">
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
                    delaySeconds: Math.max(
                      5,
                      Math.min(120, Number(event.target.value) || 30),
                    ),
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
            <label className="field-group pwa-install-action-field">
              <span>安装按钮</span>
              <input
                type="text"
                maxLength={32}
                value={draft.installPrompt.installLabel}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) =>
                  updateInstallPrompt({ installLabel: event.target.value })
                }
              />
            </label>
            <label className="field-group settings-field-span-two">
              <span>桌面端说明</span>
              <input
                type="text"
                maxLength={160}
                value={draft.installPrompt.description}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) =>
                  updateInstallPrompt({ description: event.target.value })
                }
              />
            </label>
            <label className="field-group settings-field-span-two">
              <span>iPhone / iPad 说明</span>
              <input
                type="text"
                maxLength={160}
                value={draft.installPrompt.iosDescription}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) =>
                  updateInstallPrompt({ iosDescription: event.target.value })
                }
              />
            </label>
            <label className="field-group pwa-dismiss-field">
              <span>关闭提示</span>
              <input
                type="text"
                maxLength={32}
                value={draft.installPrompt.dismissLabel}
                disabled={busy || !draft.installPrompt.enabled}
                onChange={(event) =>
                  updateInstallPrompt({ dismissLabel: event.target.value })
                }
              />
            </label>
          </div>
          <div className="pwa-install-link-row">
            <label className="field-group">
              <span>PWA 专属安装链接</span>
              <input type="url" readOnly value={pwaInstallUrl} />
            </label>
            <button
              className="ui-button ui-button--secondary ui-button--compact"
              type="button"
              onClick={() => void copyPwaInstallUrl()}
            >
              {linkCopied ? '已复制' : '复制链接'}
            </button>
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
