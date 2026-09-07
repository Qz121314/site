import {
  Boxes,
  FileText,
  Gauge,
  Megaphone,
  MessageSquare,
  PanelTop,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  ADMIN_DOMAINS,
  getAdminDefaultViewForDomain,
  type AdminDomain,
  type AdminView,
} from '../admin-navigation';
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
};

export function AdminPrimarySidebar({
  activeDomain,
  sections,
  onNavigate,
  onDomainSelected,
}: AdminPrimarySidebarProps) {
  return (
    <aside className="admin-primary-sidebar" aria-label="后台一级导航">
      <div className="admin-brand">
        <span>SP</span>
        <strong>业务运营后台</strong>
      </div>
      <nav className="admin-primary-nav" aria-label="管理业务域">
        {ADMIN_DOMAINS.map((domain) => {
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
    </aside>
  );
}
