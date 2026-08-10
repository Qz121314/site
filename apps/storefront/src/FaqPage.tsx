import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { loadFaqSnapshot, type StorefrontBootstrap } from './content';
import { MarkdownContent } from './MarkdownContent';
import { faqArticleHref } from './routing';
import { useStorefrontCopy } from './storefront-copy';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';

function faqContentVersion(bootstrap: StorefrontBootstrap): string {
  return bootstrap.pointer.schemaVersion === 2
    ? bootstrap.pointer.faq.contentVersion
    : bootstrap.pointer.contentVersion;
}

function useFaqSnapshot(bootstrap: StorefrontBootstrap) {
  return useQuery({
    queryKey: ['storefront-faq', faqContentVersion(bootstrap)],
    queryFn: ({ signal }) => loadFaqSnapshot(bootstrap, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function handleInternalBack(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (!canNavigateStorefrontBack()) return;
  event.preventDefault();
  navigateStorefrontBack();
}

function FaqLoadState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  onRetry: () => void;
}) {
  const { faq } = useStorefrontCopy();
  if (loading) return <div className="inline-loading faq-state">{faq.loading}</div>;
  if (error) {
    return (
      <div className="inline-error inline-error-action faq-state">
        <span>{faq.unavailable}</span>
        <button type="button" onClick={onRetry}>{faq.retry}</button>
      </div>
    );
  }
  if (empty) return <div className="inline-empty faq-state">{faq.empty}</div>;
  return null;
}

export function FaqDirectoryPage({
  bootstrap,
  LinkComponent = 'a',
}: {
  bootstrap: StorefrontBootstrap;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const { faq } = useStorefrontCopy();
  const query = useFaqSnapshot(bootstrap);

  useEffect(() => {
    document.title = `${faq.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, faq.title]);

  return (
    <section className="faq-directory" aria-labelledby="faq-directory-title">
      <header className="app-page-heading faq-directory-heading">
        <div>
          <p className="app-page-kicker">{faq.kicker}</p>
          <h1 id="faq-directory-title">{faq.title}</h1>
        </div>
      </header>

      <FaqLoadState
        loading={query.isLoading && !query.data}
        error={Boolean(query.error && !query.data)}
        empty={query.data?.faqs.length === 0}
        onRetry={() => void query.refetch()}
      />

      {query.data && query.data.faqs.length > 0 ? (
        <ul className="faq-article-list">
          {query.data.faqs.map((article) => (
            <li key={article.id}>
              <LinkComponent
                className="faq-article-row"
                href={faqArticleHref(article.id)}
              >
                <span>{article.title}</span>
              </LinkComponent>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function FaqArticlePage({
  articleRef,
  bootstrap,
  LinkComponent = 'a',
}: {
  articleRef: string;
  bootstrap: StorefrontBootstrap;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const { faq } = useStorefrontCopy();
  const query = useFaqSnapshot(bootstrap);
  const article = query.data?.faqs.find((item) => item.id === articleRef) ?? null;

  useEffect(() => {
    document.title = article
      ? `${article.title} · ${bootstrap.site.site.name}`
      : `${faq.title} · ${bootstrap.site.site.name}`;
  }, [article, bootstrap.site.site.name, faq.title]);

  if (query.isLoading && !query.data) {
    return <FaqLoadState loading error={false} empty={false} onRetry={() => void query.refetch()} />;
  }

  if (query.error && !query.data) {
    return <FaqLoadState loading={false} error empty={false} onRetry={() => void query.refetch()} />;
  }

  if (!article) {
    return (
      <section className="faq-article-detail faq-article-missing" aria-labelledby="faq-article-missing-title">
        <header className="faq-article-navigation">
          <LinkComponent className="faq-back-link" href="/faq/" onClick={handleInternalBack}>
            <span className="faq-back-icon" aria-hidden="true">‹</span>
            <span>{faq.title}</span>
          </LinkComponent>
        </header>
        <div className="standalone-state embedded-state">
          <div className="state-mark">404</div>
          <h1 id="faq-article-missing-title">Article not found</h1>
          <p>This article is not part of the current published FAQ.</p>
          <LinkComponent className="primary-button" href="/faq/" onClick={handleInternalBack}>
            Back to {faq.title}
          </LinkComponent>
        </div>
      </section>
    );
  }

  return (
    <article className="faq-article-detail" aria-labelledby="faq-article-title">
      <header className="faq-article-navigation">
        <LinkComponent className="faq-back-link" href="/faq/" onClick={handleInternalBack}>
          <span className="faq-back-icon" aria-hidden="true">‹</span>
          <span>{faq.title}</span>
        </LinkComponent>
      </header>
      <header className="faq-article-header">
        <h1 id="faq-article-title">{article.title}</h1>
      </header>
      <div className="faq-article-body">
        <MarkdownContent source={article.body} />
      </div>
    </article>
  );
}
