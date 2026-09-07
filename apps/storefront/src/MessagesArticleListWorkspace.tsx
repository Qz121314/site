import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import type { StorefrontBootstrap } from './content';
import type { SupportConversationSummary } from './support-contract';
import { MessagesArticleList } from './MessagesArticleList';
import type { MessageArticleMetadata } from './messages-articles';
import { MessagesPageContent } from './support-ui';
import './messages-articles.css';

export function MessagesArticleListWorkspace({
  articles,
  conversations,
  LinkComponent = 'a',
  supportAvailable = null,
}: {
  articles: MessageArticleMetadata[];
  conversations: SupportConversationSummary[];
  LinkComponent?: StorefrontLinkComponent;
  supportAvailable?: boolean | null;
}) {
  const queryClient = useQueryClient();
  const bootstrap = queryClient.getQueryData<StorefrontBootstrap>(['storefront-bootstrap']);
  const mediaBaseUrl = bootstrap?.site.site.mediaBaseUrl ?? '';
  const hasArticles = articles.length > 0;

  return (
    <section className="messages-workspace messages-article-workspace">
      <aside className="messages-sidebar">
        <MessagesArticleList
          articles={articles}
          LinkComponent={LinkComponent}
          mediaBaseUrl={mediaBaseUrl}
        />
        {hasArticles ? (
          <div className="messages-conversation-section-label">Conversations</div>
        ) : null}
        <MessagesPageContent
          conversations={conversations}
          LinkComponent={LinkComponent}
          supportAvailable={supportAvailable}
        />
      </aside>
      <div className="messages-detail">
        <div className="messages-detail-placeholder" aria-hidden="true">
          <MessageCircle />
        </div>
      </div>
    </section>
  );
}
