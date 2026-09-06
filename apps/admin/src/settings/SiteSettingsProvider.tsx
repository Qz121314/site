import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AdminApiError } from '../api';
import {
  fetchSiteSettingsWithHero,
  updateSiteSettingsWithHero,
  type SiteSettingsWithHero,
  type SiteSettingsWithHeroUpdateInput,
} from '../site-hero-settings-api';

type SiteSettingsContextValue = {
  settings: SiteSettingsWithHero;
  saveSettings: (
    input: SiteSettingsWithHeroUpdateInput,
  ) => Promise<SiteSettingsWithHero>;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

export function SiteSettingsProvider({
  onSessionExpired,
  children,
}: {
  onSessionExpired: () => void;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<SiteSettingsWithHero | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage('');

    void (async () => {
      try {
        const result = await fetchSiteSettingsWithHero();
        if (active) setSettings(result);
      } catch (error) {
        if (!active) return;
        if (isSessionError(error)) {
          onSessionExpired();
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : '无法读取站点设置。');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [onSessionExpired, reloadToken]);

  const saveSettings = useCallback(
    async (input: SiteSettingsWithHeroUpdateInput) => {
      try {
        const updated = await updateSiteSettingsWithHero(input);
        setSettings(updated);
        return updated;
      } catch (error) {
        if (isSessionError(error)) onSessionExpired();
        throw error;
      }
    },
    [onSessionExpired],
  );

  const contextValue = useMemo(
    () => (settings ? { settings, saveSettings } : null),
    [saveSettings, settings],
  );

  if (loading) {
    return (
      <div className="settings-workspace-state" role="status" aria-live="polite">
        正在读取站点设置…
      </div>
    );
  }

  if (!contextValue) {
    return (
      <section className="settings-workspace-state is-error" role="alert">
        <strong>无法读取站点设置</strong>
        <p>{errorMessage || '请检查后台接口后重试。'}</p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
        >
          重新加载
        </button>
      </section>
    );
  }

  return (
    <SiteSettingsContext.Provider value={contextValue}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettingsController(): SiteSettingsContextValue {
  const value = useContext(SiteSettingsContext);
  if (!value) {
    throw new Error('useSiteSettingsController must be used inside SiteSettingsProvider.');
  }
  return value;
}
