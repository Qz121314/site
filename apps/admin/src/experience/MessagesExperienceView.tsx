import type { AdminView } from '../admin-navigation';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import './experience-settings.css';

export function MessagesExperienceView({
  onNavigate,
}: {
  onNavigate: (view: AdminView) => void;
}) {
  const { settings } = useSiteSettingsController();
  const messagesItem = settings.bottomNavigation.find((item) => item.key === 'messages');
  const enabled = messagesItem?.enabled === true;

  return (
    <div className="settings-workspace is-medium">
      <section
        className="settings-workspace-section"
        aria-labelledby="messages-page-title"
      >
        <div className="settings-workspace-heading">
          <div>
            <h2 id="messages-page-title">Messages 页面</h2>
            <p>
              这里负责 Messages 页面体验的 Admin ownership；导航入口仍在“导航”工作区编辑。
            </p>
          </div>
        </div>

        <dl className="messages-experience-summary">
          <div className="messages-experience-row">
            <dt>导航入口</dt>
            <dd>
              <span
                className={`messages-experience-badge${enabled ? ' is-enabled' : ''}`}
              >
                {enabled ? '已启用' : '已隐藏'}
              </span>
            </dd>
          </div>
          <div className="messages-experience-row">
            <dt>路径</dt>
            <dd>/messages/</dd>
          </div>
          <div className="messages-experience-row">
            <dt>导航名称</dt>
            <dd>{messagesItem?.label || 'Messages'}</dd>
          </div>
        </dl>

        <div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onNavigate('navigation')}
          >
            在导航中编辑 Messages 入口
          </button>
        </div>
      </section>

      <section
        className="settings-workspace-section"
        aria-labelledby="messages-article-title"
      >
        <div className="settings-workspace-heading">
          <div>
            <h2 id="messages-article-title">文章卡片</h2>
            <p>
              此功能将在 Article Center 功能阶段开放。本 Phase
              不创建文章选择、排序、背景图或 placement 数据。
            </p>
          </div>
        </div>
        <p className="settings-inline-note">当前没有需要保存的 Messages 专属设置。</p>
      </section>
    </div>
  );
}
