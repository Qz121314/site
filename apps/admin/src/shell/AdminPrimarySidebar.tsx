import {
  Boxes,
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
import {
  getAdminDefaultViewForDomain,
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
  sections: AdminSection[];
  onNavigate: (view: AdminView) => void;
  onDomainSelected?: () => void;
  navigationPreferences: AdminNavigationPreferences;
  onLogout: () => void;
  loggingOut: boolean;
  logoutDisabled?: boolean;
};

export function AdminPrimarySidebar({
  activeDomain,
  sections,
  onNavigate,
  onDomainSelected,
  navigationPreferences,
  onLogout,
  loggingOut,
  logoutDisabled = false,
}: AdminPrimarySidebarProps) {
  return (
    <aside className="admin-primary-sidebar" aria-label="后台一级导航">
      <div className="admin-brand">
        <span>SP</span>
        <strong>业务运营后台</strong>
      </div>
      <nav className="admin-primary-nav" aria-label="管理业务域">
        {orderedAdminDomains(navigationPreferences).map((domain) => {
          const Icon = DOMAIN_ICONS[domain.id];
          const defaultView = getAdminDefaultViewForDomain(domain.id, sections);
          const active = activeDomain === domain.id;
          return (
            <Button
              key={domain.id}
              className={`admin-primary-link${active ? ' is-active' : ''}`}
              variant="ghost"
              type="button"
              disabled={!defaultView}
              aria-current={active ? 'location' : undefined}
              aria-label={defaultView ? domain.label : `${domain.label}（暂无可用分区）`}
              onClick={() => {
                if (!defaultView) return;
                onNavigate(defaultView);
                onDomainSelected?.();
              }}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{domain.label}</span>
            </Button>
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
