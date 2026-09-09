import { ListOrdered, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  getCatalogWorkspaceContext,
  getAdminDomainForView,
  type AdminView,
  type AdminViewContext,
} from '../admin-navigation';
import {
  orderedAdminSecondaryItems,
  type AdminNavigationPreferences,
} from '../admin-navigation-preferences';
import type { AdminSection } from '../api';
import { CatalogWorkspaceSwitcher } from '../catalog/CatalogWorkspaceSwitcher';
import { Button } from '../components/ui/button';
import { AdminPrimarySidebar } from './AdminPrimarySidebar';
import { AdminWorkspace } from './AdminWorkspace';

type AdminShellProps = {
  activeView: AdminView;
  sections: AdminSection[];
  context: AdminViewContext;
  onNavigate: (view: AdminView) => void;
  workspaceActions?: ReactNode;
  pageStatus?: ReactNode;
  pagePrimaryAction?: ReactNode;
  pageSecondaryAction?: ReactNode;
  workspaceWidth?: 'narrow' | 'medium' | 'wide' | 'split-pane';
  children: ReactNode;
  navigationPreferences: AdminNavigationPreferences;
  onNavigationPreferencesChange: (value: AdminNavigationPreferences) => void;
  onLogout: () => void;
  loggingOut: boolean;
  logoutDisabled?: boolean;
  sessionExpiresAt?: string | undefined;
  pwaIconAssetId?: string | null;
};

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const SESSION_WARNING_MS = 5 * 60 * 1000;

export function AdminShell({
  activeView,
  sections,
  context,
  onNavigate,
  workspaceActions,
  pageStatus,
  pagePrimaryAction,
  pageSecondaryAction,
  workspaceWidth = 'wide',
  children,
  navigationPreferences,
  onNavigationPreferencesChange,
  onLogout,
  loggingOut,
  logoutDisabled = false,
  sessionExpiresAt,
  pwaIconAssetId = null,
}: AdminShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navigationOrdering, setNavigationOrdering] = useState(false);
  const [sessionExpiring, setSessionExpiring] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const activeDomain = getAdminDomainForView(activeView);
  const catalogContext = getCatalogWorkspaceContext(activeView);
  const catalogSection = catalogContext
    ? sections.find((section) => section.id === catalogContext.sectionId)
    : null;
  const hasWorkspaceToolbar = Boolean(
    workspaceActions || pageStatus || pagePrimaryAction || pageSecondaryAction,
  );
  const collapsedSecondaryItems = sidebarCollapsed
    ? orderedAdminSecondaryItems(activeDomain, sections, navigationPreferences)
    : [];
  const visibleCollapsedSecondaryItems =
    activeDomain === 'catalog'
      ? collapsedSecondaryItems.filter((item) => item.view === 'sections' || item.group)
      : collapsedSecondaryItems;

  useEffect(() => {
    if (!sessionExpiresAt) {
      setSessionExpiring(false);
      return;
    }

    const expiresAtMs = Date.parse(sessionExpiresAt);
    if (Number.isNaN(expiresAtMs)) {
      setSessionExpiring(false);
      return;
    }

    const remainingMs = expiresAtMs - Date.now();
    if (remainingMs <= SESSION_WARNING_MS) {
      setSessionExpiring(remainingMs > 0);
      return;
    }

    setSessionExpiring(false);
    const warningTimer = window.setTimeout(
      () => setSessionExpiring(true),
      remainingMs - SESSION_WARNING_MS,
    );
    return () => window.clearTimeout(warningTimer);
  }, [sessionExpiresAt]);

  useEffect(() => {
    if (!navigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setNavigationOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !drawer) return;

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      drawerTriggerRef.current?.focus();
    };
  }, [navigationOpen]);

  function openNavigation() {
    drawerTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNavigationOpen(true);
  }

  function handleDrawerBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) setNavigationOpen(false);
  }

  return (
    <div className={`admin-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <div className="admin-desktop-primary">
        <AdminPrimarySidebar
          activeDomain={activeDomain}
          activeView={activeView}
          sections={sections}
          onNavigate={onNavigate}
          navigationPreferences={navigationPreferences}
          onNavigationPreferencesChange={onNavigationPreferencesChange}
          navigationOrdering={navigationOrdering}
          onLogout={onLogout}
          loggingOut={loggingOut}
          logoutDisabled={logoutDisabled}
          collapsed={sidebarCollapsed}
          pwaIconAssetId={pwaIconAssetId}
        />
      </div>

      <div className="admin-shell-workspace">
        <Button
          className="admin-mobile-nav-trigger"
          variant="secondary"
          size="icon"
          type="button"
          aria-label="打开后台导航"
          onClick={openNavigation}
        >
          <Menu aria-hidden="true" size={18} />
        </Button>
        <header className="admin-topbar">
          <Button
            className="admin-sidebar-toggle"
            variant="ghost"
            size="icon"
            type="button"
            aria-label={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            onClick={() => {
              setSidebarCollapsed((current) => !current);
              setNavigationOrdering(false);
            }}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" size={17} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={17} />
            )}
          </Button>
          <Button
            className={`admin-navigation-order-toggle${navigationOrdering ? ' is-active' : ''}`}
            variant="ghost"
            size="icon"
            type="button"
            aria-label={navigationOrdering ? '完成菜单排序' : '开启菜单拖拽排序'}
            aria-pressed={navigationOrdering}
            title={navigationOrdering ? '完成排序' : '拖拽排序'}
            onClick={() => {
              setNavigationOrdering((current) => {
                const next = !current;
                if (next) setSidebarCollapsed(false);
                return next;
              });
            }}
          >
            <ListOrdered aria-hidden="true" size={16} />
          </Button>
          <div className="admin-breadcrumb">
            <span>{context.eyebrow}</span>
            <span aria-hidden="true">/</span>
            <strong>{context.title}</strong>
          </div>
          <div className="admin-command-search" role="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="搜索功能、页面或内容"
              placeholder="搜索功能、页面或内容…"
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="admin-topbar-meta" aria-label="账户操作">
            <span aria-hidden="true">♧</span>
            <span className="admin-avatar" aria-hidden="true">
              Q
            </span>
          </div>
        </header>
        {sessionExpiring ? (
          <div className="admin-session-warning" role="status" aria-live="polite">
            登录会话即将过期，请保存当前修改。
          </div>
        ) : null}
        <main className="admin-main">
          <h1 className="admin-visually-hidden">{context.title}</h1>
          <AdminWorkspace width={workspaceWidth}>
            {sidebarCollapsed &&
            activeDomain !== 'dashboard' &&
            visibleCollapsedSecondaryItems.length > 0 ? (
              <nav
                className="admin-collapsed-secondary-nav"
                aria-label={`${context.eyebrow}二级导航`}
              >
                <span className="admin-collapsed-secondary-label">{context.eyebrow}</span>
                <div className="admin-collapsed-secondary-items">
                  {visibleCollapsedSecondaryItems.map((item) => {
                    const label =
                      activeDomain === 'catalog' && item.view !== 'sections' && item.group
                        ? item.group
                        : item.label;
                    return (
                      <Button
                        className={`admin-collapsed-secondary-link${item.view === activeView ? ' is-active' : ''}`}
                        key={`${item.view}-${item.group ?? ''}`}
                        variant="ghost"
                        type="button"
                        aria-current={item.view === activeView ? 'page' : undefined}
                        onClick={() => onNavigate(item.view)}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </nav>
            ) : null}
            {catalogContext ? (
              <CatalogWorkspaceSwitcher
                activeView={activeView}
                sectionName={catalogSection?.name ?? catalogContext.sectionId}
                onNavigate={onNavigate}
              />
            ) : null}
            {hasWorkspaceToolbar ? (
              <div className="admin-workspace-toolbar" aria-label="当前工作区操作">
                {pageStatus ? (
                  <div className="admin-workspace-status">{pageStatus}</div>
                ) : null}
                <div className="admin-workspace-actions">
                  {pageSecondaryAction}
                  {pagePrimaryAction}
                  {workspaceActions}
                </div>
              </div>
            ) : null}
            {children}
          </AdminWorkspace>
        </main>
      </div>

      {navigationOpen ? (
        <div
          className="admin-mobile-drawer-backdrop ui-drawer-backdrop"
          role="presentation"
          onMouseDown={handleDrawerBackdrop}
        >
          <div
            ref={drawerRef}
            className="admin-mobile-drawer ui-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="后台导航"
          >
            <div className="admin-mobile-drawer-header ui-drawer-header">
              <strong>后台导航</strong>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="关闭后台导航"
                onClick={() => setNavigationOpen(false)}
              >
                <X aria-hidden="true" size={20} />
              </Button>
            </div>
            <div className="admin-mobile-drawer-content ui-drawer-body">
              <AdminPrimarySidebar
                activeDomain={activeDomain}
                activeView={activeView}
                sections={sections}
                onNavigate={onNavigate}
                navigationPreferences={navigationPreferences}
                onNavigationPreferencesChange={onNavigationPreferencesChange}
                onLogout={onLogout}
                loggingOut={loggingOut}
                logoutDisabled={logoutDisabled}
                pwaIconAssetId={pwaIconAssetId}
                onItemSelected={() => setNavigationOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
