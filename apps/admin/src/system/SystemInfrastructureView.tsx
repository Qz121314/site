import { useState, type FormEvent } from 'react';
import { AdminApiError, testMediaDomain } from '../api';
import { useAdminDirtySource } from '../admin-unsaved-state';
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
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
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

  const testing = domainTest.status === 'testing';
  const busy = saving || testing;

  return (
    <form className="settings-workspace is-medium" onSubmit={handleSubmit}>
      <AdminFormSection
        title="媒体域名"
        description="配置 R2 自定义域名。连接测试继续使用现有验证 API，不改变后端校验行为。"
      >
        <AdminFieldRow
          label="R2 自定义域名"
          description="用于公开媒体读取；保存前可验证当前地址是否可访问。"
          htmlFor="system-media-base-url"
          status={
            domainTest.status === 'success' || domainTest.status === 'error' ? (
              <AdminStatusBadge
                tone={domainTest.status === 'success' ? 'success' : 'danger'}
                role={domainTest.status === 'error' ? 'alert' : 'status'}
              >
                {domainTest.message}
              </AdminStatusBadge>
            ) : testing ? (
              <AdminStatusBadge tone="info">正在测试连接</AdminStatusBadge>
            ) : null
          }
        >
          <div className="system-domain-control">
            <Input
              id="system-media-base-url"
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
            <Button
              variant="secondary"
              type="button"
              loading={testing}
              disabled={saving || !draft.mediaBaseUrl.trim()}
              onClick={() => void handleDomainTest()}
            >
              测试连接
            </Button>
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
          disabled={!dirty || testing}
        >
          保存基础设施设置
        </Button>
      </AdminActionBar>
    </form>
  );
}
