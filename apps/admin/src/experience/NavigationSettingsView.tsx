import { useState, type FormEvent } from 'react';
import { useAdminDirtySource } from '../admin-unsaved-state';
import { BottomNavigationSettingsSection } from '../BottomNavigationSettingsSection';
import { AdminActionBar } from '../components/ui/action-bar';
import { Button } from '../components/ui/button';
import { AdminStatusBadge } from '../components/ui/status-badge';
import type {
  BottomNavigationItem,
  SiteSettingsWithHero,
} from '../site-hero-settings-api';
import {
  cloneBottomNavigation,
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';

function createNavigationDraft(settings: SiteSettingsWithHero): BottomNavigationItem[] {
  return cloneBottomNavigation(settings.bottomNavigation);
}

export function NavigationSettingsView({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState(() => createNavigationDraft(settings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const dirty = !settingsValueEqual(draft, createNavigationDraft(settings));

  useAdminDirtySource('navigation-settings', '导航设置', dirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const base = toSiteSettingsUpdateInput(settings);
      const updated = await saveSettings({
        ...base,
        bottomNavigation: draft.map(({ sortOrder: _sortOrder, ...item }) => ({
          ...item,
        })),
      });
      setDraft(createNavigationDraft(updated));
      setMessage({ type: 'success', text: '导航设置已保存。' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '导航设置保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-workspace is-medium" onSubmit={handleSubmit}>
      <section className="settings-workspace-section" aria-label="导航设置">
        <BottomNavigationSettingsSection
          value={draft}
          busy={saving}
          onChange={(next) => {
            setDraft(next);
            setMessage(null);
          }}
          onSessionExpired={onSessionExpired}
        />
      </section>

      <AdminActionBar
        sticky
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
        <Button variant="primary" type="submit" loading={saving} disabled={!dirty}>
          保存导航设置
        </Button>
      </AdminActionBar>
    </form>
  );
}
