import { X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Button } from '../components/ui/button';
import {
  getAdminDomainForView,
  type AdminView,
  type AdminViewContext,
} from '../admin-navigation';
import type { AdminSection } from '../api';
import { AdminPageHeader } from './AdminPageHeader';
import { AdminPrimarySidebar } from './AdminPrimarySidebar';
import { AdminSecondarySidebar } from './AdminSecondarySidebar';
import { AdminTopBar } from './AdminTopBar';
import { AdminWorkspace } from './AdminWorkspace';

type AdminShellProps = {
  activeView: AdminView;
  sections: AdminSection[];
  context: AdminViewContext;
  onNavigate: (view: AdminView) => void;
  topBarActions?: ReactNode;
  pageStatus?: ReactNode;
  pagePrimaryAction?: ReactNode;
  pageSecondaryAction?: ReactNode;
  children: ReactNode;
};

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AdminShell({
  activeView,
  sections,
  context,
  onNavigate,
  topBarActions,
  pageStatus,
  pagePrimaryAction,
  pageSecondaryAction,
  children,
}: AdminShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const activeDomain = getAdminDomainForView(activeView);

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
      document
        .querySelector<HTMLElement>('.admin-mobile-nav-trigger')
        ?.focus();
    };
  }, [navigationOpen]);

  function handleDrawerBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) setNavigationOpen(false);
  }

  return (
    <div className="admin-shell">
      <div className="admin-desktop-primary">
        <AdminPrimarySidebar
          activeDomain={activeDomain}
          sections={sections}
          onNavigate={onNavigate}
        />
      </div>
      <div className="admin-desktop-secondary">
        <AdminSecondarySidebar
          activeDomain={activeDomain}
          activeView={activeView}
          sections={sections}
          onNavigate={onNavigate}
        />
      </div>

      <div className="admin-shell-workspace">
        <AdminTopBar
          context={
            <>
              <span>{context.eyebrow}</span>
              <strong>{context.title}</strong>
            </>
          }
          actions={topBarActions}
          onOpenNavigation={() => setNavigationOpen(true)}
        />
        <main className="admin-main">
          <AdminPageHeader
            eyebrow={context.eyebrow}
            title={context.title}
            description={context.description}
            status={pageStatus}
            primaryAction={pagePrimaryAction}
            secondaryAction={pageSecondaryAction}
          />
          <AdminWorkspace>{children}</AdminWorkspace>
        </main>
      </div>

      {navigationOpen ? (
        <div
          className="admin-mobile-drawer-backdrop"
          role="presentation"
          onMouseDown={handleDrawerBackdrop}
        >
          <div
            ref={drawerRef}
            className="admin-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="后台导航"
          >
            <div className="admin-mobile-drawer-header">
              <div>
                <span>Navigation</span>
                <strong>后台导航</strong>
              </div>
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
            <div className="admin-mobile-drawer-content">
              <AdminPrimarySidebar
                activeDomain={activeDomain}
                sections={sections}
                onNavigate={onNavigate}
              />
              <AdminSecondarySidebar
                activeDomain={activeDomain}
                activeView={activeView}
                sections={sections}
                onNavigate={onNavigate}
                onItemSelected={() => setNavigationOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
