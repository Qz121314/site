import type { AdminView } from '../admin-navigation';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import './experience-settings.css';
import { MessagesArticlesSection } from './messages-articles/MessagesArticlesSection';

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

      <MessagesArticlesSection onNavigate={onNavigate} />
    </div>
  );
}
