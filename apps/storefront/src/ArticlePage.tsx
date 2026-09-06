import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { ChevronLeft, FileText } from 'lucide-react';
import { useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { PublicContentError, type StorefrontBootstrap } from './content';
import { loadArticleSnapshot } from './content-route';
import { MarkdownContent } from './MarkdownContent';
import {
  getMessageArticlesFromBootstrap,
  markMessageArticleRead,
} from './messages-articles';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';
import { SYSTEM_UI } from './system-ui';
import './faq-ui.css';

function articleContentVersion(bootstrap: StorefrontBootstrap): string {
  return bootstrap.pointer.schemaVersion === 2
    ? bootstrap.pointer.faq.contentVersion
    : bootstrap.pointer.contentVersion;
}

function handleInternalBack(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (!canNavigateStorefrontBack()) return;
  event.preventDefault();
  navigateStorefrontBack();
}

function ArticleNavigation({ LinkComponent }: { LinkComponent: StorefrontLinkComponent }) {
  return (
    <header className="faq-article-navigation">
      <LinkComponent
        aria-label={SYSTEM_UI.back}
        className="faq-back-link"
        href="/messages/"
        onClick={handleInternalBack}
      >
        <ChevronLeft aria-hidden="true" />
        <span className="sr-only">{SYSTEM_UI.back}</span>
      </LinkComponent>
    </header>
  );
}

export default function ArticlePage({
  articleId,
  bootstrap,
  LinkComponent = 'a',
}: {
  articleId: string;
  bootstrap: StorefrontBootstrap;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const query = useQuery({
    queryKey: ['storefront-article', articleContentVersion(bootstrap), articleId],
    queryFn: ({ signal }) => loadArticleSnapshot(bootstrap, articleId, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const article = query.data ?? null;
  const isActiveMessageArticle = getMessageArticlesFromBootstrap(bootstrap).some(
    (item) => item.articleId === articleId,
  );
  const missing =
    query.error instanceof PublicContentError &&
    query.error.code === 'CONTENT_NOT_PUBLISHED';

  useEffect(() => {
    if (article && isActiveMessageArticle) markMessageArticleRead(articleId);
  }, [article, articleId, isActiveMessageArticle]);

  useEffect(() => {
    document.title = article
      ? `${article.title} · ${bootstrap.site.site.name}`
      : bootstrap.site.site.name;
  }, [article, bootstrap.site.site.name]);

  if (query.isLoading && !article) {
    return <div className="inline-loading faq-state">{SYSTEM_UI.loading}</div>;
  }

  if (query.error && !missing) {
    return (
      <div className="inline-error inline-error-action faq-state" role="alert">
        <span>{SYSTEM_UI.unavailable}</span>
        <button type="button" onClick={() => void query.refetch()}>
          {SYSTEM_UI.retry}
        </button>
      </div>
    );
  }

  if (!article) {
    return (
      <section
        className="faq-article-detail faq-article-missing"
        aria-labelledby="article-missing-title"
      >
        <ArticleNavigation LinkComponent={LinkComponent} />
        <div className="standalone-state embedded-state">
          <div className="state-mark" aria-hidden="true">
            <FileText />
          </div>
          <h1 id="article-missing-title">{SYSTEM_UI.notFound}</h1>
        </div>
      </section>
    );
  }

  return (
    <article className="faq-article-detail" aria-labelledby="article-title">
      <ArticleNavigation LinkComponent={LinkComponent} />
      <header className="faq-article-header">
        <h1 id="article-title">{article.title}</h1>
      </header>
      <div className="faq-article-body">
        <MarkdownContent source={article.body} />
      </div>
    </article>
  );
}
