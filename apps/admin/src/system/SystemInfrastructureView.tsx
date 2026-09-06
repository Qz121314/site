import { useState, type FormEvent } from 'react';
import { AdminApiError, testMediaDomain } from '../api';
import { useAdminDirtySource } from '../admin-unsaved-state';
import type { SiteSettingsWithHero } from '../site-hero-settings-api';
import {
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import './system-settings.css';

type DomainTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

function createInfrastructureDraft(settings: SiteSettingsWithHero) {
  return { mediaBaseUrl: settings.mediaBaseUrl ?? '' };
}

export function SystemInfrastructureView({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState(() => createInfrastructureDraft(settings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [domainTest, setDomainTest] = useState<DomainTestState>({ status: 'idle' });
  const dirty = !settingsValueEqual(draft, createInfrastructureDraft(settings));

  useAdminDirtySource('system-infrastructure', '基础设施设置', dirty);

  async function handleDomainTest() {
    const mediaBaseUrl = draft.mediaBaseUrl.trim();
    if (!mediaBaseUrl || domainTest.status === 'testing') return;
    setDomainTest({ status: 'testing' });
    try {
      const result = await testMediaDomain(mediaBaseUrl);
      setDraft({ mediaBaseUrl: result.mediaBaseUrl });
      setDomainTest({
        status: 'success',
        message: `连接成功 · HTTP ${result.responseStatus}`,
      });
    } catch (error) {
      if (
        error instanceof AdminApiError &&
        (error.status === 401 || error.code === 'SESSION_INVALID')
      ) {
        onSessionExpired();
        return;
      }
      setDomainTest({
        status: 'error',
        message: error instanceof Error ? error.message : 'R2 自定义域名连接测试失败。',
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving || domainTest.status === 'testing') return;
    setSaving(true);
    setMessage(null);
    try {
      const base = toSiteSettingsUpdateInput(settings);
      const updated = await saveSettings({
        ...base,
        mediaBaseUrl: draft.mediaBaseUrl.trim() || null,
      });
      setDraft(createInfrastructureDraft(updated));
      setMessage({ type: 'success', text: '基础设施设置已保存。' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '基础设施设置保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || domainTest.status === 'testing';

  return (
    <form className="settings-workspace is-medium" onSubmit={handleSubmit}>
      <section className="settings-workspace-section" aria-labelledby="infrastructure-title">
        <div className="settings-workspace-heading">
          <div>
            <h2 id="infrastructure-title">媒体域名</h2>
            <p>配置 R2 自定义域名。连接测试继续使用现有验证 API，不改变后端校验行为。</p>
          </div>
        </div>

        <div className="system-domain-row">
          <label className="field-group">
            <span>R2 自定义域名</span>
            <input
              type="url"
              value={draft.mediaBaseUrl}
              placeholder="https://assets.example.com"
              disabled={busy}
              onChange={(event) => {
                setDraft({ mediaBaseUrl: event.target.value });
                setDomainTest({ status: 'idle' });
                setMessage(null);
              }}
            />
          </label>
          <button
            className="secondary-button system-domain-test-button"
            type="button"
            disabled={busy || !draft.mediaBaseUrl.trim()}
            onClick={() => void handleDomainTest()}
          >
            {domainTest.status === 'testing' ? '测试中…' : '测试连接'}
          </button>
        </div>

        {domainTest.status === 'success' || domainTest.status === 'error' ? (
          <p
            className={`settings-workspace-status is-${domainTest.status}`}
            role={domainTest.status === 'error' ? 'alert' : 'status'}
          >
            {domainTest.message}
          </p>
        ) : null}
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
          {saving ? '保存中…' : '保存基础设施设置'}
        </button>
      </div>
    </form>
  );
}
