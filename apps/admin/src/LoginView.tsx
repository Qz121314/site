import { useState, type FormEvent } from 'react';
import { AdminApiError, loginAdmin, type AdminSessionResponse } from './api';

type LoginViewProps = {
  configurationMissing: boolean;
  initialError?: string;
  onAuthenticated: (session: AdminSessionResponse) => void;
};

function describeLoginError(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return '无法连接后台服务，请检查网络后重试。';
  }

  if (error.code === 'LOGIN_RATE_LIMITED' && error.retryAfterSeconds) {
    const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
    return `登录尝试过多，请约 ${minutes} 分钟后再试。`;
  }

  return error.message;
}

export function LoginView({
  configurationMissing,
  initialError,
  onAuthenticated,
}: LoginViewProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError ?? '');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const session = await loginAdmin(password);
      setPassword('');
      onAuthenticated(session);
    } catch (error) {
      setErrorMessage(describeLoginError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">
          SP
        </div>
        <div>
          <p className="eyebrow">业务展示模板</p>
          <h1 id="login-title">管理后台登录</h1>
        </div>

        {configurationMissing ? (
          <div className="notice notice-error" role="alert">
            <strong>后台认证配置尚未生效</strong>
            <span>
              请确认 ADMIN_PASSWORD 和 SESSION_SECRET 已使用 Secret 绑定到当前正式
              Worker。配置完成后可直接在下方重试。
            </span>
          </div>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-password">后台密码</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
          />

          {errorMessage ? (
            <p className="form-error" role="alert" aria-live="polite">
              {errorMessage}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? '正在验证…' : '登录后台'}
          </button>
        </form>
      </section>
    </main>
  );
}
