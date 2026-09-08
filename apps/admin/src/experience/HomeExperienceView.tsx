import { useState, type FormEvent } from 'react';
import type { AdminSection } from '../api';
import { useAdminDirtySource } from '../admin-unsaved-state';
import { HomeLayoutSettingsSection } from '../HomeLayoutSettingsSection';
import { AdminActionBar } from '../components/ui/action-bar';
import { Button } from '../components/ui/button';
import { AdminStatusBadge } from '../components/ui/status-badge';
import type { HomeLayout, SiteSettingsWithHero } from '../site-hero-settings-api';
import {
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import './experience-settings.css';

function createHomeDraft(settings: SiteSettingsWithHero): HomeLayout {
  return {
    shortcutSectionIds: [...settings.homeLayout.shortcutSectionIds],
    recommendationSectionIds: [...settings.homeLayout.recommendationSectionIds],
  };
}

export function HomeExperienceView({
  sections,
  onSessionExpired,
}: {
  sections: AdminSection[];
  onSessionExpired: () => void;
}) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState<HomeLayout>(() => createHomeDraft(settings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const dirty = !settingsValueEqual(draft, createHomeDraft(settings));

  useAdminDirtySource('homepage-settings', '首页设置', dirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setMessage(null);
    try {
      const base = toSiteSettingsUpdateInput(settings);
      const updated = await saveSettings({
        ...base,
        homeLayout: {
          shortcutSectionIds: [...draft.shortcutSectionIds],
          recommendationSectionIds: [...draft.recommendationSectionIds],
        },
      });
      setDraft(createHomeDraft(updated));
      setMessage({ type: 'success', text: '首页分区已保存。' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('SESSION')) onSessionExpired();
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '首页分区保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="settings-workspace is-medium home-experience-workspace"
      onSubmit={handleSubmit}
    >
      <HomeLayoutSettingsSection
        value={draft}
        sections={sections}
        busy={saving}
        onChange={setDraft}
      />

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
          保存首页分区
        </Button>
      </AdminActionBar>
    </form>
  );
}
