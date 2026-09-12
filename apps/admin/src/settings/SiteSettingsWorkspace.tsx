import { lazy, Suspense, type ReactNode } from 'react';
import type { AdminSection } from '../api';
import type { AdminView, SettingsAdminView } from '../admin-navigation';
import { AdminFeedbackState } from '../components/ui/feedback-state';
import { SiteSettingsProvider } from './SiteSettingsProvider';
import './settings-workspace.css';

const HomeExperienceView = lazy(() =>
  import('../experience/HomeExperienceView').then((module) => ({
    default: module.HomeExperienceView,
  })),
);
const LayoutCenterView = lazy(() =>
  import('../experience/LayoutCenterView').then((module) => ({
    default: module.LayoutCenterView,
  })),
);
const NavigationSettingsView = lazy(() =>
  import('../experience/NavigationSettingsView').then((module) => ({
    default: module.NavigationSettingsView,
  })),
);
const MessagesExperienceView = lazy(() =>
  import('../experience/MessagesExperienceView').then((module) => ({
    default: module.MessagesExperienceView,
  })),
);
const PwaSettingsView = lazy(() =>
  import('../experience/PwaSettingsView').then((module) => ({
    default: module.PwaSettingsView,
  })),
);
const SystemSettingsView = lazy(() =>
  import('../system/SystemSettingsView').then((module) => ({
    default: module.SystemSettingsView,
  })),
);

type SiteSettingsWorkspaceProps = {
  view: SettingsAdminView;
  sections: AdminSection[];
  onNavigate: (view: AdminView) => void;
  onSessionExpired: () => void;
  onMessagesActionsChange: (actions: ReactNode | null) => void;
};

export function SiteSettingsWorkspace({
  view,
  sections,
  onNavigate,
  onSessionExpired,
  onMessagesActionsChange,
}: SiteSettingsWorkspaceProps) {
  return (
    <SiteSettingsProvider onSessionExpired={onSessionExpired}>
      <Suspense
        fallback={
          <AdminFeedbackState kind="loading" title="正在加载设置工作区" compact />
        }
      >
        {view === 'home' ? (
          <HomeExperienceView sections={sections} onSessionExpired={onSessionExpired} />
        ) : view === 'layout' ? (
          <LayoutCenterView onSessionExpired={onSessionExpired} />
        ) : view === 'navigation' ? (
          <NavigationSettingsView onSessionExpired={onSessionExpired} />
        ) : view === 'messages' ? (
          <MessagesExperienceView
            onNavigate={onNavigate}
            onActionsChange={onMessagesActionsChange}
            onSessionExpired={onSessionExpired}
          />
        ) : view === 'pwa' ? (
          <PwaSettingsView onSessionExpired={onSessionExpired} />
        ) : view === 'system-general' ||
          view === 'system-infrastructure' ||
          view === 'system-advanced' ? (
          <SystemSettingsView onSessionExpired={onSessionExpired} />
        ) : null}
      </Suspense>
    </SiteSettingsProvider>
  );
}
