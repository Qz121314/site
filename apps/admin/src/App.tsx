import { useCallback, useEffect, useState } from 'react';
import {
  AdminApiError,
  fetchAdminSession,
  logoutAdmin,
  type AdminSessionResponse,
} from './api';
import { ADMIN_SESSION_EXPIRED_EVENT } from './admin-fetch';
import { Dashboard } from './Dashboard';
import { LoginView } from './LoginView';

type SessionState =
  | { status: 'loading' }
  | {
      status: 'unauthenticated';
      configurationMissing: boolean;
      errorMessage: string | undefined;
    }
  | {
      status: 'authenticated';
      expiresAt: string | undefined;
    };

export function App() {
  const [sessionState, setSessionState] = useState<SessionState>({ status: 'loading' });
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleSessionExpired = useCallback(() => {
    setSessionState({
      status: 'unauthenticated',
      configurationMissing: false,
      errorMessage: '登录会话已失效，请重新登录。',
    });
  }, []);

  useEffect(() => {
    const handleExpiredEvent = () => handleSessionExpired();
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleExpiredEvent);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleExpiredEvent);
  }, [handleSessionExpired]);

  useEffect(() => {
    let active = true;

    void fetchAdminSession()
      .then((session) => {
        if (!active) {
          return;
        }

        setSessionState(
          session.authenticated
            ? { status: 'authenticated', expiresAt: session.expiresAt }
            : {
                status: 'unauthenticated',
                configurationMissing: false,
                errorMessage: undefined,
              },
        );
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        const configurationMissing =
          error instanceof AdminApiError && error.code === 'AUTH_NOT_CONFIGURED';
        setSessionState({
          status: 'unauthenticated',
          configurationMissing,
          errorMessage: configurationMissing
            ? undefined
            : error instanceof Error
              ? error.message
              : '无法检查后台登录状态。',
        });
      });

    return () => {
      active = false;
    };
  }, []);

  function handleAuthenticated(session: AdminSessionResponse) {
    setLogoutError('');
    setSessionState({ status: 'authenticated', expiresAt: session.expiresAt });
  }

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setLogoutError('');
    try {
      await logoutAdmin();
      setSessionState({
        status: 'unauthenticated',
        configurationMissing: false,
        errorMessage: undefined,
      });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        handleSessionExpired();
        return;
      }

      setLogoutError(error instanceof Error ? error.message : '退出登录失败。');
    } finally {
      setLoggingOut(false);
    }
  }

  if (sessionState.status === 'loading') {
    return (
      <main className="loading-shell" aria-live="polite">
        <div className="loading-indicator" aria-hidden="true" />
        <p>正在检查后台登录状态…</p>
      </main>
    );
  }

  if (sessionState.status === 'unauthenticated') {
    const loginProps = {
      configurationMissing: sessionState.configurationMissing,
      onAuthenticated: handleAuthenticated,
      ...(sessionState.errorMessage ? { initialError: sessionState.errorMessage } : {}),
    };
    return <LoginView {...loginProps} />;
  }

  return (
    <Dashboard
      expiresAt={sessionState.expiresAt}
      loggingOut={loggingOut}
      logoutError={logoutError}
      onLogout={() => void handleLogout()}
      onSessionExpired={handleSessionExpired}
    />
  );
}
