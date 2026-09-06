import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { FileText } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import {
  getMessageArticleReadSnapshot,
  subscribeMessageArticleReadState,
  type MessageArticleMetadata,
} from './messages-articles';
import { articleHref } from './routing';

export function MessagesArticleList({
  articles,
  LinkComponent = 'a',
}: {
  articles: MessageArticleMetadata[];
  LinkComponent?: StorefrontLinkComponent;
}) {
  const readSnapshot = useSyncExternalStore(
    subscribeMessageArticleReadState,
    getMessageArticleReadSnapshot,
    () => '[]',
  );
  const readIds = new Set<string>(JSON.parse(readSnapshot));

  if (articles.length === 0) return null;

  return (
    <section className="messages-article-list" aria-label="Articles">
      {articles.map((article) => {
        const unread = !readIds.has(article.articleId);
        return (
          <LinkComponent
            aria-label={`${unread ? 'Unread article' : 'Article'}: ${article.title}`}
            className={`messages-article-row${unread ? ' is-unread' : ''}`}
            href={articleHref(article.articleId)}
            key={article.articleId}
          >
            <span className="messages-article-icon" aria-hidden="true">
              <FileText />
            </span>
            <span className="messages-article-copy">
              <strong>{article.title}</strong>
              <span>{article.preview}</span>
            </span>
            <span className="messages-article-status">
              {unread ? (
                <>
                  <span className="messages-article-unread-dot" aria-hidden="true" />
                  <span className="sr-only">Unread article</span>
                </>
              ) : null}
            </span>
          </LinkComponent>
        );
      })}
    </section>
  );
}
