import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { ChevronLeft, FileQuestion, MessageCircle } from 'lucide-react';
import { useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import type { StorefrontBootstrap } from './content';
import { loadFaqSnapshot } from './content-route';
import { MarkdownContent } from './MarkdownContent';
import { faqArticleHref } from './routing';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';
import { SYSTEM_UI } from './system-ui';
import './faq-ui.css';

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
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) return <div className="inline-loading faq-state">{SYSTEM_UI.loading}</div>;
  if (error) {
    return (
      <div className="inline-error inline-error-action faq-state" role="alert">
        <span>{SYSTEM_UI.unavailable}</span>
        <button type="button" onClick={onRetry}>
          {SYSTEM_UI.retry}
        </button>
      </div>
    );
  }
  return null;
}

export function FaqDirectoryPage({
  bootstrap,
  LinkComponent = 'a',
}: {
  bootstrap: StorefrontBootstrap;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const query = useFaqSnapshot(bootstrap);

  useEffect(() => {
    document.title = `FAQ · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name]);

  return (
    <section className="faq-directory">
      <h1 className="sr-only">FAQ · {bootstrap.site.site.name}</h1>
      <FaqLoadState
        loading={query.isLoading && !query.data}
        error={Boolean(query.error && !query.data)}
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

      {query.data && query.data.faqs.length === 0 ? (
        <div className="faq-empty-state" role="status">
          <span className="faq-empty-mark" aria-hidden="true">
            <MessageCircle />
          </span>
          <strong>{SYSTEM_UI.noResults}</strong>
        </div>
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
  const query = useFaqSnapshot(bootstrap);
  const article = query.data?.faqs.find((item) => item.id === articleRef) ?? null;

  useEffect(() => {
    document.title = article
      ? `${article.title} · ${bootstrap.site.site.name}`
      : bootstrap.site.site.name;
  }, [article, bootstrap.site.site.name]);

  if (query.isLoading && !query.data) {
    return <FaqLoadState loading error={false} onRetry={() => void query.refetch()} />;
  }

  if (query.error && !query.data) {
    return <FaqLoadState loading={false} error onRetry={() => void query.refetch()} />;
  }

  if (!article) {
    return (
      <section
        className="faq-article-detail faq-article-missing"
        aria-labelledby="faq-article-missing-title"
      >
        <header className="faq-article-navigation">
          <LinkComponent
            aria-label={SYSTEM_UI.back}
            className="faq-back-link"
            href="/faq/"
            onClick={handleInternalBack}
          >
            <ChevronLeft aria-hidden="true" />
            <span className="sr-only">{SYSTEM_UI.back}</span>
          </LinkComponent>
        </header>
        <div className="standalone-state embedded-state">
          <div className="state-mark" aria-hidden="true">
            <FileQuestion />
          </div>
          <h1 id="faq-article-missing-title">{SYSTEM_UI.notFound}</h1>
        </div>
      </section>
    );
  }

  return (
    <article className="faq-article-detail" aria-labelledby="faq-article-title">
      <header className="faq-article-navigation">
        <LinkComponent
          aria-label={SYSTEM_UI.back}
          className="faq-back-link"
          href="/faq/"
          onClick={handleInternalBack}
        >
          <ChevronLeft aria-hidden="true" />
          <span className="sr-only">{SYSTEM_UI.back}</span>
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
