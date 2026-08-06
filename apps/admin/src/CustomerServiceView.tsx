import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  fetchCustomerServiceSettings,
  updateCustomerServiceSettings,
  type CustomerServiceSettings,
  type CustomerServiceSettingsInput,
} from './api';

type CustomerServiceViewProps = {
  onSessionExpired: () => void;
};

type Draft = {
  isEnabled: boolean;
  provider: string;
  endpointUrl: string;
  projectId: string;
  config: string;
};

function createDraft(settings: CustomerServiceSettings): Draft {
  return {
    isEnabled: settings.isEnabled,
    provider: settings.provider ?? '',
    endpointUrl: settings.endpointUrl ?? '',
    projectId: settings.projectId ?? '',
    config: settings.config ?? '',
  };
}

function toInput(draft: Draft): CustomerServiceSettingsInput {
  return {
    isEnabled: draft.isEnabled,
    provider: draft.provider.trim() || null,
    endpointUrl: draft.endpointUrl.trim() || null,
    projectId: draft.projectId.trim() || null,
    config: draft.config.trim() || null,
  };
}

export function CustomerServiceView({ onSessionExpired }: CustomerServiceViewProps) {
  const [settings, setSettings] = useState<CustomerServiceSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await fetchCustomerServiceSettings();
      setSettings(result);
      setDraft(createDraft(result));
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '无法读取客服设置。');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setMessage('');
    setErrorMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;

    setSaving(true);
    setMessage('');
    setErrorMessage('');
    try {
      const updated = await updateCustomerServiceSettings(toInput(draft));
      setSettings(updated);
      setDraft(createDraft(updated));
      setMessage('客服连接设置已保存。');
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '保存客服设置失败。');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="settings-card">正在读取客服设置…</section>;
  }

  if (!draft || !settings) {
    return (
      <section className="settings-card settings-error-state">
        <strong>无法读取客服设置</strong>
        <p>{errorMessage || '请检查数据库迁移和后台接口。'}</p>
        <button className="secondary-button" type="button" onClick={() => void load()}>
          重新加载
        </button>
      </section>
    );
  }

  return (
    <form className="settings-form" onSubmit={(event) => void submit(event)}>
      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">外部系统对接</p>
            <h2>客服管理系统</h2>
          </div>
          <span className={draft.isEnabled ? 'status-chip is-configured' : 'status-chip'}>
            {draft.isEnabled ? '已启用' : '未启用'}
          </span>
        </div>

        <label className="toggle-row">
          <span>
            <strong>启用客服入口</strong>
            <small>启用后，用户前端可以加载外部客服系统入口。</small>
          </span>
          <input
            type="checkbox"
            checked={draft.isEnabled}
            disabled={saving}
            onChange={(event) => updateDraft('isEnabled', event.target.checked)}
          />
        </label>

        <div className="settings-grid">
          <label className="field-group">
            <span>客服系统提供商</span>
            <input
              type="text"
              value={draft.provider}
              placeholder="例如：自建客服 / Crisp / Intercom"
              disabled={saving}
              onChange={(event) => updateDraft('provider', event.target.value)}
            />
          </label>

          <label className="field-group">
            <span>客服系统地址</span>
            <input
              type="url"
              value={draft.endpointUrl}
              placeholder="https://support.example.com"
              disabled={saving}
              onChange={(event) => updateDraft('endpointUrl', event.target.value)}
            />
          </label>

          <label className="field-group">
            <span>项目 ID / App ID</span>
            <input
              type="text"
              value={draft.projectId}
              disabled={saving}
              onChange={(event) => updateDraft('projectId', event.target.value)}
            />
          </label>
        </div>

        <label className="field-group">
          <span>扩展配置 JSON</span>
          <textarea
            value={draft.config}
            rows={8}
            placeholder={'{\n  "widgetId": "..."\n}'}
            spellCheck={false}
            disabled={saving}
            onChange={(event) => updateDraft('config', event.target.value)}
          />
          <small>只保存外部客服系统需要的公开配置。敏感密钥继续放 Worker 变量。</small>
        </label>
      </section>

      {errorMessage ? <p className="inline-status is-error">{errorMessage}</p> : null}
      {message ? <p className="inline-status is-success">{message}</p> : null}

      <div className="settings-actions">
        <span>这里不管理坐席、聊天记录或工单。</span>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? '正在保存…' : '保存客服设置'}
        </button>
      </div>
    </form>
  );
}
