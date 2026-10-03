import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { MessageCircle } from 'lucide-react';
import { MessagesArticleList } from './MessagesArticleList';
import type { MessageArticleMetadata } from './messages-articles';
import { MessagesPageContent } from './support-ui';
import type { SupportConversationSummary } from './support-contract';

export function MessagesArticleListWorkspace({
  articles,
  conversations,
  mediaBaseUrl,
  supportAvailable,
  LinkComponent,
}: {
  articles: MessageArticleMetadata[];
  conversations: SupportConversationSummary[];
  mediaBaseUrl: string;
  supportAvailable: boolean | null;
  LinkComponent: StorefrontLinkComponent;
}) {
  return (
    <section className="messages-workspace messages-article-workspace">
      <aside className="messages-sidebar">
        <div className="messages-native-list" data-messages-list="conversation-flow">
          <MessagesArticleList
            articles={articles}
            LinkComponent={LinkComponent}
            mediaBaseUrl={mediaBaseUrl}
          />
          <MessagesPageContent
            conversations={conversations}
            LinkComponent={LinkComponent}
            supportAvailable={supportAvailable}
          />
        </div>
      </aside>
      <div className="messages-detail">
        <div className="messages-detail-placeholder" aria-hidden="true">
          <MessageCircle />
        </div>
      </div>
    </section>
  );
}
