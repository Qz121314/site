import type { ReactNode } from 'react';
import type { AdminView } from '../admin-navigation';
import './experience-settings.css';
import { MessagesArticlesSection } from './messages-articles/MessagesArticlesSection';

export function MessagesExperienceView({
  onNavigate,
  onActionsChange,
}: {
  onNavigate: (view: AdminView) => void;
  onActionsChange: (actions: ReactNode | null) => void;
}) {
  return (
    <MessagesArticlesSection onNavigate={onNavigate} onActionsChange={onActionsChange} />
  );
}
