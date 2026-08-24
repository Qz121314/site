import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminApiError, fetchSections, type AdminSection } from './api';
import { useAdminUnsavedState } from './admin-unsaved-state';
import type {
  ProductDependencyTarget,
  ProductResumeRequest,
} from './ProductManagementView';
import {
  fetchPublishStatus,
  publishStorefront,
  rollbackStorefront,
  type PublishModuleStatus,
  type PublishStatus,
  type PublishVersion,
} from './publish-api';

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

type DynamicViewKind = 'products' | 'categories' | 'tags' | 'conversion-pool';

type AdminView =
  | 'settings'
  | 'theme'
  | 'assets'
  | 'customer-service'
  | 'faq'
  | 'sections'
  | `${DynamicViewKind}:${string}`;

type DashboardProps = {
  expiresAt: string | undefined;
  loggingOut: boolean;
  logoutError: string;
  onLogout: () => void;
  onSessionExpired: () => void;
};

type DynamicView = {
  kind: DynamicViewKind;
  sectionId: string;
};

type ProductHandoff = ProductResumeRequest & {
  sectionId: string;
  target: ProductDependencyTarget;
};

type PublishFeedback = { type: 'success' | 'error'; message: string } | null;
type RollbackTarget = {
  moduleKey: string;
  moduleLabel: string;
  version: PublishVersion;
} | null;
type PendingDiscardAction =
  { kind: 'navigate'; view: AdminView } | { kind: 'logout' } | null;

type HistoryMode = 'push' | 'replace';

const ADMIN_VIEW_STORAGE_KEY = 'site.admin.lastView';
const FIXED_ADMIN_VIEWS = new Set<AdminView>([
  'settings',
  'theme',
  'assets',
  'customer-service',
  'faq',
  'sections',
]);

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function parseDynamicView(view: AdminView): DynamicView | null {
  const separatorIndex = view.indexOf(':');
  if (separatorIndex < 0) return null;

  const kind = view.slice(0, separatorIndex);
  const sectionId = view.slice(separatorIndex + 1);
  if (
    (kind !== 'products' &&
      kind !== 'categories' &&
      kind !== 'tags' &&
      kind !== 'conversion-pool') ||
    !sectionId
  ) {
    return null;
  }

  return { kind, sectionId };
}

function parseAdminView(value: string | null): AdminView | null {
  if (!value) return null;
  let normalized = value.startsWith('#') ? value.slice(1) : value;
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    return null;
  }
  if (FIXED_ADMIN_VIEWS.has(normalized as AdminView)) return normalized as AdminView;
  const candidate = normalized as AdminView;
  return parseDynamicView(candidate) ? candidate : null;
}

function readInitialAdminView(): AdminView {
  if (typeof window === 'undefined') return 'settings';
  const fromHash = parseAdminView(window.location.hash);
  if (fromHash) return fromHash;
  try {
    const stored = parseAdminView(window.localStorage.getItem(ADMIN_VIEW_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  return 'settings';
}

function adminViewHash(view: AdminView): string {
  return `#${encodeURIComponent(view)}`;
}

function rememberAdminView(view: AdminView): void {
  try {
    window.localStorage.setItem(ADMIN_VIEW_STORAGE_KEY, view);
  } catch {
    // Navigation remains usable even when localStorage is unavailable.
  }
}

function writeAdminViewLocation(view: AdminView, mode: HistoryMode): void {
  if (typeof window === 'undefined') return;
  const hash = adminViewHash(view);
  rememberAdminView(view);
  if (window.location.hash === hash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
  if (mode === 'push') window.history.pushState(null, '', nextUrl);
  else window.history.replaceState(null, '', nextUrl);
}

function getViewContext(view: AdminView, sections: AdminSection[]) {
  const fixed: Partial<Record<AdminView, { eyebrow: string; title: string }>> = {
    settings: { eyebrow: '全站配置', title: '站点设置' },
    theme: { eyebrow: '用户前端视觉', title: '主题中心' },
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

function publishKeyForView(view: AdminView): string {
  if (view === 'settings' || view === 'theme') return 'site';
  if (view === 'faq') return 'faq';
  if (view === 'sections') return 'sections-index';
  const dynamic = parseDynamicView(view);
  return dynamic ? `section:${dynamic.sectionId}` : 'all';
}

function publishStatusLabel(
  status: PublishStatus | null,
  publishing: boolean,
  hasUnsavedChanges: boolean,
  hasError: boolean,
): string {
  if (publishing) return '正在发布';
  if (hasUnsavedChanges) return '有未保存修改';
  if (hasError) return '发布状态读取失败';
  if (!status) return '读取发布状态';
  if (status.bootstrapRequired) return '需要首次发布';
  if (status.modules.some((module) => module.lastJob?.status === 'failed'))
    return '部分板块发布失败';
  if (status.dirtyCount > 0) return `${status.dirtyCount} 项待发布`;
  return '前台已是最新';
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

function modulePublishButtonLabel(
  module: PublishModuleStatus | null,
  key: string,
): string {
  if (key === 'all') return '发布全部';
  if (!module) return '发布当前板块';
  switch (module.kind) {
    case 'site':
      return '发布站点设置';
    case 'sections-index':
      return '发布分区导航';
    case 'faq':
      return '发布 FAQ';
    default:
      return '发布当前分区';
  }
}

function moduleStateLabel(module: PublishModuleStatus): string {
  if (module.lastJob?.status === 'failed') return '上次失败';
  if (!module.currentVersion) return '未发布';
  return module.isCurrent ? '已是最新' : '有修改';
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
  const [publishPanelOpen, setPublishPanelOpen] = useState(false);
  const [historyModuleKey, setHistoryModuleKey] = useState('site');
  const [rollbackTarget, setRollbackTarget] = useState<RollbackTarget>(null);
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
      setPublishPanelOpen(false);
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
    const handleHashChange = () => {
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
      setPublishPanelOpen(false);
      rememberAdminView(nextView);
      setActiveView(nextView);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
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

  const contextPublishKey = publishKeyForView(activeView);
  const contextPublishModule = useMemo(
    () =>
      publishStatus?.modules.find((module) => module.key === contextPublishKey) ?? null,
    [contextPublishKey, publishStatus?.modules],
  );
  const historyModule = useMemo(
    () =>
      publishStatus?.modules.find((module) => module.key === historyModuleKey) ?? null,
    [historyModuleKey, publishStatus?.modules],
  );

  useEffect(() => {
    if (!publishStatus?.modules.length) return;
    if (
      contextPublishKey !== 'all' &&
      publishStatus.modules.some((module) => module.key === contextPublishKey)
    ) {
      setHistoryModuleKey(contextPublishKey);
      return;
    }
    if (!publishStatus.modules.some((module) => module.key === historyModuleKey)) {
      setHistoryModuleKey(
        publishStatus.modules.find((module) => !module.isCurrent)?.key ??
          publishStatus.modules[0]?.key ??
          'site',
      );
    }
  }, [contextPublishKey, historyModuleKey, publishStatus]);

  function requestView(nextView: AdminView) {
    if (nextView === activeView) return;
    setPublishPanelOpen(false);
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
    if (publishingKey || rollingBack) return;
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
      setPublishPanelOpen(false);
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
    if (!rollbackTarget || rollingBack || publishingKey) return;
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
      setPublishPanelOpen(false);
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

  const heading = useMemo(
    () => getViewContext(activeView, sections),
    [activeView, sections],
  );
  const currentSection = useMemo(() => {
    const dynamic = parseDynamicView(activeView);
    if (!dynamic) return null;
    const section = sections.find((item) => item.id === dynamic.sectionId);
    return section ? { kind: dynamic.kind, section } : null;
  }, [activeView, sections]);
  const unsavedTitle =
    unsaved.labels.length > 0
      ? `未保存：${unsaved.labels.join('、')}`
      : '当前有未保存修改';
  const contextIsCurrent =
    contextPublishKey === 'all'
      ? publishStatus?.isCurrent === true
      : contextPublishModule?.isCurrent === true;
  const publishing = publishingKey !== null;
  const currentSectionHandoff =
    currentSection && productHandoff?.sectionId === currentSection.section.id
      ? productHandoff
      : null;

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <span>SP</span>
          <strong>业务运营后台</strong>
        </div>

        <nav className="admin-nav" aria-label="后台导航">
          <div className="sidebar-section-label sidebar-section-label-first">
            全局管理
          </div>
          <button
            className={activeView === 'settings' ? 'is-active' : undefined}
            type="button"
            onClick={() => requestView('settings')}
          >
            站点设置
          </button>
          <button
            className={activeView === 'theme' ? 'is-active' : undefined}
            type="button"
            onClick={() => requestView('theme')}
          >
            主题中心
          </button>
          <button
            className={activeView === 'assets' ? 'is-active' : undefined}
            type="button"
            onClick={() => requestView('assets')}
          >
            素材库管理
          </button>
          <button
            className={activeView === 'customer-service' ? 'is-active' : undefined}
            type="button"
            onClick={() => requestView('customer-service')}
          >
            客服管理
          </button>
          <button
            className={activeView === 'faq' ? 'is-active' : undefined}
            type="button"
            onClick={() => requestView('faq')}
          >
            FAQ 管理
          </button>
          <button
            className={activeView === 'sections' ? 'is-active' : undefined}
            type="button"
            onClick={() => requestView('sections')}
          >
            分区管理
          </button>

          <div className="sidebar-section-label">业务分区</div>
          {sectionsLoading ? (
            <small className="sidebar-loading">正在读取分区…</small>
          ) : null}
          {sections.map((section) => {
            const sectionIsCurrent = currentSection?.section.id === section.id;
            return (
              <div className="dynamic-menu" key={section.id}>
                <button
                  className={sectionIsCurrent ? 'is-current-section' : undefined}
                  type="button"
                  onClick={() => requestView(`products:${section.id}`)}
                >
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
              <nav
                className="section-workspace-nav"
                aria-label={`${currentSection.section.name} 管理`}
              >
                <button
                  className={currentSection.kind === 'products' ? 'is-active' : undefined}
                  type="button"
                  aria-current={currentSection.kind === 'products' ? 'page' : undefined}
                  onClick={() => requestView(`products:${currentSection.section.id}`)}
                >
                  产品管理
                </button>
                <button
                  className={
                    currentSection.kind === 'categories' ? 'is-active' : undefined
                  }
                  type="button"
                  aria-current={currentSection.kind === 'categories' ? 'page' : undefined}
                  onClick={() => requestView(`categories:${currentSection.section.id}`)}
                >
                  分类管理
                </button>
                <button
                  className={currentSection.kind === 'tags' ? 'is-active' : undefined}
                  type="button"
                  aria-current={currentSection.kind === 'tags' ? 'page' : undefined}
                  onClick={() => requestView(`tags:${currentSection.section.id}`)}
                >
                  标签管理
                </button>
                <button
                  className={
                    currentSection.kind === 'conversion-pool' ? 'is-active' : undefined
                  }
                  type="button"
                  aria-current={
                    currentSection.kind === 'conversion-pool' ? 'page' : undefined
                  }
                  onClick={() =>
                    requestView(`conversion-pool:${currentSection.section.id}`)
                  }
                >
                  转化池
                </button>
                {currentSectionHandoff && currentSection.kind !== 'products' ? (
                  <button
                    className="product-handoff-return"
                    type="button"
                    onClick={() => requestView(`products:${currentSection.section.id}`)}
                  >
                    ← 返回产品草稿
                  </button>
                ) : null}
              </nav>
            ) : null}
          </div>
          <div className="header-actions">
            {unsaved.isDirty ? (
              <span className="admin-unsaved-chip" title={unsavedTitle}>
                未保存修改
              </span>
            ) : null}
            <>
              <div className="publish-version-control">
                <button
                  className={`publish-status-chip${publishStatusError || publishStatus?.modules.some((module) => module.lastJob?.status === 'failed') ? ' is-error' : ''}${(publishStatus && !publishStatus.isCurrent) || unsaved.isDirty ? ' is-dirty' : ''}`}
                  type="button"
                  aria-expanded={publishPanelOpen}
                  onClick={() => {
                    const next = !publishPanelOpen;
                    setPublishPanelOpen(next);
                    if (next) void loadPublishStatus();
                  }}
                >
                  {publishStatusLabel(
                    publishStatus,
                    publishing,
                    unsaved.isDirty,
                    Boolean(publishStatusError),
                  )}
                </button>
                {publishPanelOpen ? (
                  <div className="publish-version-popover">
                    <div className="publish-version-popover-title">
                      <div>
                        <strong>板块发布</strong>
                        <small>每个板块独立保留最近 3 版</small>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPublishPanelOpen(false)}
                        aria-label="关闭"
                      >
                        ×
                      </button>
                    </div>
                    {publishStatusError ? (
                      <div className="publish-status-error" role="alert">
                        <span>{publishStatusError}</span>
                        <button type="button" onClick={() => void loadPublishStatus()}>
                          重新读取
                        </button>
                      </div>
                    ) : null}
                    <div className="publish-module-selector">
                      <label>
                        <span>查看板块</span>
                        <select
                          value={historyModuleKey}
                          onChange={(event) => setHistoryModuleKey(event.target.value)}
                        >
                          {publishStatus?.modules.map((module) => (
                            <option key={module.key} value={module.key}>
                              {module.label} · {moduleStateLabel(module)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={
                          !historyModule ||
                          historyModule.isCurrent ||
                          publishing ||
                          rollingBack ||
                          unsaved.isDirty
                        }
                        onClick={() =>
                          historyModule && void handlePublish(historyModule.key)
                        }
                      >
                        发布此板块
                      </button>
                    </div>
                    <div className="publish-module-summary">
                      <span>
                        {historyModule ? moduleStateLabel(historyModule) : '未选择'}
                      </span>
                      <small>
                        {historyModule?.publishedAt
                          ? `当前版本 ${formatVersionTime(historyModule.publishedAt)}`
                          : '尚无当前版本'}
                      </small>
                    </div>
                    <div className="publish-version-list">
                      {historyModule?.versions.length ? (
                        historyModule.versions.map((version) => (
                          <div
                            className={`publish-version-row${version.isCurrent ? ' is-current' : ''}`}
                            key={version.contentVersion}
                          >
                            <div>
                              <strong>{formatVersionTime(version.publishedAt)}</strong>
                              <small>{versionCode(version)}</small>
                            </div>
                            <span>
                              {version.isCurrent ? '当前' : `${version.objectCount} 项`}
                            </span>
                            <button
                              type="button"
                              disabled={
                                version.isCurrent ||
                                publishing ||
                                rollingBack ||
                                unsaved.isDirty
                              }
                              onClick={() =>
                                setRollbackTarget({
                                  moduleKey: historyModule.key,
                                  moduleLabel: historyModule.label,
                                  version,
                                })
                              }
                              title={unsaved.isDirty ? '请先处理未保存修改' : undefined}
                            >
                              {version.isCurrent ? '使用中' : '回退'}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="publish-version-empty">该板块尚无发布版本</div>
                      )}
                    </div>
                    <div className="publish-module-footer">
                      <span>{publishStatus?.dirtyCount ?? 0} 个板块待发布</span>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          publishStatus?.isCurrent === true ||
                          publishing ||
                          rollingBack ||
                          unsaved.isDirty
                        }
                        onClick={() => void handlePublish('all')}
                      >
                        发布全部待更新
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                className="primary-button storefront-publish-button"
                type="button"
                onClick={() => void handlePublish(contextPublishKey)}
                disabled={
                  publishing ||
                  loggingOut ||
                  rollingBack ||
                  unsaved.isDirty ||
                  contextIsCurrent
                }
                title={unsaved.isDirty ? unsavedTitle : undefined}
              >
                {publishingKey === contextPublishKey ||
                (contextPublishKey === 'all' && publishingKey === 'all')
                  ? '发布中…'
                  : unsaved.isDirty
                    ? '请先保存'
                    : contextIsCurrent
                      ? '当前板块已最新'
                      : modulePublishButtonLabel(
                          contextPublishModule,
                          contextPublishKey,
                        )}
              </button>
            </>
            <span className="environment-badge">
              {expiresAt
                ? `会话至 ${new Date(expiresAt).toLocaleTimeString('zh-CN')}`
                : 'PRODUCTION'}
            </span>
            <button
              className="secondary-button"
              type="button"
              onClick={requestLogout}
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
        {logoutError ? (
          <div className="notice notice-error" role="alert">
            {logoutError}
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

        <Suspense
          fallback={
            <div className="notice" role="status" aria-live="polite">
              正在加载当前模块…
            </div>
          }
        >
          {activeView === 'settings' ? (
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
          ) : null}
        </Suspense>

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
                <button
                  type="button"
                  aria-label="关闭"
                  disabled={rollingBack}
                  onClick={() => setRollbackTarget(null)}
                >
                  ×
                </button>
              </div>
              <p className="delete-warning">
                只会切换该板块的 R2 版本；其他板块和后台当前数据都不会改变。
              </p>
              <div className="admin-dialog-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={rollingBack}
                  onClick={() => setRollbackTarget(null)}
                >
                  取消
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={rollingBack}
                  onClick={() => void handleRollback()}
                >
                  {rollingBack ? '正在回退…' : '确认回退'}
                </button>
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
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setPendingDiscardAction(null)}
                >
                  继续编辑
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={confirmDiscardAndContinue}
                >
                  {pendingDiscardAction.kind === 'logout'
                    ? '放弃修改并退出'
                    : '放弃修改并切换'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
