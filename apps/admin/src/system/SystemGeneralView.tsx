import { useState, type FormEvent } from 'react';
import { useAdminDirtySource } from '../admin-unsaved-state';
import { MediaPickerDialog } from '../asset-library/MediaPickerDialog';
import { formatBrandingBytes } from '../branding-media/local-branding-image';
import { AdminActionBar } from '../components/ui/action-bar';
import { Button } from '../components/ui/button';
import { AdminFieldRow, AdminFormSection } from '../components/ui/form-section';
import { Input } from '../components/ui/input';
import { AdminStatusBadge } from '../components/ui/status-badge';
import type { SiteSettingsWithHero } from '../site-hero-settings-api';
import {
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import { useBrandingImageDraft } from '../settings/useBrandingImageDraft';
import './system-settings.css';

type GeneralDraft = {
  siteName: string;
  locationLabel: string;
  logoAssetId: string | null;
};

function createGeneralDraft(settings: SiteSettingsWithHero): GeneralDraft {
  return {
    siteName: settings.siteName,
    locationLabel: settings.locationLabel,
    logoAssetId: settings.logoAssetId,
  };
}

export function SystemGeneralView({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState<GeneralDraft>(() => createGeneralDraft(settings));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const branding = useBrandingImageDraft({
    kind: 'logo',
    assetId: draft.logoAssetId,
    onAssetIdChange: (logoAssetId) =>
      setDraft((current) => ({ ...current, logoAssetId })),
  });
  const dirty =
    Boolean(branding.localImage) ||
    !settingsValueEqual(draft, createGeneralDraft(settings));

  useAdminDirtySource('system-general', '系统常规设置', dirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving || branding.processing) return;
    setSaving(true);
    setMessage(null);
    try {
      const logoAssetId = await branding.uploadPending();
      const base = toSiteSettingsUpdateInput(settings);
      const updated = await saveSettings({
        ...base,
        siteName: draft.siteName,
        locationLabel: draft.locationLabel,
        logoAssetId,
      });
      setDraft(createGeneralDraft(updated));
      setMessage({ type: 'success', text: '站点身份设置已保存。' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '站点身份设置保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || branding.processing;

  return (
    <>
      <form
        className="settings-workspace settings-workspace--general is-narrow"
        onSubmit={handleSubmit}
      >
        <AdminFormSection title="站点身份">
          <div className="settings-workspace-fields">
            <AdminFieldRow label="站点名称" htmlFor="system-site-name">
              <Input
                id="system-site-name"
                type="text"
                value={draft.siteName}
                disabled={busy}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, siteName: event.target.value }))
                }
              />
            </AdminFieldRow>
            <AdminFieldRow label="站点说明" htmlFor="system-location-label">
              <Input
                id="system-location-label"
                type="text"
                value={draft.locationLabel}
                disabled={busy}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    locationLabel: event.target.value,
                  }))
                }
              />
            </AdminFieldRow>
          </div>
        </AdminFormSection>

        <AdminFormSection title="站点 Logo">
          <AdminFieldRow label="Logo">
            <div className="settings-media-control">
              <div className="settings-media-preview">
                {branding.previewUrl ? (
                  <img src={branding.previewUrl} alt="站点 Logo 预览" />
                ) : (
                  <span>Logo</span>
                )}
              </div>
              <div className="settings-media-copy">
                <p>
                  {branding.localImage
                    ? `待保存 · ${branding.localImage.width} × ${branding.localImage.height} · ${formatBrandingBytes(branding.localImage.compressedFile.size)}`
                    : draft.logoAssetId
                      ? '已设置站点 Logo。'
                      : '当前未设置 Logo。'}
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
                              error instanceof Error
                                ? error.message
                                : 'Logo 本地处理失败。',
                          });
                        });
                      }}
                    />
                    {branding.processing
                      ? '处理中…'
                      : branding.previewUrl
                        ? '上传替换'
                        : '上传'}
                  </label>
                  <Button
                    variant="secondary"
                    size="compact"
                    type="button"
                    disabled={busy}
                    onClick={() => setPickerOpen(true)}
                  >
                    从素材中心选择
                  </Button>
                  {branding.previewUrl ? (
                    <Button
                      variant="ghost"
                      size="compact"
                      type="button"
                      disabled={busy}
                      onClick={branding.clear}
                    >
                      移除
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </AdminFieldRow>
        </AdminFormSection>

        <AdminActionBar
          status={
            message ? (
              <AdminStatusBadge
                tone={message.type === 'success' ? 'success' : 'danger'}
                role={message.type === 'error' ? 'alert' : 'status'}
              >
                {message.text}
              </AdminStatusBadge>
            ) : dirty ? (
              <AdminStatusBadge tone="warning">未保存更改</AdminStatusBadge>
            ) : null
          }
        >
          <Button
            variant="primary"
            type="submit"
            loading={saving}
            disabled={!dirty || branding.processing}
          >
            保存常规设置
          </Button>
        </AdminActionBar>
      </form>

      {pickerOpen ? (
        <MediaPickerDialog
          title="选择站点 Logo"
          role="logo"
          allowedKinds={['image']}
          selectedIds={draft.logoAssetId ? [draft.logoAssetId] : []}
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
