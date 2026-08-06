import { useCallback, useEffect, useMemo, useState } from 'react';
import { AssetLibraryView } from './AssetLibraryView';
import { AdminApiError, fetchSections, type AdminSection } from './api';
import { CategoryManagementView } from './CategoryManagementView';
import { CustomerServiceView } from './CustomerServiceView';
import { FaqManagementView } from './FaqManagementView';
import { SectionManagementView } from './SectionManagementView';
import { SiteSettingsView } from './SiteSettingsView';

type DynamicViewKind = 'products' | 'categories' | 'conversion-pool';

type AdminView =
  | 'settings'
  | 'assets'
  | 'customer-service'
  | 'faq'
  | 'sections'
  | `${DynamicViewKind}:${string}`;

type DashboardProps = {
  expiresAt: string | undefined;
  loggingOut: boolean;
  onLogout: () => void;
  onSessionExpired: () => void;
};

type DynamicView = {
  kind: DynamicViewKind;
  sectionId: string;
};

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function parseDynamicView(view: AdminView): DynamicView | null {
  const separatorIndex = view.indexOf(':');
  if (separatorIndex < 0) return null;

  const kind = view.slice(0, separatorIndex);
  const sectionId = view.slice(separatorIndex + 1);
  if (
    (kind !== 'products' && kind !== 'categories' && kind !== 'conversion-pool') ||
    !sectionId
  ) {
    return null;
  }

  return { kind, sectionId };
}

function getViewContext(view: AdminView, sections: AdminSection[]) {
  const fixed: Partial<Record<AdminView, { eyebrow: string; title: string }>> = {
    settings: { eyebrow: '全站配置', title: '站点设置' },
    assets: { eyebrow: 'R2 扫描与清理', title: '素材库管理' },
    'customer-service': { eyebrow: '外部系统对接', title: '客服管理' },
    faq: { eyebrow: '公共内容', title: 'FAQ 管理' },
    sections: { eyebrow: '业务结构', title: '分区管理' },
  };
  const fixedContext = fixed[view];
  if (fixedContext) return fixedContext;

  const dynamic = parseDynamicView(view);
  if (!dynamic) return { eyebrow: '分区业务', title: '分区业务' };

  const section = sections.find((item) => item.id === dynamic.sectionId);
  const labels: Record<DynamicViewKind, string> = {
    products: '产品录入',
    categories: '分类管理',
    'conversion-pool': '转化池',
  };
  return {
    eyebrow: '分区业务',
    title: section ? `${section.name} · ${labels[dynamic.kind]}` : '分区业务',
  };
}

function PlaceholderView({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <section className="settings-card operation-placeholder">
      <p className="eyebrow">模块边界已确定</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function Dashboard({
  expiresAt,
  loggingOut,
  onLogout,
  onSessionExpired,
}: DashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>('settings');
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
    const dynamic = parseDynamicView(activeView);
    if (!dynamic) return;
    if (!sectionsLoading && !sections.some((section) => section.id === dynamic.sectionId)) {
      setActiveView('sections');
    }
  }, [activeView, sections, sectionsLoading]);

  const heading = useMemo(() => getViewContext(activeView, sections), [activeView, sections]);
  const currentSection = useMemo(() => {
    const dynamic = parseDynamicView(activeView);
    if (!dynamic) return null;
    const section = sections.find((item) => item.id === dynamic.sectionId);
    return section ? { kind: dynamic.kind, section } : null;
  }, [activeView, sections]);

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span>SP</span>
          <div>
            <strong>业务运营后台</strong>
            <small>React 管理系统</small>
          </div>
        </div>

        <nav aria-label="后台导航">
          <button
            className={activeView === 'settings' ? 'is-active' : undefined}
            type="button"
            onClick={() => setActiveView('settings')}
          >
            站点设置
          </button>
          <button
            className={activeView === 'assets' ? 'is-active' : undefined}
            type="button"
            onClick={() => setActiveView('assets')}
          >
            素材库管理
          </button>
          <button
            className={activeView === 'customer-service' ? 'is-active' : undefined}
            type="button"
            onClick={() => setActiveView('customer-service')}
          >
            客服管理
          </button>
          <button
            className={activeView === 'faq' ? 'is-active' : undefined}
            type="button"
            onClick={() => setActiveView('faq')}
          >
            FAQ 管理
          </button>
          <button
            className={activeView === 'sections' ? 'is-active' : undefined}
            type="button"
            onClick={() => setActiveView('sections')}
          >
            分区管理
          </button>

          <div className="sidebar-section-label">已创建分区</div>
          {sectionsLoading ? <small className="sidebar-loading">正在读取分区…</small> : null}
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
                  产品录入
                </button>
                <button
                  className={activeView === `categories:${section.id}` ? 'is-active' : undefined}
                  type="button"
                  onClick={() => setActiveView(`categories:${section.id}`)}
                >
                  分类管理
                </button>
                <button
                  className={activeView === `conversion-pool:${section.id}` ? 'is-active' : undefined}
                  type="button"
                  onClick={() => setActiveView(`conversion-pool:${section.id}`)}
                >
                  转化池
                </button>
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p>{heading.eyebrow}</p>
            <h1>{heading.title}</h1>
          </div>
          <div className="header-actions">
            <span className="environment-badge">
              {expiresAt ? `会话至 ${new Date(expiresAt).toLocaleTimeString('zh-CN')}` : 'PRODUCTION'}
            </span>
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
        ) : activeView === 'assets' ? (
          <AssetLibraryView onSessionExpired={onSessionExpired} />
        ) : activeView === 'customer-service' ? (
          <CustomerServiceView onSessionExpired={onSessionExpired} />
        ) : activeView === 'sections' ? (
          <SectionManagementView
            activeSections={sections}
            onActiveSectionsChange={setSections}
            onSessionExpired={onSessionExpired}
          />
        ) : activeView === 'faq' ? (
          <FaqManagementView onSessionExpired={onSessionExpired} />
        ) : currentSection?.kind === 'categories' ? (
          <CategoryManagementView
            section={currentSection.section}
            onSessionExpired={onSessionExpired}
          />
        ) : currentSection ? (
          <PlaceholderView
            title={`${currentSection.section.name} · ${
              currentSection.kind === 'products' ? '产品录入' : '转化池'
            }`}
            description="当前分区上下文已经固定，后续数据只允许写入本分区。"
            items={
              currentSection.kind === 'products'
                ? ['产品内容与图片', '所属分类', '转化池选择', '发布与热门状态']
                : ['链接、电话、邮箱或自定义转化', '排序与启停', '产品引用保护']
            }
          />
        ) : null}
      </main>
    </div>
  );
}
