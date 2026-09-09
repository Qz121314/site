import {
  Boxes,
  ChevronDown,
  FileText,
  Gauge,
  GripVertical,
  LogOut,
  Megaphone,
  MessageSquare,
  PanelTop,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { brandingAssetPreviewUrl } from '../branding-media/api';
import {
  getAdminDefaultViewForDomain,
  type AdminDomain,
  type AdminView,
} from '../admin-navigation';
import {
  orderedAdminDomains,
  orderedAdminSecondaryItems,
  type AdminNavigationPreferences,
} from '../admin-navigation-preferences';
import type { AdminSection } from '../api';

const DOMAIN_ICONS: Record<AdminDomain, LucideIcon> = {
  dashboard: Gauge,
  catalog: Boxes,
  site: PanelTop,
  content: FileText,
  operations: Megaphone,
  engagement: MessageSquare,
  system: Settings2,
};

const DEFAULT_PWA_ICON_URL = import.meta.env.DEV
  ? 'https://www.erosdoor.com/api/public/pwa/icon/192'
  : '/api/public/pwa/icon/192';

type AdminPrimarySidebarProps = {
  activeDomain: AdminDomain;
  activeView: AdminView;
  sections: AdminSection[];
  onNavigate: (view: AdminView) => void;
  onDomainSelected?: () => void;
  onItemSelected?: () => void;
  navigationPreferences: AdminNavigationPreferences;
  onNavigationPreferencesChange: (value: AdminNavigationPreferences) => void;
  navigationOrdering?: boolean;
  onLogout: () => void;
  loggingOut: boolean;
  logoutDisabled?: boolean;
  collapsed?: boolean;
  pwaIconAssetId?: string | null;
};

export function AdminPrimarySidebar({
  activeDomain,
  activeView,
  sections,
  onNavigate,
  onDomainSelected,
  onItemSelected,
  navigationPreferences,
  onNavigationPreferencesChange,
  navigationOrdering = false,
  onLogout,
  loggingOut,
  logoutDisabled = false,
  collapsed = false,
  pwaIconAssetId = null,
}: AdminPrimarySidebarProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const domains = orderedAdminDomains(navigationPreferences);

  function move<T>(items: readonly T[], from: number, to: number): T[] {
    if (from < 0 || to < 0 || from === to || to >= items.length) return [...items];
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item as T);
    return next;
  }

  function moveDomain(target: AdminDomain) {
    if (!dragging?.startsWith('primary:')) return;
    const source = dragging.slice('primary:'.length) as AdminDomain;
    const ordered = domains.map((item) => item.id);
    onNavigationPreferencesChange({
      ...navigationPreferences,
      primary: move(ordered, ordered.indexOf(source), ordered.indexOf(target)),
    });
  }

  function moveSecondary(domain: AdminDomain, target: AdminView) {
    const prefix = `secondary:${domain}:`;
    if (!dragging?.startsWith(prefix)) return;
    const source = dragging.slice(prefix.length) as AdminView;
    const ordered = orderedAdminSecondaryItems(
      domain,
      sections,
      navigationPreferences,
    ).map((item) => item.view);
    onNavigationPreferencesChange({
      ...navigationPreferences,
      secondary: {
        ...navigationPreferences.secondary,
        [domain]: move(ordered, ordered.indexOf(source), ordered.indexOf(target)),
      },
    });
  }

  return (
    <aside
      className={`admin-primary-sidebar${collapsed ? ' is-collapsed' : ''}`}
      aria-label="后台一级导航"
    >
      <div className="admin-brand">
        <span>
          <img
            src={
              pwaIconAssetId
                ? brandingAssetPreviewUrl(pwaIconAssetId)
                : DEFAULT_PWA_ICON_URL
            }
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </span>
        <strong>业务运营后台</strong>
      </div>
      <nav className="admin-primary-nav" aria-label="管理业务域">
        {domains.map((domain) => {
          const Icon = DOMAIN_ICONS[domain.id];
          const defaultView = getAdminDefaultViewForDomain(domain.id, sections);
          const active = activeDomain === domain.id;
          const expandable = active && domain.id !== 'dashboard';
          const items = expandable
            ? orderedAdminSecondaryItems(domain.id, sections, navigationPreferences)
            : [];
          const visibleItems =
            domain.id === 'catalog'
              ? items.filter((item) => item.view === 'sections' || item.group)
              : items;
          return (
            <div
              className={`admin-nav-domain${navigationOrdering ? ' is-ordering' : ''}`}
              draggable={navigationOrdering}
              key={domain.id}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => {
                if (!navigationOrdering || !dragging?.startsWith('primary:')) return;
                event.preventDefault();
              }}
              onDragStart={(event) => {
                if (!navigationOrdering) return;
                event.dataTransfer.effectAllowed = 'move';
                setDragging(`primary:${domain.id}`);
              }}
              onDrop={(event) => {
                if (!navigationOrdering || !dragging?.startsWith('primary:')) return;
                event.preventDefault();
                moveDomain(domain.id);
                setDragging(null);
              }}
            >
              <Button
                className={`admin-primary-link${active ? ' is-active' : ''}`}
                variant="ghost"
                type="button"
                disabled={!defaultView}
                aria-current={active ? 'location' : undefined}
                aria-label={
                  defaultView ? domain.label : `${domain.label}（暂无可用分区）`
                }
                onClick={() => {
                  if (!defaultView || navigationOrdering) return;
                  onNavigate(defaultView);
                  onDomainSelected?.();
                }}
              >
                {navigationOrdering ? (
                  <GripVertical
                    className="admin-nav-drag-handle"
                    aria-hidden="true"
                    size={14}
                  />
                ) : null}
                <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
                <span>{domain.label}</span>
                {expandable ? (
                  <ChevronDown
                    className="admin-nav-chevron"
                    aria-hidden="true"
                    size={14}
                  />
                ) : null}
              </Button>
              {!collapsed && expandable && visibleItems.length > 0 ? (
                <div className="admin-nav-subitems">
                  {visibleItems.map((item) => {
                    const isSelected = item.view === activeView;
                    const label =
                      domain.id === 'catalog' && item.view !== 'sections' && item.group
                        ? item.group
                        : item.label;
                    const actualTarget = item.view;
                    return (
                      <Button
                        key={`${item.view}-${item.group ?? ''}`}
                        className={`admin-subnav-link${isSelected ? ' is-active' : ''}`}
                        variant="ghost"
                        type="button"
                        aria-current={isSelected ? 'page' : undefined}
                        draggable={navigationOrdering}
                        onDragEnd={() => setDragging(null)}
                        onDragOver={(event) => {
                          if (
                            !navigationOrdering ||
                            !dragging?.startsWith(`secondary:${domain.id}:`)
                          ) {
                            return;
                          }
                          event.preventDefault();
                        }}
                        onDragStart={(event) => {
                          if (!navigationOrdering) return;
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = 'move';
                          setDragging(`secondary:${domain.id}:${item.view}`);
                        }}
                        onDrop={(event) => {
                          if (
                            !navigationOrdering ||
                            !dragging?.startsWith(`secondary:${domain.id}:`)
                          ) {
                            return;
                          }
                          event.preventDefault();
                          event.stopPropagation();
                          moveSecondary(domain.id, item.view);
                          setDragging(null);
                        }}
                        onClick={() => {
                          if (navigationOrdering) return;
                          onNavigate(actualTarget);
                          onItemSelected?.();
                        }}
                      >
                        {navigationOrdering ? (
                          <GripVertical
                            className="admin-subnav-drag-handle"
                            aria-hidden="true"
                            size={13}
                          />
                        ) : null}
                        <span className="admin-subnav-dot" aria-hidden="true" />
                        <span>{label}</span>
                      </Button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="admin-primary-account">
        <Button
          className="admin-primary-logout"
          variant="ghost"
          type="button"
          onClick={onLogout}
          disabled={loggingOut || logoutDisabled}
        >
          <LogOut aria-hidden="true" size={17} strokeWidth={1.8} />
          <span>{loggingOut ? '正在退出…' : '退出登录'}</span>
        </Button>
      </div>
    </aside>
  );
}
