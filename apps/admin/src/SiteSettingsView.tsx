import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  fetchSiteSettings,
  testMediaDomain,
  updateSiteSettings,
  type SiteSettings,
  type SiteSettingsUpdateInput,
} from './api';

type SiteSettingsViewProps = {
  onSessionExpired: () => void;
};

type SettingsDraft = Omit<SiteSettingsUpdateInput, 'mediaBaseUrl'> & {
  mediaBaseUrl: string;
};

type DomainTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

function createDraft(settings: SiteSettings): SettingsDraft {
  return {
    siteName: settings.siteName,
    locationLabel: settings.locationLabel,
    mediaBaseUrl: settings.mediaBaseUrl ?? '',
    homeSectionLimit: settings.homeSectionLimit,
    showHot: settings.showHot,
    showLatest: settings.showLatest,
    showMore: settings.showMore,
    showMessages: settings.showMessages,
    showFaq: settings.showFaq,
  };
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

export function SiteSettingsView({ onSessionExpired }: SiteSettingsViewProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [domainTest, setDomainTest] = useState<DomainTestState>({ status: 'idle' });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await fetchSiteSettings();
      setSettings(result);
      setDraft(createDraft(result));
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '无法读取站点设置。');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateDraft<K extends keyof SettingsDraft>(field: K, value: SettingsDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setSuccessMessage(null);

    if (field === 'mediaBaseUrl') {
      setDomainTest({ status: 'idle' });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await updateSiteSettings({
        ...draft,
        mediaBaseUrl: draft.mediaBaseUrl.trim() || null,
      });
      setSettings(updated);
      setDraft(createDraft(updated));
      setSuccessMessage('站点设置已保存。');
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : '保存站点设置失败。');
    } finally {
      setSaving(false);
    }
  }

  async function handleDomainTest() {
    if (!draft || domainTest.status === 'testing') {
      return;
    }

    const mediaBaseUrl = draft.mediaBaseUrl.trim();
    if (!mediaBaseUrl) {
      setDomainTest({ status: 'error', message: '请先填写 R2 自定义域名。' });
      return;
    }

    setDomainTest({ status: 'testing' });

    try {
      const result = await testMediaDomain(mediaBaseUrl);
      updateDraft('mediaBaseUrl', result.mediaBaseUrl);
      setDomainTest({
        status: 'success',
        message: `连接成功，测试对象返回 HTTP ${result.responseStatus}。`,
      });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setDomainTest({
        status: 'error',
        message: error instanceof Error ? error.message : 'R2 自定义域名连接测试失败。',
      });
    }
  }

  if (loading) {
    return (
      <section className="settings-card settings-loading" aria-live="polite">
        <div className="loading-indicator" aria-hidden="true" />
        <p>正在读取站点设置…</p>
      </section>
    );
  }

  if (!draft || !settings) {
    return (
      <section className="settings-card settings-error-state">
        <strong>无法读取站点设置</strong>
        <p>{errorMessage ?? '请检查 D1 数据库和后台接口。'}</p>
        <button className="secondary-button" type="button" onClick={() => void loadSettings()}>
          重新加载
        </button>
      </section>
    );
  }

  return (
    <form className="settings-form" onSubmit={(event) => void handleSubmit(event)}>
      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">基础信息</p>
            <h2>站点显示设置</h2>
          </div>
          <small>最后更新：{formatUpdatedAt(settings.updatedAt)}</small>
        </div>

        <div className="settings-grid">
          <label className="field-group">
            <span>站点名称</span>
            <input
              type="text"
              value={draft.siteName}
              minLength={1}
              maxLength={120}
              required
              disabled={saving}
              onChange={(event) => updateDraft('siteName', event.target.value)}
            />
            <small>用于后台识别和前端站点标题。</small>
          </label>

          <label className="field-group">
            <span>位置文案</span>
            <input
              type="text"
              value={draft.locationLabel}
              minLength={1}
              maxLength={80}
              required
              disabled={saving}
              onChange={(event) => updateDraft('locationLabel', event.target.value)}
            />
            <small>显示在用户前端顶部，例如 Location / City。</small>
          </label>

          <label className="field-group field-group-compact">
            <span>首页分区数量</span>
            <input
              type="number"
              value={draft.homeSectionLimit}
              min={1}
              max={20}
              step={1}
              required
              disabled={saving}
              onChange={(event) =>
                updateDraft('homeSectionLimit', Number(event.target.value))
              }
            />
            <small>超过该数量的分区进入 More。</small>
          </label>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">R2 公共媒体</p>
            <h2>图片自定义域名</h2>
          </div>
          <span className={draft.mediaBaseUrl ? 'status-chip is-configured' : 'status-chip'}>
            {draft.mediaBaseUrl ? '已填写' : '未配置'}
          </span>
        </div>

        <div className="domain-field-row">
          <label className="field-group">
            <span>R2 自定义域名</span>
            <input
              type="url"
              value={draft.mediaBaseUrl}
              placeholder="https://assets.example.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={saving || domainTest.status === 'testing'}
              onChange={(event) => updateDraft('mediaBaseUrl', event.target.value)}
            />
            <small>
              先在 Cloudflare R2 Bucket 的 Custom Domains 中绑定，再在这里填写相同的 HTTPS Origin。
            </small>
          </label>

          <button
            className="secondary-button domain-test-button"
            type="button"
            disabled={saving || domainTest.status === 'testing' || !draft.mediaBaseUrl.trim()}
            onClick={() => void handleDomainTest()}
          >
            {domainTest.status === 'testing' ? '正在测试…' : '测试连接'}
          </button>
        </div>

        {domainTest.status === 'success' ? (
          <p className="inline-status is-success" role="status">
            {domainTest.message}
          </p>
        ) : null}
        {domainTest.status === 'error' ? (
          <p className="inline-status is-error" role="alert">
            {domainTest.message}
          </p>
        ) : null}

        <div className="settings-note">
          <strong>图片链接规则</strong>
          <code>{'{media_base_url}/{object_key}'}</code>
          <p>数据库只保存对象 Key。更换图片域名时，不需要批量修改产品或媒体记录。</p>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">用户前端入口</p>
            <h2>导航显示开关</h2>
          </div>
        </div>

        <div className="toggle-grid">
          {(
            [
              ['showHot', 'Hot', '显示热门产品入口'],
              ['showLatest', 'Latest', '显示最新产品入口'],
              ['showMore', 'More', '分区超过首页数量时显示更多入口'],
              ['showMessages', 'Messages', '客服系统完成后再启用'],
              ['showFaq', 'FAQ', '显示常见问题入口'],
            ] as const
          ).map(([field, label, description]) => (
            <label className="toggle-row" key={field}>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <input
                type="checkbox"
                checked={draft[field]}
                disabled={saving}
                onChange={(event) => updateDraft(field, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      {errorMessage ? (
        <p className="inline-status is-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="inline-status is-success" role="status">
          {successMessage}
        </p>
      ) : null}

      <div className="settings-actions">
        <span>Logo 上传将在媒体管理阶段接入，不在此处重复实现上传逻辑。</span>
        <button className="primary-button settings-save-button" type="submit" disabled={saving}>
          {saving ? '正在保存…' : '保存站点设置'}
        </button>
      </div>
    </form>
  );
}
