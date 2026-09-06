import { ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  ADMIN_DOMAINS,
  getAdminSecondaryItems,
  type AdminDomain,
  type AdminView,
} from '../admin-navigation';
import type { AdminSection } from '../api';

type AdminSecondarySidebarProps = {
  activeDomain: AdminDomain;
  activeView: AdminView;
  sections: AdminSection[];
  onNavigate: (view: AdminView) => void;
  onItemSelected?: () => void;
};

export function AdminSecondarySidebar({
  activeDomain,
  activeView,
  sections,
  onNavigate,
  onItemSelected,
}: AdminSecondarySidebarProps) {
  const domain = ADMIN_DOMAINS.find((item) => item.id === activeDomain);
  const items = getAdminSecondaryItems(activeDomain, sections);
  let previousGroup: string | undefined;

  return (
    <aside className="admin-secondary-sidebar" aria-label="后台二级导航">
      <div className="admin-secondary-heading">
        <span>Workspace</span>
        <h2>{domain?.label ?? '管理'}</h2>
        <p>{domain?.description}</p>
      </div>
      <nav className="admin-secondary-nav" aria-label={`${domain?.label ?? '管理'}二级导航`}>
        {items.length === 0 ? (
          <p className="admin-secondary-empty">当前没有可用入口。</p>
        ) : (
          items.map((item) => {
            const showGroup = item.group && item.group !== previousGroup;
            previousGroup = item.group;
            const active = item.view === activeView;
            return (
              <div className="admin-secondary-item" key={item.view}>
                {showGroup ? <div className="admin-secondary-group">{item.group}</div> : null}
                <Button
                  className={`admin-secondary-link${active ? ' is-active' : ''}`}
                  variant="ghost"
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    onNavigate(item.view);
                    onItemSelected?.();
                  }}
                >
                  <span>{item.label}</span>
                  <ChevronRight aria-hidden="true" size={15} strokeWidth={1.8} />
                </Button>
              </div>
            );
          })
        )}
      </nav>
    </aside>
  );
}
