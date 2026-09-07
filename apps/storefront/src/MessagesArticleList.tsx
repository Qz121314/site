import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { ChevronRight, FileText } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { mediaUrl } from './content';
import {
  getMessageArticleReadSnapshot,
  subscribeMessageArticleReadState,
  type MessageArticleMetadata,
} from './messages-articles';
import { ResilientImage } from './ResilientMedia';
import { articleHref } from './routing';

function MessagesArticleCard({
  article,
  LinkComponent,
  mediaBaseUrl,
  unread,
}: {
  article: MessageArticleMetadata;
  LinkComponent: StorefrontLinkComponent;
  mediaBaseUrl: string;
  unread: boolean;
}) {
  const backgroundUrl = mediaUrl(mediaBaseUrl, article.backgroundObjectKey);

  return (
    <LinkComponent
      className={`messages-article-card${unread ? ' is-unread' : ''}`}
      data-article-id={article.articleId}
      data-read-state={unread ? 'unread' : 'read'}
      href={articleHref(article.articleId)}
    >
      {backgroundUrl ? (
        <span className="messages-article-card-media" aria-hidden="true">
          <ResilientImage alt="" loading="lazy" src={backgroundUrl} />
        </span>
      ) : null}
      <span className="messages-article-card-copy">
        <span className="messages-article-card-kicker">
          <span className="sr-only">{unread ? 'Unread article. ' : 'Read article. '}</span>
          {unread ? 'New' : 'Article'}
        </span>
        <h3>{article.title}</h3>
        {article.preview ? <p>{article.preview}</p> : null}
      </span>
      <span className="messages-article-card-affordance" aria-hidden="true">
        <ChevronRight />
      </span>
    </LinkComponent>
  );
}

export function MessagesArticleList({
  articles,
  LinkComponent = 'a',
  mediaBaseUrl,
}: {
  articles: MessageArticleMetadata[];
  LinkComponent?: StorefrontLinkComponent;
  mediaBaseUrl: string;
}) {
  const readSnapshot = useSyncExternalStore(
    subscribeMessageArticleReadState,
    getMessageArticleReadSnapshot,
    () => '[]',
  );
  const readIds = new Set<string>(JSON.parse(readSnapshot));

  if (articles.length === 0) return null;

  return (
    <section className="messages-article-section" aria-labelledby="messages-article-heading">
      <header className="messages-article-section-header">
        <span className="messages-article-section-icon" aria-hidden="true">
          <FileText />
        </span>
        <h2 id="messages-article-heading">Recommended articles</h2>
      </header>
      <div className="messages-article-list">
        {articles.map((article) => (
          <MessagesArticleCard
            article={article}
            key={article.articleId}
            LinkComponent={LinkComponent}
            mediaBaseUrl={mediaBaseUrl}
            unread={!readIds.has(article.articleId)}
          />
        ))}
      </div>
    </section>
  );
}
