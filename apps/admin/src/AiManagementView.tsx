import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminApiError } from './api';
import {
  fetchAiSettings,
  testAi,
  updateAiSettings,
  type AiSettings,
  type AiSettingsInput,
  type AiTestResult,
} from './ai-management/api';

type AiManagementViewProps = {
  onSessionExpired: () => void;
};

type Draft = AiSettingsInput;

function createDraft(settings: AiSettings): Draft {
  return {
    isEnabled: settings.isEnabled,
    allowGuest: settings.allowGuest,
    model: settings.model,
    systemPrompt: settings.systemPrompt,
    dailyRequestLimit: settings.dailyRequestLimit,
    perVisitorDailyLimit: settings.perVisitorDailyLimit,
    maxInputCharacters: settings.maxInputCharacters,
    maxOutputTokens: settings.maxOutputTokens,
    temperature: settings.temperature,
  };
}

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

export function AiManagementView({ onSessionExpired }: AiManagementViewProps) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPrompt, setTestPrompt] = useState('Briefly explain how you can help a visitor choose a service.');
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleError = useCallback(
    (error: unknown, fallback: string) => {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : fallback);
    },
    [onSessionExpired],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await fetchAiSettings();
      setSettings(result);
      setDraft(createDraft(result));
    } catch (error) {
      handleError(error, '无法读取 AI 设置。');
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setMessage('');
    setErrorMessage('');
    setTestResult(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setMessage('');
    setErrorMessage('');
    try {
      const updated = await updateAiSettings(draft);
      setSettings(updated);
      setDraft(createDraft(updated));
      setMessage('AI 设置与使用限制已保存。');
    } catch (error) {
      handleError(error, '保存 AI 设置失败。');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    if (!testPrompt.trim() || testing) return;
    setTesting(true);
    setTestResult(null);
    setMessage('');
    setErrorMessage('');
    try {
      setTestResult(await testAi(testPrompt.trim()));
    } catch (error) {
      handleError(error, 'Workers AI 测试失败。');
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <section className="settings-card">正在读取 AI 设置…</section>;

  if (!draft || !settings) {
    return (
      <section className="settings-card settings-error-state">
        <strong>无法读取 AI 设置</strong>
        <p>{errorMessage || '请检查 D1 migration 和 Worker AI Binding。'}</p>
        <button className="secondary-button" type="button" onClick={() => void load()}>
          重新加载
        </button>
      </section>
    );
  }

  return (
    <form className="settings-form ai-management" onSubmit={(event) => void save(event)}>
      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">Cloudflare Workers AI</p>
            <h2>AI 功能总开关</h2>
          </div>
          <span className={draft.isEnabled ? 'status-chip is-configured' : 'status-chip'}>
            {draft.isEnabled ? '已启用' : '已关闭'}
          </span>
        </div>

        <div className="ai-toggle-grid">
          <label className="toggle-row">
            <span>
              <strong>启用 AI 服务</strong>
              <small>关闭后，公开 AI 接口直接拒绝调用，后台仍可测试模型。</small>
            </span>
            <input
              type="checkbox"
              checked={draft.isEnabled}
              disabled={saving}
              onChange={(event) => updateDraft('isEnabled', event.target.checked)}
            />
          </label>

          <label className="toggle-row">
            <span>
              <strong>允许访客使用</strong>
              <small>公开入口还会继续执行全站和单访客每日额度。</small>
            </span>
            <input
              type="checkbox"
              checked={draft.allowGuest}
              disabled={saving}
              onChange={(event) => updateDraft('allowGuest', event.target.checked)}
            />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">模型与行为</p>
            <h2>推理配置</h2>
          </div>
          <span className="status-chip is-configured">AI Binding</span>
        </div>

        <label className="field-group">
          <span>Workers AI 模型标识</span>
          <input
            type="text"
            value={draft.model}
            spellCheck={false}
            disabled={saving}
            placeholder="@cf/meta/llama-3.1-8b-instruct"
            onChange={(event) => updateDraft('model', event.target.value)}
          />
          <small>只接受以 @cf/ 开头的 Cloudflare 托管模型。</small>
        </label>

        <label className="field-group">
          <span>系统提示词</span>
          <textarea
            rows={7}
            value={draft.systemPrompt}
            disabled={saving}
            onChange={(event) => updateDraft('systemPrompt', event.target.value)}
          />
          <small>公开前端不会把提示词或用户问题写入 D1。</small>
        </label>

        <div className="settings-grid ai-number-grid">
          <label className="field-group">
            <span>全站每日额度</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={draft.dailyRequestLimit}
              disabled={saving}
              onChange={(event) => updateDraft('dailyRequestLimit', Number(event.target.value))}
            />
          </label>

          <label className="field-group">
            <span>单访客每日额度</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={draft.perVisitorDailyLimit}
              disabled={saving}
              onChange={(event) => updateDraft('perVisitorDailyLimit', Number(event.target.value))}
            />
          </label>

          <label className="field-group">
            <span>输入字符上限</span>
            <input
              type="number"
              min={100}
              max={12000}
              value={draft.maxInputCharacters}
              disabled={saving}
              onChange={(event) => updateDraft('maxInputCharacters', Number(event.target.value))}
            />
          </label>

          <label className="field-group">
            <span>输出 Token 上限</span>
            <input
              type="number"
              min={64}
              max={4096}
              value={draft.maxOutputTokens}
              disabled={saving}
              onChange={(event) => updateDraft('maxOutputTokens', Number(event.target.value))}
            />
          </label>

          <label className="field-group">
            <span>生成温度</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={draft.temperature}
              disabled={saving}
              onChange={(event) => updateDraft('temperature', Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="settings-card ai-test-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">连接验证</p>
            <h2>测试 Workers AI</h2>
          </div>
          <span className="status-chip">不占访客额度</span>
        </div>

        <label className="field-group">
          <span>测试问题</span>
          <textarea
            rows={4}
            value={testPrompt}
            disabled={testing}
            onChange={(event) => {
              setTestPrompt(event.target.value);
              setTestResult(null);
              setErrorMessage('');
            }}
          />
        </label>

        <div className="ai-test-actions">
          <small>测试使用当前已保存配置；修改表单后请先保存。</small>
          <button
            className="secondary-button"
            type="button"
            disabled={testing || !testPrompt.trim()}
            onClick={() => void runTest()}
          >
            {testing ? '正在调用…' : '运行测试'}
          </button>
        </div>

        {testResult ? (
          <div className="ai-test-result">
            <div>
              <strong>{testResult.model}</strong>
              <span>{testResult.durationMs} ms</span>
            </div>
            <p>{testResult.response}</p>
          </div>
        ) : null}
      </section>

      {errorMessage ? <p className="inline-status is-error">{errorMessage}</p> : null}
      {message ? <p className="inline-status is-success">{message}</p> : null}

      <div className="settings-actions">
        <span>
          公开接口：<code>/api/public/ai/ask</code>；访客身份只保存 SHA-256 哈希。
        </span>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? '正在保存…' : '保存 AI 设置'}
        </button>
      </div>
    </form>
  );
}
