import { useState, type FormEvent, type ReactNode } from 'react';
import type { AdminView } from '../admin-navigation';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { useAdminDirtySource } from '../admin-unsaved-state';
import { toSiteSettingsUpdateInput } from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import './experience-settings.css';
import { MessagesArticlesSection } from './messages-articles/MessagesArticlesSection';

function ConnectingMessageSettings({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState(settings.messagesConnectingText);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const dirty = draft.trim() !== settings.messagesConnectingText;

  useAdminDirtySource('messages-connecting-copy', '会话连接提示', dirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await saveSettings({
        ...toSiteSettingsUpdateInput(settings),
        messagesConnectingText: draft.trim(),
      });
      setDraft(updated.messagesConnectingText);
      setFeedback({ type: 'success', text: '会话连接提示已保存。' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('SESSION')) onSessionExpired();
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : '会话连接提示保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="messages-connecting-settings" onSubmit={handleSubmit}>
      <div className="messages-connecting-settings-copy">
        <h2>会话连接提示</h2>
        <p>全站共用。访客发起新会话、客服接入前会显示这条提示；留空则不显示。</p>
      </div>
      <label className="messages-connecting-settings-field">
        <span>连接中显示文案</span>
        <Textarea
          value={draft}
          maxLength={200}
          rows={2}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="留空则不显示"
        />
        <span className="messages-connecting-settings-count">{draft.length}/200</span>
      </label>
      <div className="messages-connecting-settings-actions">
        {feedback ? (
          <p
            className={`settings-workspace-status is-${feedback.type}`}
            role={feedback.type === 'error' ? 'alert' : 'status'}
          >
            {feedback.text}
          </p>
        ) : null}
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? '保存中…' : '保存提示文案'}
        </Button>
      </div>
    </form>
  );
}

export function MessagesExperienceView({
  onNavigate,
  onActionsChange,
  onSessionExpired,
}: {
  onNavigate: (view: AdminView) => void;
  onActionsChange: (actions: ReactNode | null) => void;
  onSessionExpired: () => void;
}) {
  return (
    <div className="messages-experience-workspace">
      <ConnectingMessageSettings onSessionExpired={onSessionExpired} />
      <MessagesArticlesSection
        onNavigate={onNavigate}
        onActionsChange={onActionsChange}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
