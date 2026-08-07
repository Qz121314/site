import { useCallback, useEffect, useMemo, useState } from 'react';
import { AssetLibraryView } from './AssetLibraryView';
import { AdminApiError, fetchSections, type AdminSection } from './api';
import { brandingAssetPreviewUrl } from './branding-media/api';
import { CategoryManagementView } from './CategoryManagementView';
import { ConversionPoolView } from './ConversionPoolView';
import { CustomerServiceView } from './CustomerServiceView';
import { FaqManagementView } from './FaqManagementView';
import { ProductManagementView } from './ProductManagementView';
import {
  fetchPublishStatus,
  publishStorefront,
  rollbackStorefront,
  type PublishStatus,
  type PublishVersion,
} from './publish-api';
import { SectionManagementView } from './SectionManagementView';
import { SiteSettingsView } from './SiteSettingsView';

type DynamicViewKind = 'products' | 'product-entry' | 'categories' | 'conversion-pool';

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

type PublishFeedback = { type: 'success' | 'error'; message: string } | null;

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
}

function parseDynamicView(view: AdminView): DynamicView | null {
  const separatorIndex = view.indexOf(':');
  if (separatorIndex < 0) return null;

  const kind = view.slice(0, separatorIndex);
  const sectionId = view.slice(separatorIndex + 1);
  if (
    (kind !== 'products' &&
      kind !== 'product-entry' &&
      kind !== 'categories' &&
      kind !== 'conversion-pool') ||
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
  return {
    eyebrow: '分区业务',
    title: section?.name ?? '分区业务',
  };
}

function publishStatusLabel(status: PublishStatus | null, publishing: boolean): string {
  if (publishing) return '正在生成快照';
  if (status?.lastJob?.status === 'failed') return '上次发布失败';
  if (!status?.publishedAt) return '尚未发布';
  return status.isCurrent ? '前台已是最新' : '有未发布修改';
}

function formatVersionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function versionCode(version: PublishVersion): string {
  return version.contentVersion.slice(-8);
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
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<PublishFeedback>(null);
  const [publishPanelOpen, setPublishPanelOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<PublishVersion | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

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

  const loadPublishStatus = useCallback(async () => {
    try {
      setPublishStatus(await fetchPublishStatus());
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadSections();
    void loadPublishStatus();
  }, [loadPublishStatus, loadSections]);

  useEffect(() => {
    const handleMutation = () => void loadPublishStatus();
    window.addEventListener('admin:data-mutated', handleMutation);
    return () => window.removeEventListener('admin:data-mutated', handleMutation);
  }, [loadPublishStatus]);

  useEffect(() => {
    const dynamic = parseDynamicView(activeView);
    if (!dynamic) return;
    if (!sectionsLoading && !sections.some((section) => section.id === dynamic.sectionId)) {
      setActiveView('sections');
    }
  }, [activeView, sections, sectionsLoading]);

  async function handlePublish() {
    if (publishing || rollingBack) return;
    setPublishing(true);
    setPublishFeedback(null);
    try {
      const result = await publishStorefront();
      await loadPublishStatus();
      setPublishPanelOpen(false);
      setPublishFeedback({
        type: 'success',
        message: result.unchanged ? '前台已是最新，未生成重复快照。' : '前台快照已发布。',
      });
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setPublishFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '发布前台失败。',
      });
      void loadPublishStatus();
    } finally {
      setPublishing(false);
    }
  }

  async function handleRollback() {
    if (!rollbackTarget || rollingBack || publishing) return;
    setRollingBack(true);
    setPublishFeedback(null);
    try {
      await rollbackStorefront(rollbackTarget.contentVersion);
      await loadPublishStatus();
      setPublishPanelOpen(false);
      setRollbackTarget(null);
      setPublishFeedback({
        type: 'success',
        message: `前台已回退到 ${formatVersionTime(rollbackTarget.publishedAt)} 的快照。`,
      });
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setPublishFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '回退前台版本失败。',
      });
    } finally {
      setRollingBack(false);
    }
  }

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

        <nav className="admin-nav" aria-label="后台导航">
          <div className="sidebar-section-label sidebar-section-label-first">全局管理</div>
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

          <div className="sidebar-section-label">业务分区</div>
          {sectionsLoading ? <small className="sidebar-loading">正在读取分区…</small> : null}
          {sections.map((section) => {
            const sectionIsCurrent = currentSection?.section.id === section.id;
            return (
              <div
                className={`dynamic-menu${sectionIsCurrent ? ' is-current-section' : ''}`}
                key={section.id}
              >
                <button
                  className={sectionIsCurrent ? 'is-current-section' : undefined}
                  type="button"
                  onClick={() => setActiveView(`products:${section.id}`)}
                >
                  <span
                    className={`dynamic-menu-icon${section.iconAssetId ? ' has-image' : ''}`}
                    aria-hidden="true"
                  >
                    {section.iconAssetId ? (
                      <img src={brandingAssetPreviewUrl(section.iconAssetId)} alt="" />
                    ) : (
                      section.iconValue ?? '◈'
                    )}
                  </span>
                  {section.name}
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">
        <header className={`admin-header${currentSection ? ' has-section-nav' : ''}`}>
          <div className="admin-header-workspace">
            <div className="admin-header-title">
              <p>{heading.eyebrow}</p>
              <h1>{heading.title}</h1>
            </div>
            {currentSection ? (
              <nav className="section-workspace-nav" aria-label={`${currentSection.section.name} 管理`}>
                <button
                  className={currentSection.kind === 'products' ? 'is-active' : undefined}
                  type="button"
                  aria-current={currentSection.kind === 'products' ? 'page' : undefined}
                  onClick={() => setActiveView(`products:${currentSection.section.id}`)}
                >
                  产品管理
                </button>
                <button
                  className={currentSection.kind === 'product-entry' ? 'is-active' : undefined}
                  type="button"
                  aria-current={currentSection.kind === 'product-entry' ? 'page' : undefined}
                  onClick={() => setActiveView(`product-entry:${currentSection.section.id}`)}
                >
                  产品录入
                </button>
                <button
                  className={currentSection.kind === 'categories' ? 'is-active' : undefined}
                  type="button"
                  aria-current={currentSection.kind === 'categories' ? 'page' : undefined}
                  onClick={() => setActiveView(`categories:${currentSection.section.id}`)}
                >
                  分类管理
                </button>
                <button
                  className={currentSection.kind === 'conversion-pool' ? 'is-active' : undefined}
                  type="button"
                  aria-current={currentSection.kind === 'conversion-pool' ? 'page' : undefined}
                  onClick={() => setActiveView(`conversion-pool:${currentSection.section.id}`)}
                >
                  转化池
                </button>
              </nav>
            ) : null}
          </div>
          <div className="header-actions">
            <div className="publish-version-control">
              <button
                className={`publish-status-chip${publishStatus?.lastJob?.status === 'failed' ? ' is-error' : ''}${publishStatus && !publishStatus.isCurrent ? ' is-dirty' : ''}`}
                type="button"
                aria-expanded={publishPanelOpen}
                onClick={() => {
                  const next = !publishPanelOpen;
                  setPublishPanelOpen(next);
                  if (next) void loadPublishStatus();
                }}
              >
                {publishStatusLabel(publishStatus, publishing)}
              </button>
              {publishPanelOpen ? (
                <div className="publish-version-popover">
                  <div className="publish-version-popover-title">
                    <strong>最近版本</strong>
                    <button type="button" onClick={() => setPublishPanelOpen(false)} aria-label="关闭">×</button>
                  </div>
                  <div className="publish-version-list">
                    {publishStatus?.versions.length ? (
                      publishStatus.versions.map((version) => (
                        <div className={`publish-version-row${version.isCurrent ? ' is-current' : ''}`} key={version.contentVersion}>
                          <div>
                            <strong>{formatVersionTime(version.publishedAt)}</strong>
                            <small>{versionCode(version)}</small>
                          </div>
                          <span>{version.isCurrent ? '当前' : `${version.objectCount} 项`}</span>
                          <button
                            type="button"
                            disabled={version.isCurrent || publishing || rollingBack}
                            onClick={() => setRollbackTarget(version)}
                          >
                            {version.isCurrent ? '使用中' : '回退'}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="publish-version-empty">尚无前台快照</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              className="primary-button storefront-publish-button"
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing || loggingOut || rollingBack || publishStatus?.isCurrent === true}
            >
              {publishing ? '发布中…' : publishStatus?.isCurrent ? '前台已最新' : '发布前台'}
            </button>
            <span className="environment-badge">
              {expiresAt ? `会话至 ${new Date(expiresAt).toLocaleTimeString('zh-CN')}` : 'PRODUCTION'}
            </span>
            <button
              className="secondary-button"
              type="button"
              onClick={onLogout}
              disabled={loggingOut || publishing || rollingBack}
            >
              {loggingOut ? '正在退出…' : '退出登录'}
            </button>
          </div>
        </header>

        {publishFeedback ? (
          <div
            className={`notice ${publishFeedback.type === 'success' ? 'notice-success' : 'notice-error'} publish-feedback`}
            role={publishFeedback.type === 'error' ? 'alert' : 'status'}
          >
            {publishFeedback.message}
          </div>
        ) : null}

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
        ) : currentSection?.kind === 'products' ? (
          <ProductManagementView
            section={currentSection.section}
            mode="manage"
            onSessionExpired={onSessionExpired}
          />
        ) : currentSection?.kind === 'product-entry' ? (
          <ProductManagementView
            section={currentSection.section}
            mode="entry"
            onEntryExit={() => setActiveView(`products:${currentSection.section.id}`)}
            onSessionExpired={onSessionExpired}
          />
        ) : currentSection?.kind === 'categories' ? (
          <CategoryManagementView
            section={currentSection.section}
            onSessionExpired={onSessionExpired}
          />
        ) : currentSection?.kind === 'conversion-pool' ? (
          <ConversionPoolView
            section={currentSection.section}
            onSessionExpired={onSessionExpired}
          />
        ) : null}

        {rollbackTarget ? (
          <div className="admin-dialog-backdrop" role="presentation">
            <section className="admin-dialog admin-dialog-small" role="dialog" aria-modal="true" aria-labelledby="publish-rollback-title">
              <div className="admin-dialog-header">
                <div>
                  <p>前台版本</p>
                  <h3 id="publish-rollback-title">回退到 {formatVersionTime(rollbackTarget.publishedAt)}？</h3>
                </div>
                <button type="button" aria-label="关闭" disabled={rollingBack} onClick={() => setRollbackTarget(null)}>×</button>
              </div>
              <p className="delete-warning">前台会立即切换到该 R2 快照；后台当前数据不会改变。</p>
              <div className="admin-dialog-actions">
                <button className="secondary-button" type="button" disabled={rollingBack} onClick={() => setRollbackTarget(null)}>取消</button>
                <button className="primary-button" type="button" disabled={rollingBack} onClick={() => void handleRollback()}>{rollingBack ? '正在回退…' : '确认回退'}</button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
