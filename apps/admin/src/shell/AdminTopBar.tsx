import { Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../components/ui/button';

type AdminTopBarProps = {
  context: ReactNode;
  actions?: ReactNode;
  onOpenNavigation: () => void;
};

export function AdminTopBar({ context, actions, onOpenNavigation }: AdminTopBarProps) {
  return (
    <header className="admin-top-bar">
      <div className="admin-top-bar-context">
        <Button
          className="admin-mobile-nav-trigger"
          variant="ghost"
          size="icon"
          type="button"
          aria-label="打开后台导航"
          onClick={onOpenNavigation}
        >
          <Menu aria-hidden="true" size={20} />
        </Button>
        <div>{context}</div>
      </div>
      {actions ? <div className="admin-top-bar-actions">{actions}</div> : null}
    </header>
  );
}
