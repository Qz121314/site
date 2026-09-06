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
  showHot: boolean;
  showLatest: boolean;
  showMore: boolean;
  showFaq: boolean;
  homeSectionLimit: number;
  heroSlides: SiteHeroSlide[];
  homeLayout: HomeLayout;
};

function createHomeDraft(settings: SiteSettingsWithHero): HomeDraft {
  return {
    showHot: settings.showHot,
    showLatest: settings.showLatest,
    showMore: settings.showMore,
    showFaq: settings.showFaq,
    homeSectionLimit: settings.homeSectionLimit,
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
        showHot: draft.showHot,
        showLatest: draft.showLatest,
        showMore: draft.showMore,
        showFaq: draft.showFaq,
        homeSectionLimit: draft.homeSectionLimit,
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
      <section
        className="settings-workspace-section"
        aria-labelledby="home-content-title"
      >
        <div className="settings-workspace-heading">
          <div>
            <h2 id="home-content-title">首页展示</h2>
            <p>控制首页内容区块与每个推荐分区的展示数量，不影响其他 Storefront 页面。</p>
          </div>
        </div>

        <div className="settings-toggle-list">
          {[
            ['showHot', '热门内容', '显示 Hot 首页内容区块'],
            ['showLatest', '最新内容', '显示 Latest 首页内容区块'],
            ['showMore', 'More 入口', '允许首页显示 More 入口'],
            ['showFaq', 'FAQ 区域', '在首页展示 FAQ 相关入口'],
          ].map(([field, label, description]) => (
            <label className="settings-toggle-row" key={field}>
              <span className="settings-toggle-copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <input
                type="checkbox"
                checked={
                  draft[
                    field as keyof Pick<
                      HomeDraft,
                      'showHot' | 'showLatest' | 'showMore' | 'showFaq'
                    >
                  ] as boolean
                }
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [field]: event.target.checked,
                  }))
                }
              />
            </label>
          ))}
        </div>

        <label className="field-group home-section-limit-field">
          <span>每个首页推荐分区最多显示</span>
          <input
            type="number"
            min={1}
            max={24}
            value={draft.homeSectionLimit}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                homeSectionLimit: Math.max(
                  1,
                  Math.min(24, Number(event.target.value) || 1),
                ),
              }))
            }
          />
        </label>
      </section>

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
