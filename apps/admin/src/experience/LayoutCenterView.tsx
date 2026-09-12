import { useState, type FormEvent } from 'react';
import type { StorefrontLayoutPage } from '@site/shared';
import { useAdminDirtySource } from '../admin-unsaved-state';
import {
  AdminSegmentedControl,
  AdminSegmentedItem,
} from '../components/ui/segmented-control';
import type { SiteSettingsWithHero } from '../site-hero-settings-api';
import {
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import './experience-settings.css';

const PAGES: Array<{ key: StorefrontLayoutPage; label: string; description: string }> = [
  { key: 'home', label: '首页', description: '分区入口、推荐内容与首页首屏。' },
  { key: 'browse', label: 'Browse', description: '全站产品浏览与筛选。' },
  { key: 'section', label: '分区页', description: '单个服务分区的产品目录。' },
  { key: 'product', label: '产品详情', description: '产品信息、媒体与 CTA 转化。' },
  { key: 'article', label: '文章页', description: 'Article 与兼容 FAQ 内容。' },
  { key: 'messages', label: 'Messages', description: '消息入口与客服相关页面。' },
];

function createDraft(settings: SiteSettingsWithHero) {
  return { ...settings.storefrontLayout };
}

export function LayoutCenterView({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState(() => createDraft(settings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = !settingsValueEqual(draft, createDraft(settings));

  useAdminDirtySource('storefront-layout', '布局中心', dirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await saveSettings({
        ...toSiteSettingsUpdateInput(settings),
        storefrontLayout: { ...draft },
      });
      setDraft(createDraft(updated));
      setMessage('布局配置已保存。当前方案仍保持线上默认布局。');
    } catch (error) {
      if (error instanceof Error && error.message.includes('SESSION')) onSessionExpired();
      setMessage(error instanceof Error ? error.message : '布局配置保存失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="settings-workspace home-experience-workspace"
      onSubmit={handleSubmit}
    >
      <div className="home-experience-commandbar">
        <AdminSegmentedControl ariaLabel="布局中心说明">
          <AdminSegmentedItem selected current type="button">
            页面布局方案
          </AdminSegmentedItem>
        </AdminSegmentedControl>
        {message ? (
          <span className="settings-workspace-status is-success" role="status">
            {message}
          </span>
        ) : null}
        <button className="primary-button" type="submit" disabled={saving || !dirty}>
          {saving ? '保存中…' : '保存布局配置'}
        </button>
      </div>
      <section className="admin-settings-section">
        <div className="admin-settings-section-heading">
          <div>
            <span className="admin-layout-center-eyebrow">STOREFRONT EXPERIENCE</span>
            <h2>页面布局方案</h2>
            <p>
              管理各页面使用的布局方案。当前线上布局已安全注册为默认方案，后续可逐页切换测试。
            </p>
          </div>
        </div>
        <div className="admin-layout-center-overview">
          <div className="admin-layout-center-overview-mark" aria-hidden="true">
            <span>01</span>
          </div>
          <div>
            <div className="admin-layout-center-overview-title">
              <strong>当前布局</strong>
              <span className="admin-layout-center-status">线上默认</span>
            </div>
            <p>现有网站正在使用的布局结构，适用于全部页面。</p>
          </div>
          <span className="admin-layout-center-overview-count">
            覆盖 {PAGES.length} 个页面
          </span>
        </div>
        <div className="admin-layout-center-list">
          {PAGES.map((page, index) => (
            <label className="admin-layout-center-row" key={page.key}>
              <span className="admin-layout-center-row-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="admin-layout-center-row-copy">
                <strong>{page.label}</strong>
                <small>{page.description}</small>
              </span>
              <select
                value={draft[page.key]}
                aria-label={`${page.label}布局方案`}
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [page.key]: event.target.value as 'current' | 'template-a',
                  }))
                }
              >
                <option value="current">当前布局（默认）</option>
                {page.key === 'home' ? (
                  <option value="template-a">模板 A · 主分区聚焦</option>
                ) : null}
              </select>
            </label>
          ))}
        </div>
      </section>
    </form>
  );
}
