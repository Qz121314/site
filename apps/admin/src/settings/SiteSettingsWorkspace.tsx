import { lazy, Suspense } from 'react';
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
const SystemGeneralView = lazy(() =>
  import('../system/SystemGeneralView').then((module) => ({
    default: module.SystemGeneralView,
  })),
);
const SystemInfrastructureView = lazy(() =>
  import('../system/SystemInfrastructureView').then((module) => ({
    default: module.SystemInfrastructureView,
  })),
);
const SystemAdvancedView = lazy(() =>
  import('../system/SystemAdvancedView').then((module) => ({
    default: module.SystemAdvancedView,
  })),
);

type SiteSettingsWorkspaceProps = {
  view: SettingsAdminView;
  sections: AdminSection[];
  onNavigate: (view: AdminView) => void;
  onSessionExpired: () => void;
};

export function SiteSettingsWorkspace({
  view,
  sections,
  onNavigate,
  onSessionExpired,
}: SiteSettingsWorkspaceProps) {
  return (
    <SiteSettingsProvider onSessionExpired={onSessionExpired}>
      <Suspense
        fallback={
          <AdminFeedbackState
            kind="loading"
            title="正在加载设置工作区"
            compact
          />
        }
      >
        {view === 'home' ? (
          <HomeExperienceView sections={sections} onSessionExpired={onSessionExpired} />
        ) : view === 'navigation' ? (
          <NavigationSettingsView onSessionExpired={onSessionExpired} />
        ) : view === 'messages' ? (
          <MessagesExperienceView onNavigate={onNavigate} />
        ) : view === 'pwa' ? (
          <PwaSettingsView onSessionExpired={onSessionExpired} />
        ) : view === 'system-general' ? (
          <SystemGeneralView onSessionExpired={onSessionExpired} />
        ) : view === 'system-infrastructure' ? (
          <SystemInfrastructureView onSessionExpired={onSessionExpired} />
        ) : (
          <SystemAdvancedView onSessionExpired={onSessionExpired} />
        )}
      </Suspense>
    </SiteSettingsProvider>
  );
}
