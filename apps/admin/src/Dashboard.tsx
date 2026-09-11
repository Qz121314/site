import {
  ArrowRight,
  Boxes,
  FileText,
  FolderKanban,
  Image,
  LayoutDashboard,
  MessageSquare,
  PanelTop,
  PenLine,
  Settings2,
  X,
} from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AdminApiError,
  fetchSections,
  fetchSiteSettings,
  type AdminSection,
} from './api';
import {
  getAdminViewContext,
  parseAdminView,
  parseDynamicView,
  readInitialAdminView,
  rememberAdminView,
  SETTINGS_ADMIN_VIEWS,
  writeAdminViewLocation,
  type AdminView,
  type SettingsAdminView,
} from './admin-navigation';
import {
  readAdminNavigationPreferences,
  saveAdminNavigationPreferences,
  type AdminNavigationPreferences,
} from './admin-navigation-preferences';
import { useAdminUnsavedState } from './admin-unsaved-state';
import { Button } from './components/ui/button';
import type {
  ProductDependencyTarget,
  ProductResumeRequest,
} from './ProductManagementView';
import {
  fetchPublishStatus,
  publishStorefront,
  rollbackStorefront,
  type PublishStatus,
} from './publish-api';
import { WorkspacePublishMenu, type RollbackTarget } from './shell/WorkspacePublishMenu';
import { AdminShell } from './shell/AdminShell';

const SiteSettingsWorkspace = lazy(() =>
  import('./settings/SiteSettingsWorkspace').then((module) => ({
    default: module.SiteSettingsWorkspace,
  })),
);
const ThemeCenterView = lazy(() =>
  import('./ThemeCenterView').then((module) => ({ default: module.ThemeCenterView })),
);
const AssetLibraryView = lazy(() =>
  import('./AssetLibraryView').then((module) => ({ default: module.AssetLibraryView })),
);
const CustomerServiceView = lazy(() =>
  import('./CustomerServiceView').then((module) => ({
    default: module.CustomerServiceView,
  })),
);
const SectionManagementView = lazy(() =>
  import('./SectionManagementView').then((module) => ({
    default: module.SectionManagementView,
  })),
);
const FaqManagementView = lazy(() =>
  import('./FaqManagementView').then((module) => ({ default: module.FaqManagementView })),
);
const ProductManagementView = lazy(() =>
  import('./ProductManagementView').then((module) => ({
    default: module.ProductManagementView,
  })),
);
const CategoryManagementView = lazy(() =>
  import('./CategoryManagementView').then((module) => ({
    default: module.CategoryManagementView,
  })),
);
const TagManagementView = lazy(() =>
  import('./TagManagementView').then((module) => ({ default: module.TagManagementView })),
);
const ConversionPoolView = lazy(() =>
  import('./ConversionPoolView').then((module) => ({
    default: module.ConversionPoolView,
  })),
);
type DashboardProps = {
  expiresAt: string | undefined;
  loggingOut: boolean;
  logoutError: string;
  onLogout: () => void;
  onSessionExpired: () => void;
};

type ProductHandoff = ProductResumeRequest & {
  sectionId: string;
  target: ProductDependencyTarget;
};

type PublishFeedback = { type: 'success' | 'error'; message: string } | null;
type PendingDiscardAction =
  { kind: 'navigate'; view: AdminView } | { kind: 'logout' } | null;

type HistoryMode = 'push' | 'replace';
type WorkspaceWidth = 'narrow' | 'medium' | 'wide' | 'split-pane';

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

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function isSettingsView(view: AdminView): view is SettingsAdminView {
  return SETTINGS_ADMIN_VIEWS.has(view as SettingsAdminView);
}

function publishKeyForView(view: AdminView): string | null {
  if (isSettingsView(view) || view === 'theme') return 'site';
  if (view === 'faq') return 'faq';
  if (view === 'sections') return 'sections-index';
  const dynamic = parseDynamicView(view);
  return dynamic ? `section:${dynamic.sectionId}` : null;
}

function workspaceWidthForView(view: AdminView): WorkspaceWidth {
  if (view === 'system-general') return 'medium';
  if (
    view === 'home' ||
    view === 'navigation' ||
    view === 'messages' ||
    view === 'pwa' ||
    view === 'system-infrastructure'
  ) {
    return 'medium';
  }
  if (parseDynamicView(view)) return 'split-pane';
  return 'wide';
}

const PROJECT_METADATA = [
  ['仓库', 'Qz121314/site'],
  ['技术栈', 'React / Vite / TypeScript'],
  ['部署', 'Cloudflare Workers / Pages'],
  ['数据', 'D1 / R2'],
  ['包管理', 'pnpm'],
  ['内容', 'Markdown 文章'],
] as const;

function DashboardLauncher({
  sections,
  onNavigate,
}: {
  sections: AdminSection[];
  onNavigate: (view: AdminView) => void;
}) {
  const entries = [
    ['首页', '管理首页布局', 'home', PanelTop],
    ['导航', '管理 Storefront 导航', 'navigation', LayoutDashboard],
    ['视觉系统', '管理前端主题与组件样式', 'theme', PenLine],
    ['文章中心', '管理 Markdown 内容', 'faq', FileText],
    ['素材库', '管理上传素材与文件夹', 'assets', Image],
    ['Messages', '会话列表卡片配置', 'messages', MessageSquare],
    ['客服接入', '管理客服连接配置', 'customer-service', Settings2],
    ['基本设置', '管理站点基础配置', 'system-general', Settings2],
  ] as const;
  return (
    <div className="dashboard-launcher">
      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-kicker">Workspace</span>
            <h2>常用入口</h2>
          </div>
          <span className="dashboard-count">{entries.length} 个入口</span>
        </div>
        <div className="dashboard-entry-grid">
          {entries.map(([label, description, view, Icon]) => (
            <button
              className="dashboard-entry"
              key={view}
              type="button"
              onClick={() => onNavigate(view)}
            >
              <span className="dashboard-entry-icon">
                <Icon size={17} strokeWidth={1.8} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>
      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-kicker">Repository</span>
            <h2>项目概况</h2>
          </div>
          <a
            className="dashboard-repository-link"
            href="https://github.com/Qz121314/site"
            target="_blank"
            rel="noreferrer"
            aria-label="在 GitHub 中查看 Qz121314/site 仓库"
            title="在 GitHub 中查看仓库"
          >
            <svg
              aria-hidden="true"
              className="dashboard-github-mark"
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="currentColor"
            >
              <path d="M12 .297a12 12 0 0 0-3.79 23.384c.6.113.82-.26.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.084 1.84 1.237 1.84 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 6.006 0c2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.118 3.176.77.84 1.233 1.91 1.233 3.22 0 4.61-2.806 5.625-5.48 5.92.43.372.823 1.103.823 2.222v3.293c0 .32.216.694.825.576A12 12 0 0 0 12 .297" />
            </svg>
          </a>
        </div>
        <dl className="dashboard-metadata">
          {PROJECT_METADATA.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <span className="dashboard-kicker">Catalog</span>
            <h2>分区入口</h2>
          </div>
          <span className="dashboard-count">{sections.length} 个分区</span>
        </div>
        <div className="dashboard-section-list">
          <button
            className="dashboard-section-link"
            type="button"
            onClick={() => onNavigate('sections')}
          >
            <FolderKanban size={17} />
            <span>
              <strong>分区管理</strong>
              <small>管理所有分区</small>
            </span>
            <ArrowRight size={15} />
          </button>
          {sections.map((section) => (
            <button
              className="dashboard-section-link"
              key={section.id}
              type="button"
              onClick={() => onNavigate(`products:${section.id}`)}
            >
              <Boxes size={17} />
              <span>
                <strong>{section.name}</strong>
                <small>
                  {section.productCount} 个产品 · {section.conversionMethodCount}{' '}
                  个转化方法
                </small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function Dashboard({
  expiresAt,
  loggingOut,
  logoutError,
  onLogout,
  onSessionExpired,
}: DashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>(readInitialAdminView);
  const [navigationPreferences, setNavigationPreferences] =
    useState<AdminNavigationPreferences>(readAdminNavigationPreferences);
  const initialViewRef = useRef(activeView);
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [pwaIconAssetId, setPwaIconAssetId] = useState<string | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionsError, setSectionsError] = useState('');
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);
  const [publishStatusError, setPublishStatusError] = useState('');
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [publishFeedback, setPublishFeedback] = useState<PublishFeedback>(null);
  const [rollbackTarget, setRollbackTarget] = useState<RollbackTarget | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [pendingDiscardAction, setPendingDiscardAction] =
    useState<PendingDiscardAction>(null);
  const [productHandoff, setProductHandoff] = useState<ProductHandoff | null>(null);
  const [messagesActions, setMessagesActions] = useState<ReactNode>(null);
  const [themeActions, setThemeActions] = useState<ReactNode>(null);
  const unsaved = useAdminUnsavedState();

  useEffect(() => {
    if (activeView !== 'messages') setMessagesActions(null);
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'theme') setThemeActions(null);
  }, [activeView]);

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
    setPublishStatusError('');
    try {
      setPublishStatus(await fetchPublishStatus());
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setPublishStatusError(
        error instanceof Error ? error.message : '发布状态读取失败。',
      );
    }
  }, [onSessionExpired]);

  const loadPwaIcon = useCallback(async () => {
    try {
      const settings = await fetchSiteSettings();
      setPwaIconAssetId(settings.pwaIconAssetId);
    } catch (error) {
      if (isSessionError(error)) onSessionExpired();
    }
  }, [onSessionExpired]);

  const commitView = useCallback(
    (nextView: AdminView, mode: HistoryMode = 'push') => {
      if (nextView === activeView) {
        writeAdminViewLocation(nextView, 'replace');
        return;
      }
      setActiveView(nextView);
      writeAdminViewLocation(nextView, mode);
    },
    [activeView],
  );

  useEffect(() => {
    writeAdminViewLocation(initialViewRef.current, 'replace');
  }, []);

  useEffect(() => {
    void loadSections();
    void loadPublishStatus();
    void loadPwaIcon();
  }, [loadPwaIcon, loadPublishStatus, loadSections]);

  useEffect(() => {
    const handleMutation = () => void loadPublishStatus();
    window.addEventListener('admin:data-mutated', handleMutation);
    return () => window.removeEventListener('admin:data-mutated', handleMutation);
  }, [loadPublishStatus]);

  useEffect(() => {
    const handlePwaIconUpdated = (event: Event) => {
      const assetId = (event as CustomEvent<{ assetId?: unknown }>).detail?.assetId;
      setPwaIconAssetId(typeof assetId === 'string' ? assetId : null);
    };
    window.addEventListener('admin:pwa-icon-updated', handlePwaIconUpdated);
    return () =>
      window.removeEventListener('admin:pwa-icon-updated', handlePwaIconUpdated);
  }, []);

  useEffect(() => {
    if (!unsaved.isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsaved.isDirty]);

  useEffect(() => {
    const handleLocationChange = () => {
      const nextView = parseAdminView(window.location.hash);
      if (!nextView) {
        writeAdminViewLocation(activeView, 'replace');
        return;
      }
      if (nextView === activeView) {
        rememberAdminView(activeView);
        return;
      }
      if (unsaved.isDirty) {
        writeAdminViewLocation(activeView, 'replace');
        setPendingDiscardAction({ kind: 'navigate', view: nextView });
        return;
      }
      rememberAdminView(nextView);
      setActiveView(nextView);
    };
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [activeView, unsaved.isDirty]);

  useEffect(() => {
    const dynamic = parseDynamicView(activeView);
    if (!dynamic) return;
    if (
      !sectionsLoading &&
      !sections.some((section) => section.id === dynamic.sectionId)
    ) {
      commitView('sections', 'replace');
    }
  }, [activeView, commitView, sections, sectionsLoading]);

  function requestView(nextView: AdminView) {
    if (nextView === activeView) return;
    if (unsaved.isDirty) {
      setPendingDiscardAction({ kind: 'navigate', view: nextView });
      return;
    }
    commitView(nextView);
  }

  function requestLogout() {
    if (unsaved.isDirty) {
      setPendingDiscardAction({ kind: 'logout' });
      return;
    }
    onLogout();
  }

  function updateNavigationPreferences(next: AdminNavigationPreferences) {
    setNavigationPreferences(next);
    saveAdminNavigationPreferences(next);
  }

  function confirmDiscardAndContinue() {
    const action = pendingDiscardAction;
    if (!action) return;
    setPendingDiscardAction(null);
    if (action.kind === 'navigate') commitView(action.view);
    else onLogout();
  }

  async function handlePublish(moduleKey: string) {
    if (publishingKey || rollingBack || loggingOut) return;
    if (unsaved.isDirty) {
      setPublishFeedback({
        type: 'error',
        message: '当前存在未保存修改。请先保存或取消编辑，再发布前台。',
      });
      return;
    }
    setPublishingKey(moduleKey);
    setPublishFeedback(null);
    try {
      const result = await publishStorefront(moduleKey);
      await loadPublishStatus();
      const changed = result.publications.filter((publication) => !publication.unchanged);
      const unchanged = result.publications.length > 0 && changed.length === 0;
      setPublishFeedback({
        type: 'success',
        message: result.bootstrapped
          ? '模块化前台已完成首次发布；后续可以按板块独立发布。'
          : unchanged
            ? '该板块前台已是最新，未生成重复版本。'
            : moduleKey === 'all'
              ? `已发布 ${changed.length} 个有修改的板块。`
              : `${changed[0]?.label ?? '当前板块'}已发布。`,
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
      setPublishingKey(null);
    }
  }

  async function handleRollback() {
    if (!rollbackTarget || rollingBack || publishingKey || loggingOut) return;
    if (unsaved.isDirty) {
      setRollbackTarget(null);
      setPublishFeedback({
        type: 'error',
        message: '当前存在未保存修改。请先处理当前编辑内容，再回退前台版本。',
      });
      return;
    }
    setRollingBack(true);
    setPublishFeedback(null);
    try {
      await rollbackStorefront(
        rollbackTarget.moduleKey,
        rollbackTarget.version.contentVersion,
      );
      await loadPublishStatus();
      setRollbackTarget(null);
      setPublishFeedback({
        type: 'success',
        message: `${rollbackTarget.moduleLabel}已回退到 ${formatVersionTime(rollbackTarget.version.publishedAt)} 的版本。`,
      });
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setPublishFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '回退板块版本失败。',
      });
    } finally {
      setRollingBack(false);
    }
  }

  const currentSection = useMemo(() => {
    const dynamic = parseDynamicView(activeView);
    if (!dynamic) return null;
    const section = sections.find((item) => item.id === dynamic.sectionId);
    return section ? { kind: dynamic.kind, section } : null;
  }, [activeView, sections]);
  const context = useMemo(
    () => getAdminViewContext(activeView, sections),
    [activeView, sections],
  );
  const unsavedTitle =
    unsaved.labels.length > 0
      ? `未保存：${unsaved.labels.join('、')}`
      : '当前有未保存修改';
  const contextPublishKey = publishKeyForView(activeView);
  const currentSectionHandoff =
    currentSection && productHandoff?.sectionId === currentSection.section.id
      ? productHandoff
      : null;

  const publishingActions = contextPublishKey ? (
    <WorkspacePublishMenu
      key={activeView}
      status={publishStatus}
      statusError={publishStatusError}
      contextKey={contextPublishKey}
      publishingKey={publishingKey}
      rollingBack={rollingBack || loggingOut}
      hasUnsavedChanges={unsaved.isDirty}
      unsavedTitle={unsavedTitle}
      onRefresh={() => void loadPublishStatus()}
      onPublish={(moduleKey) => void handlePublish(moduleKey)}
      onRequestRollback={setRollbackTarget}
    />
  ) : null;
  const localWorkspaceActions =
    activeView === 'theme'
      ? themeActions
      : activeView === 'messages'
        ? messagesActions
        : null;
  const workspaceActions =
    publishingActions || localWorkspaceActions ? (
      <>
        {publishingActions}
        {localWorkspaceActions}
      </>
    ) : null;

  const pageSecondaryAction =
    currentSectionHandoff && currentSection?.kind !== 'products' ? (
      <Button
        variant="secondary"
        type="button"
        onClick={() => requestView(`products:${currentSectionHandoff.sectionId}`)}
      >
        返回产品草稿
      </Button>
    ) : null;

  return (
    <>
      <AdminShell
        activeView={activeView}
        sections={sections}
        context={context}
        onNavigate={requestView}
        workspaceActions={workspaceActions}
        pageSecondaryAction={pageSecondaryAction}
        workspaceWidth={workspaceWidthForView(activeView)}
        navigationPreferences={navigationPreferences}
        onNavigationPreferencesChange={updateNavigationPreferences}
        onLogout={requestLogout}
        loggingOut={loggingOut}
        logoutDisabled={publishingKey !== null || rollingBack}
        sessionExpiresAt={expiresAt}
        pwaIconAssetId={pwaIconAssetId}
      >
        {publishFeedback ? (
          <div
            className={`notice ${publishFeedback.type === 'success' ? 'notice-success' : 'notice-error'} publish-feedback`}
            role={publishFeedback.type === 'error' ? 'alert' : 'status'}
          >
            {publishFeedback.message}
          </div>
        ) : null}
        {logoutError ? (
          <div className="notice notice-error" role="alert">
            {logoutError}
          </div>
        ) : null}
        {sectionsError ? (
          <div className="notice notice-error" role="alert">
            {sectionsError}
            <Button variant="secondary" type="button" onClick={() => void loadSections()}>
              重新加载
            </Button>
          </div>
        ) : null}

        <Suspense
          fallback={
            <div className="notice" role="status" aria-live="polite">
              正在加载当前模块…
            </div>
          }
        >
          {activeView === 'dashboard' ? (
            <DashboardLauncher sections={sections} onNavigate={requestView} />
          ) : isSettingsView(activeView) ? (
            <SiteSettingsWorkspace
              view={activeView}
              sections={sections}
              onNavigate={requestView}
              onSessionExpired={onSessionExpired}
              onMessagesActionsChange={setMessagesActions}
            />
          ) : activeView === 'theme' ? (
            <ThemeCenterView
              key={activeView}
              onSessionExpired={onSessionExpired}
              onActionsChange={setThemeActions}
            />
          ) : activeView === 'assets' ? (
            <AssetLibraryView key={activeView} onSessionExpired={onSessionExpired} />
          ) : activeView === 'customer-service' ? (
            <CustomerServiceView key={activeView} onSessionExpired={onSessionExpired} />
          ) : activeView === 'sections' ? (
            <SectionManagementView
              key={activeView}
              activeSections={sections}
              onActiveSectionsChange={setSections}
              onSessionExpired={onSessionExpired}
            />
          ) : activeView === 'faq' ? (
            <FaqManagementView key={activeView} onSessionExpired={onSessionExpired} />
          ) : currentSection?.kind === 'products' ? (
            <ProductManagementView
              key={activeView}
              section={currentSection.section}
              resumeRequest={currentSectionHandoff}
              onResumeHandled={() => setProductHandoff(null)}
              onConfigureDependency={(target, request) => {
                setProductHandoff({
                  ...request,
                  sectionId: currentSection.section.id,
                  target,
                });
                commitView(`${target}:${currentSection.section.id}`);
              }}
              onSessionExpired={onSessionExpired}
            />
          ) : currentSection?.kind === 'categories' ? (
            <CategoryManagementView
              key={activeView}
              section={currentSection.section}
              onSessionExpired={onSessionExpired}
            />
          ) : currentSection?.kind === 'tags' ? (
            <TagManagementView
              key={activeView}
              section={currentSection.section}
              onSessionExpired={onSessionExpired}
            />
          ) : currentSection?.kind === 'conversion-pool' ? (
            <ConversionPoolView
              key={activeView}
              section={currentSection.section}
              onSessionExpired={onSessionExpired}
            />
          ) : sectionsLoading ? (
            <div className="notice" role="status">
              正在读取分区…
            </div>
          ) : null}
        </Suspense>
      </AdminShell>

      {rollbackTarget ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog admin-dialog-small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-rollback-title"
          >
            <div className="admin-dialog-header">
              <div>
                <p>{rollbackTarget.moduleLabel}</p>
                <h3 id="publish-rollback-title">
                  回退到 {formatVersionTime(rollbackTarget.version.publishedAt)}？
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="关闭"
                disabled={rollingBack}
                onClick={() => setRollbackTarget(null)}
              >
                <X aria-hidden="true" size={18} />
              </Button>
            </div>
            <p className="delete-warning">
              只会切换该板块的 R2 版本；其他板块和后台当前数据都不会改变。
            </p>
            <div className="admin-dialog-actions">
              <Button
                variant="secondary"
                type="button"
                disabled={rollingBack}
                onClick={() => setRollbackTarget(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                disabled={rollingBack}
                onClick={() => void handleRollback()}
              >
                {rollingBack ? '正在回退…' : '确认回退'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDiscardAction ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog admin-dialog-small"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-unsaved-title"
          >
            <div className="admin-dialog-header">
              <div>
                <p>未保存修改</p>
                <h3 id="admin-unsaved-title">放弃当前修改？</h3>
              </div>
            </div>
            <div className="admin-unsaved-dialog-copy">
              <p>当前编辑内容尚未保存到后台。</p>
              {unsaved.labels.length > 0 ? (
                <div className="admin-unsaved-list">
                  {unsaved.labels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="admin-dialog-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setPendingDiscardAction(null)}
              >
                继续编辑
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={confirmDiscardAndContinue}
              >
                {pendingDiscardAction.kind === 'logout'
                  ? '放弃修改并退出'
                  : '放弃修改并切换'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
