import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useQueryClient } from '@tanstack/react-query';
import type { StorefrontBootstrap } from './content';
import { MessagesArticleList } from './MessagesArticleList';
import type { MessageArticlePlacementMetadata } from './messages-articles';
import { MessagesPageContent } from './support-ui';
import type { SupportConversationSummary } from './support-contract';

export function MessagesArticleListWorkspace({
  articles,
  conversations,
  supportAvailable,
  LinkComponent,
}: {
  articles: MessageArticlePlacementMetadata[];
  conversations: SupportConversationSummary[];
  supportAvailable: boolean | null;
  LinkComponent: StorefrontLinkComponent;
}) {
  const queryClient = useQueryClient();
  const bootstrap = queryClient.getQueryData<StorefrontBootstrap>([
    'storefront-bootstrap',
  ]);
  const mediaBaseUrl = bootstrap?.site.site.mediaBaseUrl ?? '';

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
        <div className="messages-detail-placeholder" aria-hidden="true" />
      </div>
    </section>
  );
}
