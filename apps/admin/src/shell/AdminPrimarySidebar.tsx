import {
  Boxes,
  ChevronDown,
  FileText,
  Gauge,
  LogOut,
  Megaphone,
  MessageSquare,
  PanelTop,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { brandingAssetPreviewUrl } from '../branding-media/api';
import {
  getAdminDefaultViewForDomain,
  getAdminSecondaryItems,
  type AdminDomain,
  type AdminView,
} from '../admin-navigation';
import {
  orderedAdminDomains,
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

type AdminPrimarySidebarProps = {
  activeDomain: AdminDomain;
  activeView: AdminView;
  sections: AdminSection[];
  onNavigate: (view: AdminView) => void;
  onDomainSelected?: () => void;
  onItemSelected?: () => void;
  navigationPreferences: AdminNavigationPreferences;
  onLogout: () => void;
  loggingOut: boolean;
  logoutDisabled?: boolean;
  collapsed?: boolean;
  logoAssetId?: string | null;
};

export function AdminPrimarySidebar({
  activeDomain,
  activeView,
  sections,
  onNavigate,
  onDomainSelected,
  onItemSelected,
  navigationPreferences,
  onLogout,
  loggingOut,
  logoutDisabled = false,
  collapsed = false,
  logoAssetId = null,
}: AdminPrimarySidebarProps) {
  return (
    <aside
      className={`admin-primary-sidebar${collapsed ? ' is-collapsed' : ''}`}
      aria-label="后台一级导航"
    >
      <div className="admin-brand">
        <span>
          {logoAssetId ? (
            <img
              src={brandingAssetPreviewUrl(logoAssetId)}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            'SP'
          )}
        </span>
        <strong>业务运营后台</strong>
      </div>
      <nav className="admin-primary-nav" aria-label="管理业务域">
        {orderedAdminDomains(navigationPreferences).map((domain) => {
          const Icon = DOMAIN_ICONS[domain.id];
          const defaultView = getAdminDefaultViewForDomain(domain.id, sections);
          const active = activeDomain === domain.id;
          const expandable = active && domain.id !== 'dashboard';
          const items = expandable ? getAdminSecondaryItems(domain.id, sections) : [];
          const visibleItems =
            domain.id === 'catalog'
              ? items.filter((item) => item.view === 'sections' || item.group)
              : items;
          return (
            <div className="admin-nav-domain" key={domain.id}>
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
                  if (!defaultView) return;
                  onNavigate(defaultView);
                  onDomainSelected?.();
                }}
              >
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
                        onClick={() => {
                          onNavigate(actualTarget);
                          onItemSelected?.();
                        }}
                      >
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
