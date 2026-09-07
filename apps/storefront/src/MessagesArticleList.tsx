import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { ChevronRight } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { mediaUrl } from './content';
import {
  getMessageArticleReadSnapshot,
  subscribeMessageArticleReadState,
  type MessageArticleMetadata,
} from './messages-articles';
import { ResilientImage } from './ResilientMedia';
import { articleHref } from './routing';
import './messages-articles.css';

function MessagesArticleRow({
  article,
  mediaBaseUrl,
  LinkComponent,
  unread,
}: {
  article: MessageArticleMetadata;
  mediaBaseUrl: string;
  LinkComponent: StorefrontLinkComponent;
  unread: boolean;
}) {
  const backgroundUrl = mediaUrl(mediaBaseUrl, article.backgroundObjectKey);

  return (
    <LinkComponent
      className="messages-article-row"
      data-article-id={article.articleId}
      data-read-state={unread ? 'unread' : 'read'}
      href={articleHref(article.articleId)}
    >
      {backgroundUrl ? (
        <span className="messages-article-row-media" aria-hidden="true">
          <ResilientImage alt="" fallback={null} loading="lazy" src={backgroundUrl} />
        </span>
      ) : null}
      <span className="messages-article-row-copy">
        <span className="sr-only">
          {unread ? 'Unread article. ' : 'Read article. '}
        </span>
        {unread ? (
          <span
            aria-hidden="true"
            className="messages-article-row-unread-dot"
            data-unread-indicator="true"
          />
        ) : null}
        <h3>{article.title}</h3>
      </span>
      <span className="messages-article-row-affordance" aria-hidden="true">
        <ChevronRight />
      </span>
    </LinkComponent>
  );
}

export function MessagesArticleList({
  articles,
  mediaBaseUrl,
  LinkComponent,
}: {
  articles: MessageArticleMetadata[];
  mediaBaseUrl: string;
  LinkComponent: StorefrontLinkComponent;
}) {
  const readSnapshot = useSyncExternalStore(
    subscribeMessageArticleReadState,
    getMessageArticleReadSnapshot,
    () => '[]',
  );
  const readIds = new Set<string>(JSON.parse(readSnapshot));

  if (articles.length === 0) return null;

  return (
    <>
      {articles.map((article) => (
        <MessagesArticleRow
          article={article}
          key={article.articleId}
          LinkComponent={LinkComponent}
          mediaBaseUrl={mediaBaseUrl}
          unread={!readIds.has(article.articleId)}
        />
      ))}
    </>
  );
}
