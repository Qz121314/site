import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { PublicContentError, type StorefrontBootstrap } from './content';
import { loadReviewsPageSnapshot } from './content-route';
import { MarkdownContent } from './MarkdownContent';
import { NotFoundPage } from './NotFoundPage';
import { SYSTEM_UI } from './system-ui';
import './reviews-content-ui.css';

export function ReviewsPage({
  bootstrap,
  LinkComponent,
}: {
  bootstrap: StorefrontBootstrap;
  LinkComponent: StorefrontLinkComponent;
}) {
  const pageVersion =
    bootstrap.pointer.schemaVersion === 2
      ? (bootstrap.pointer.reviews?.contentVersion ?? bootstrap.pointer.contentVersion)
      : bootstrap.pointer.contentVersion;
  const query = useQuery({
    queryKey: ['storefront-reviews-page', pageVersion],
    queryFn: ({ signal }) => loadReviewsPageSnapshot(bootstrap, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (query.data) {
      document.title = `${query.data.title} · ${bootstrap.site.site.name}`;
    }
  }, [bootstrap.site.site.name, query.data]);

  const missing =
    query.error instanceof PublicContentError &&
    query.error.code === 'CONTENT_NOT_PUBLISHED';
  if (missing) {
    return (
      <NotFoundPage siteName={bootstrap.site.site.name} LinkComponent={LinkComponent} />
    );
  }
  if (query.error) {
    return (
      <section className="standalone-state embedded-state" role="status">
        <div className="state-mark" aria-hidden="true">
          <CircleAlert />
        </div>
        <h1>{SYSTEM_UI.unavailable}</h1>
        <button
          className="primary-button"
          type="button"
          onClick={() => void query.refetch()}
        >
          {SYSTEM_UI.retry}
        </button>
      </section>
    );
  }
  if (!query.data) return <div className="inline-loading">{SYSTEM_UI.loading}</div>;

  return (
    <article className="reviews-content-page" aria-labelledby="reviews-content-title">
      <h1 id="reviews-content-title">{query.data.title}</h1>
      <div className="reviews-content-body">
        <MarkdownContent source={query.data.body} />
      </div>
    </article>
  );
}
