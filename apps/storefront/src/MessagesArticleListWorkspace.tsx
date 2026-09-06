import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { MessageCircle } from 'lucide-react';
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
  return (
    <section className="messages-workspace messages-article-workspace">
      <aside className="messages-sidebar">
        <MessagesArticleList articles={articles} LinkComponent={LinkComponent} />
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
