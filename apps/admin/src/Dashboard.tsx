import { X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminApiError, fetchSections, type AdminSection } from './api';
import {
  getAdminViewContext,
  parseAdminView,
  parseDynamicView,
  readInitialAdminView,
  rememberAdminView,
  writeAdminViewLocation,
  type AdminView,
} from './admin-navigation';
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
import {
  AdminPublishingControls,
  formatVersionTime,
  type RollbackTarget,
} from './shell/AdminPublishingControls';
import { AdminShell } from './shell/AdminShell';

const SiteSettingsView = lazy(() =>
  import('./SiteSettingsView').then((module) => ({ default: module.SiteSettingsView })),
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

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function publishKeyForView(view: AdminView): string {
  if (view === 'settings' || view === 'theme') return 'site';
  if (view === 'faq') return 'faq';
  if (view === 'sections') return 'sections-index';
  const dynamic = parseDynamicView(view);
  return dynamic ? `section:${dynamic.sectionId}` : 'all';
}

function ShellPlaceholder({ view }: { view: 'dashboard' | 'system' }) {
  return (
    <section
      className="admin-shell-placeholder"
      aria-label={view === 'dashboard' ? '仪表盘' : '系统'}
    >
      <strong>
        {view === 'dashboard' ? '选择一个业务域开始管理' : '系统级操作保持统一入口'}
      </strong>
      <p>
        {view === 'dashboard'
          ? '仪表盘当前作为管理工作区入口，不新增统计或业务功能。'
          : '发布、版本回退、会话状态和退出登录继续由顶部全局操作区统一管理。'}
      </p>
    </section>
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
  const initialViewRef = useRef(activeView);
  const [sections, setSections] = useState<AdminSection[]>([]);
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
  const unsaved = useAdminUnsavedState();

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
  }, [loadPublishStatus, loadSections]);

  useEffect(() => {
    const handleMutation = () => void loadPublishStatus();
    window.addEventListener('admin:data-mutated', handleMutation);
    return () => window.removeEventListener('admin:data-mutated', handleMutation);
  }, [loadPublishStatus]);

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

  const topBarActions = (
    <>
      <AdminPublishingControls
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
      <span className="environment-badge">
        {expiresAt
          ? `会话至 ${new Date(expiresAt).toLocaleTimeString('zh-CN')}`
          : 'PRODUCTION'}
      </span>
      <Button
        variant="secondary"
        type="button"
        onClick={requestLogout}
        disabled={loggingOut || publishingKey !== null || rollingBack}
      >
        {loggingOut ? '正在退出…' : '退出登录'}
      </Button>
    </>
  );

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
        topBarActions={topBarActions}
        pageSecondaryAction={pageSecondaryAction}
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
          {activeView === 'dashboard' || activeView === 'system' ? (
            <ShellPlaceholder view={activeView} />
          ) : activeView === 'settings' ? (
            <SiteSettingsView key={activeView} onSessionExpired={onSessionExpired} />
          ) : activeView === 'theme' ? (
            <ThemeCenterView key={activeView} onSessionExpired={onSessionExpired} />
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
