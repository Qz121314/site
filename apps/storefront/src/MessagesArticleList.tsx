import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { ChevronRight } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { mediaUrl } from './content';
import { ResilientImage } from './ResilientMedia';
import {
  articleHref,
  isMessageArticleRead,
  subscribeMessageArticleReadState,
  type MessageArticlePlacementMetadata,
} from './messages-articles';
import './messages-articles.css';

function MessagesArticleRow({
  article,
  mediaBaseUrl,
  LinkComponent,
}: {
  article: MessageArticlePlacementMetadata;
  mediaBaseUrl: string;
  LinkComponent: StorefrontLinkComponent;
}) {
  const read = useSyncExternalStore(
    subscribeMessageArticleReadState,
    () => isMessageArticleRead(article.articleId),
    () => false,
  );
  const backgroundUrl = article.backgroundObjectKey
    ? mediaUrl(mediaBaseUrl, article.backgroundObjectKey)
    : null;

  return (
    <LinkComponent
      className="messages-article-row"
      data-article-id={article.articleId}
      data-read-state={read ? 'read' : 'unread'}
      href={articleHref(article.articleId)}
    >
      {backgroundUrl ? (
        <span className="messages-article-row-media" aria-hidden="true">
          <ResilientImage alt="" fallback={null} loading="lazy" src={backgroundUrl} />
        </span>
      ) : null}
      <span className="messages-article-row-copy">
        <span className="sr-only">{read ? 'Read article.' : 'Unread article.'}</span>
        <span className="messages-article-row-kicker" aria-hidden="true">
          {read ? 'Article' : 'New'}
        </span>
        <h3>{article.title}</h3>
        <p>{article.preview}</p>
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
  articles: MessageArticlePlacementMetadata[];
  mediaBaseUrl: string;
  LinkComponent: StorefrontLinkComponent;
}) {
  if (articles.length === 0) return null;

  return (
    <>
      {articles.map((article) => (
        <MessagesArticleRow
          article={article}
          key={article.articleId}
          LinkComponent={LinkComponent}
          mediaBaseUrl={mediaBaseUrl}
        />
      ))}
    </>
  );
}
