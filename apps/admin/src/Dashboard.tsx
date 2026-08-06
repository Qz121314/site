import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminApiError, fetchSections, type AdminSection } from './api';
import { SectionManagementView } from './SectionManagementView';
import { SiteSettingsView } from './SiteSettingsView';

type AdminView =
  | 'dashboard'
  | 'settings'
  | 'sections'
  | `products:${string}`
  | `conversions:${string}`;

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

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function getViewContext(view: AdminView, sections: AdminSection[]) {
  if (view === 'dashboard') {
    return { eyebrow: '当前阶段 · 后台数据录入核心', title: '平台管理后台' };
  }
  if (view === 'settings') {
    return { eyebrow: '系统配置 · 单一数据源', title: '站点设置' };
  }
  if (view === 'sections') {
    return { eyebrow: '业务结构 · 动态菜单来源', title: '分区管理' };
  }

  const [kind, sectionId] = view.split(':');
  const section = sections.find((item) => item.id === sectionId);
  return {
    eyebrow: kind === 'products' ? '分区业务 · 产品录入' : '分区业务 · 转化配置',
    title: section
      ? `${section.name} · ${kind === 'products' ? '产品管理' : '转化方式'}`
      : '分区业务',
  };
}

export function Dashboard({
  expiresAt,
  loggingOut,
  onLogout,
  onSessionExpired,
}: DashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionsError, setSectionsError] = useState('');

  const loadSections = useCallback(async () => {
    setSectionsLoading(true);
    setSectionsError('');
    try {
      setSections(await fetchSections('active'));
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setSectionsError(error instanceof Error ? error.message : '分区加载失败。');
    } finally {
      setSectionsLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadSections();
  }, [loadSections]);

  useEffect(() => {
    if (!activeView.startsWith('products:') && !activeView.startsWith('conversions:')) {
      return;
    }
    const sectionId = activeView.split(':')[1];
    if (!sectionsLoading && !sections.some((section) => section.id === sectionId)) {
      setActiveView('sections');
    }
  }, [activeView, sections, sectionsLoading]);

  const heading = useMemo(() => getViewContext(activeView, sections), [activeView, sections]);
  const currentSectionContext = useMemo(() => {
    if (!activeView.includes(':')) {
      return null;
    }
    const [kind, id] = activeView.split(':');
    const section = sections.find((item) => item.id === id);
    if (!section || (kind !== 'products' && kind !== 'conversions')) {
      return null;
    }
    return { kind, section } as const;
  }, [activeView, sections]);

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
          <button
            className={activeView === 'sections' ? 'is-active' : undefined}
            type="button"
            aria-current={activeView === 'sections' ? 'page' : undefined}
            onClick={() => setActiveView('sections')}
          >
            分区管理
          </button>

          {sections.map((section) => (
            <div className="dynamic-menu" key={section.id}>
              <button type="button" onClick={() => setActiveView(`products:${section.id}`)}>
                <span aria-hidden="true">{section.iconValue ?? '◈'}</span>
                {section.name}
              </button>
              <div>
                <button
                  className={activeView === `products:${section.id}` ? 'is-active' : undefined}
                  type="button"
                  onClick={() => setActiveView(`products:${section.id}`)}
                >
                  产品管理
                </button>
                <button
                  className={activeView === `conversions:${section.id}` ? 'is-active' : undefined}
                  type="button"
                  onClick={() => setActiveView(`conversions:${section.id}`)}
                >
                  转化方式
                </button>
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

        {sectionsError ? (
          <div className="notice notice-error" role="alert">
            {sectionsError}
            <button type="button" onClick={() => void loadSections()}>
              重新加载
            </button>
          </div>
        ) : null}

        {activeView === 'settings' ? (
          <SiteSettingsView onSessionExpired={onSessionExpired} />
        ) : activeView === 'sections' ? (
          <SectionManagementView
            activeSections={sections}
            onActiveSectionsChange={setSections}
            onSessionExpired={onSessionExpired}
          />
        ) : currentSectionContext ? (
          <section className="section-context-placeholder">
            <h2>
              {currentSectionContext.section.iconValue ?? '◈'} {currentSectionContext.section.name}
            </h2>
            <p>
              当前已经进入该分区的
              {currentSectionContext.kind === 'products' ? '产品管理' : '转化方式'}上下文。
              分区 ID、菜单和 D1 关系已经固定，下一阶段会直接在这里实现真实录入和管理。
            </p>
          </section>
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
                <strong>{sectionsLoading ? '—' : sections.length}</strong>
                <small>创建后自动生成业务菜单</small>
              </article>
              <article>
                <span>已启用分区</span>
                <strong>{sections.filter((section) => section.isEnabled).length}</strong>
                <small>停用分区不会公开发布</small>
              </article>
            </section>

            <section className="module-section">
              <div className="section-title">
                <div>
                  <p>数据驱动模板</p>
                  <h2>后台第一批核心模块</h2>
                </div>
                <div className="header-actions">
                  <button type="button" onClick={() => setActiveView('settings')}>
                    配置站点
                  </button>
                  <button type="button" onClick={() => setActiveView('sections')}>
                    管理分区
                  </button>
                </div>
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

            {!sectionsLoading && sections.length === 0 ? (
              <section className="empty-admin-state">
                <strong>尚未创建分区</strong>
                <p>创建第一个分区后，左侧会立即生成该分区的产品管理和转化方式菜单。</p>
                <button className="primary-button" type="button" onClick={() => setActiveView('sections')}>
                  新增分区
                </button>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
