import { useState } from 'react';
import { SiteSettingsView } from './SiteSettingsView';

type AdminSection = {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
};

type AdminView = 'dashboard' | 'settings';

const sections: readonly AdminSection[] = [];

const coreModules = [
  ['站点设置', '配置站点名称、位置文案和 R2 自定义域名'],
  ['分区管理', '新增分区并设置名称、图标、排序和启用状态'],
  ['产品管理', '产品在所属分区菜单中录入和管理'],
  ['转化方式', '转化方式在所属分区菜单中录入并供产品复用'],
  ['媒体管理', '管理分区图标、产品封面和产品图片'],
  ['热门推荐', '选择热门产品并设置首页推荐顺序'],
] as const;

type DashboardProps = {
  expiresAt: string | undefined;
  loggingOut: boolean;
  onLogout: () => void;
  onSessionExpired: () => void;
};

const viewTitles: Record<AdminView, { eyebrow: string; title: string }> = {
  dashboard: {
    eyebrow: '当前阶段 · 后台数据录入核心',
    title: '平台管理后台',
  },
  settings: {
    eyebrow: '系统配置 · 单一数据源',
    title: '站点设置',
  },
};

export function Dashboard({
  expiresAt,
  loggingOut,
  onLogout,
  onSessionExpired,
}: DashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const heading = viewTitles[activeView];

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span>SP</span>
          <div>
            <strong>业务展示模板</strong>
            <small>中文管理后台</small>
          </div>
        </div>

        <nav aria-label="后台导航">
          <button
            className={activeView === 'dashboard' ? 'is-active' : undefined}
            type="button"
            aria-current={activeView === 'dashboard' ? 'page' : undefined}
            onClick={() => setActiveView('dashboard')}
          >
            仪表盘
          </button>
          <button
            className={activeView === 'settings' ? 'is-active' : undefined}
            type="button"
            aria-current={activeView === 'settings' ? 'page' : undefined}
            onClick={() => setActiveView('settings')}
          >
            站点设置
          </button>
          <button type="button" disabled>
            分区管理
          </button>

          {sections.map((section) => (
            <div className="dynamic-menu" key={section.id}>
              <button type="button">
                <span aria-hidden="true">{section.icon}</span>
                {section.name}
              </button>
              <div>
                <button type="button">产品管理</button>
                <button type="button">转化方式</button>
              </div>
            </div>
          ))}

          <button type="button" disabled>
            媒体管理
          </button>
          <button type="button" disabled>
            热门推荐
          </button>
          <button type="button" disabled>
            FAQ 管理
          </button>
          <button type="button" disabled>
            发布管理
          </button>
          <button type="button" disabled>
            回收站
          </button>
          <button type="button" disabled>
            操作日志
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p>{heading.eyebrow}</p>
            <h1>{heading.title}</h1>
          </div>
          <div className="header-actions">
            <span className="environment-badge">PRODUCTION</span>
            <button
              className="secondary-button"
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
            >
              {loggingOut ? '正在退出…' : '退出登录'}
            </button>
          </div>
        </header>

        {activeView === 'settings' ? (
          <SiteSettingsView onSessionExpired={onSessionExpired} />
        ) : (
          <>
            <section className="status-grid">
              <article>
                <span>登录状态</span>
                <strong>安全</strong>
                <small>
                  {expiresAt
                    ? `会话有效至 ${new Date(expiresAt).toLocaleString('zh-CN')}`
                    : '短期签名会话'}
                </small>
              </article>
              <article>
                <span>已创建分区</span>
                <strong>{sections.length}</strong>
                <small>创建后自动生成业务菜单</small>
              </article>
              <article>
                <span>公开语言</span>
                <strong>English</strong>
                <small>后台使用中文操作</small>
              </article>
            </section>

            <section className="module-section">
              <div className="section-title">
                <div>
                  <p>数据驱动模板</p>
                  <h2>后台第一批核心模块</h2>
                </div>
                <button type="button" onClick={() => setActiveView('settings')}>
                  配置站点
                </button>
              </div>

              <div className="module-grid">
                {coreModules.map(([title, description], index) => (
                  <article key={title}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </section>

            {sections.length === 0 ? (
              <section className="empty-admin-state">
                <strong>尚未创建分区</strong>
                <p>
                  当前先完成站点设置。下一阶段开发分区管理，创建分区后左侧会自动生成该分区的产品管理和转化方式菜单。
                </p>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
