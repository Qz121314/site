import { useState, type FormEvent } from 'react';
import { useAdminDirtySource } from '../admin-unsaved-state';
import type { SiteSettingsWithHero } from '../site-hero-settings-api';
import {
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import './system-settings.css';

function createAdvancedDraft(settings: SiteSettingsWithHero) {
  return { ga4MeasurementId: settings.ga4MeasurementId ?? '' };
}

export function SystemAdvancedView({
  onSessionExpired: _onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState(() => createAdvancedDraft(settings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const dirty = !settingsValueEqual(draft, createAdvancedDraft(settings));

  useAdminDirtySource('system-advanced', '系统高级设置', dirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const base = toSiteSettingsUpdateInput(settings);
      const updated = await saveSettings({
        ...base,
        ga4MeasurementId: draft.ga4MeasurementId.trim() || null,
      });
      setDraft(createAdvancedDraft(updated));
      setMessage({ type: 'success', text: '高级设置已保存。' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '高级设置保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-workspace is-narrow" onSubmit={handleSubmit}>
      <section
        className="settings-workspace-section"
        aria-labelledby="advanced-analytics-title"
      >
        <div className="settings-workspace-heading">
          <div>
            <h2 id="advanced-analytics-title">统计集成</h2>
            <p>GA4 是可选配置。留空表示不注入 Google Analytics Measurement ID。</p>
          </div>
        </div>

        <label className="field-group">
          <span>GA4 Measurement ID</span>
          <input
            type="text"
            value={draft.ga4MeasurementId}
            placeholder="G-XXXXXXXXXX"
            disabled={saving}
            aria-describedby="ga4-help"
            onChange={(event) => {
              setDraft({ ga4MeasurementId: event.target.value });
              setMessage(null);
            }}
          />
          <small id="ga4-help" className="settings-inline-note">
            可选；仅保存现有字段，不创建新的统计或追踪能力。
          </small>
        </label>
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
        <button className="primary-button" type="submit" disabled={!dirty || saving}>
          {saving ? '保存中…' : '保存高级设置'}
        </button>
      </div>
    </form>
  );
}
