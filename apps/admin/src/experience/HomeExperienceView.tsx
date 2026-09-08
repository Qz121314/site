import { useState, type FormEvent } from 'react';
import type { AdminSection } from '../api';
import { useAdminDirtySource } from '../admin-unsaved-state';
import { HomeLayoutSettingsSection } from '../HomeLayoutSettingsSection';
import { SiteHeroSettingsSection } from '../SiteHeroSettingsSection';
import type {
  HomeLayout,
  SiteHeroSlide,
  SiteSettingsWithHero,
} from '../site-hero-settings-api';
import {
  cloneHeroSlides,
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import './experience-settings.css';

type HomeDraft = {
  heroSlides: SiteHeroSlide[];
  homeLayout: HomeLayout;
};

function createHomeDraft(settings: SiteSettingsWithHero): HomeDraft {
  return {
    heroSlides: cloneHeroSlides(settings.heroSlides),
    homeLayout: {
      shortcutSectionIds: [...settings.homeLayout.shortcutSectionIds],
      recommendationSectionIds: [...settings.homeLayout.recommendationSectionIds],
    },
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
  const [draft, setDraft] = useState<HomeDraft>(() => createHomeDraft(settings));
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
        heroSlides: draft.heroSlides.map((slide, index) => ({
          id: slide.id,
          mediaAssetId: slide.mediaAssetId,
          title: slide.title?.trim() || null,
          description: slide.description?.trim() || null,
          ctaLabel: slide.ctaLabel?.trim() || null,
          ctaHref: slide.ctaHref?.trim() || null,
          sortOrder: index,
        })),
        homeLayout: {
          shortcutSectionIds: [...draft.homeLayout.shortcutSectionIds],
          recommendationSectionIds: [...draft.homeLayout.recommendationSectionIds],
        },
      });
      setDraft(createHomeDraft(updated));
      setMessage({ type: 'success', text: '首页设置已保存。' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('SESSION')) onSessionExpired();
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '首页设置保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="settings-workspace home-experience-workspace"
      onSubmit={handleSubmit}
    >
      <SiteHeroSettingsSection
        slides={draft.heroSlides}
        busy={saving}
        onChange={(heroSlides) => setDraft((current) => ({ ...current, heroSlides }))}
        onSessionExpired={onSessionExpired}
      />

      <HomeLayoutSettingsSection
        value={draft.homeLayout}
        sections={sections}
        busy={saving}
        onChange={(homeLayout) => setDraft((current) => ({ ...current, homeLayout }))}
      />

      <div className="settings-workspace-actions">
        {message ? (
          <span
            className={`settings-workspace-status is-${message.type}`}
            role={message.type === 'error' ? 'alert' : 'status'}
          >
            {message.text}
          </span>
        ) : null}
        <button className="primary-button" type="submit" disabled={saving || !dirty}>
          {saving ? '保存中…' : '保存首页设置'}
        </button>
      </div>
    </form>
  );
}
