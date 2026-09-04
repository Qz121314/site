import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { StorefrontIconButton } from '@site/storefront-ui/icon-button';
import { ArrowRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  publicImageVariantUrl,
  type PublicProductSummary,
  type PublicSection,
  type StorefrontBootstrap,
} from './content';
import { SquareSkeletonGrid } from './LoadingStates';
import { ResilientImage } from './ResilientMedia';
import { productHref, sectionHref } from './routing';
import { loadBrowseSearchProducts } from './search-index';
import {
  readCurrentStorefrontViewState,
  writeCurrentStorefrontViewState,
} from './storefront-history';
import { SYSTEM_UI } from './system-ui';
import './browse-ui.css';
import './browse-app-surface.css';

const BROWSE_VIEW_STATE_KEY = 'browse-directory';

type BrowseViewState = {
  search: string;
};

function restoredBrowseViewState(): BrowseViewState {
  const value = readCurrentStorefrontViewState<unknown>(BROWSE_VIEW_STATE_KEY);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { search: '' };
  const search = (value as Record<string, unknown>).search;
  return { search: typeof search === 'string' ? search : '' };
}

function publishedSections(bootstrap: StorefrontBootstrap): PublicSection[] {
  const pointer = bootstrap.pointer;
  if (pointer.schemaVersion !== 2) return bootstrap.home.allSections;
  return bootstrap.home.allSections.filter((section) =>
    Boolean(pointer.sections[section.id]),
  );
}

function productMatches(product: PublicProductSummary, keyword: string): boolean {
  return [
    product.title,
    product.sectionName,
    product.category.name ?? '',
    ...product.tags.map((tag) => tag.name),
  ].some((value) => value.toLowerCase().includes(keyword));
}

export function BrowsePage({
  bootstrap,
  LinkComponent,
}: {
  bootstrap: StorefrontBootstrap;
  LinkComponent: StorefrontLinkComponent;
}) {
  const [initialViewState] = useState(restoredBrowseViewState);
  const [search, setSearch] = useState(initialViewState.search);
  const normalizedSearch = search.trim().toLowerCase();
  const sections = useMemo(() => publishedSections(bootstrap), [bootstrap]);
  const productSearchQuery = useQuery({
    queryKey: ['storefront-browse-product-search', bootstrap.pointer.contentVersion],
    enabled: normalizedSearch.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: ({ signal }) => loadBrowseSearchProducts(bootstrap, signal),
  });

  const filteredSections = useMemo(
    () =>
      sections.filter((section) => {
        if (!normalizedSearch) return true;
        return `${section.name} ${section.description ?? ''}`
          .toLowerCase()
          .includes(normalizedSearch);
      }),
    [normalizedSearch, sections],
  );

  const filteredProducts = useMemo(() => {
    if (!normalizedSearch) return [];
    return (productSearchQuery.data ?? []).filter((product) =>
      productMatches(product, normalizedSearch),
    );
  }, [normalizedSearch, productSearchQuery.data]);

  useEffect(() => {
    document.title = `Browse · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name]);

  useEffect(() => {
    writeCurrentStorefrontViewState(BROWSE_VIEW_STATE_KEY, {
      search,
    } satisfies BrowseViewState);
  }, [search]);

  const noResults =
    normalizedSearch.length > 0 &&
    !productSearchQuery.isLoading &&
    !productSearchQuery.isError &&
    filteredSections.length === 0 &&
    filteredProducts.length === 0;

  return (
    <section className="browse-directory">
      <h1 className="sr-only">Browse · {bootstrap.site.site.name}</h1>
      <div className="browse-directory-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={search}
          placeholder={SYSTEM_UI.search}
          aria-label={SYSTEM_UI.search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search ? (
          <StorefrontIconButton
            className="browse-directory-search-clear"
            aria-label={SYSTEM_UI.clear}
            onClick={() => setSearch('')}
          >
            <X aria-hidden="true" />
          </StorefrontIconButton>
        ) : null}
      </div>

      {filteredSections.length > 0 ? (
        <section className="browse-directory-section">
          <div
            className={`browse-section-list${filteredSections.length === 1 ? ' is-single' : ''}`}
          >
            {filteredSections.map((section, index) => (
              <LinkComponent
                className={`browse-section-card${section.browseBackgroundUrl ? ' has-image' : ' is-fallback'}`}
                href={sectionHref(section)}
                key={section.id}
              >
                <span className="browse-section-card-media" aria-hidden="true">
                  {section.browseBackgroundUrl ? (
                    <ResilientImage
                      alt=""
                      fallback={
                        <span
                          className="browse-section-card-media-fallback"
                          aria-hidden="true"
                        />
                      }
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      src={section.browseBackgroundUrl}
                    />
                  ) : null}
                </span>
                <span className="browse-section-card-scrim" aria-hidden="true" />
                <span className="browse-section-card-content">
                  <span className="browse-section-card-copy">
                    <strong>{section.name}</strong>
                    {section.description ? <p>{section.description}</p> : null}
                  </span>
                  <span className="browse-section-card-arrow" aria-hidden="true">
                    <ArrowRight />
                  </span>
                </span>
              </LinkComponent>
            ))}
          </div>
        </section>
      ) : null}

      {normalizedSearch &&
      (productSearchQuery.isLoading || filteredProducts.length > 0) ? (
        <section
          className="browse-directory-section"
          aria-busy={productSearchQuery.isLoading}
        >
          {productSearchQuery.isLoading ? (
            <SquareSkeletonGrid count={4} />
          ) : (
            <div className="browse-search-products">
              {filteredProducts.map((product, index) => {
                const src =
                  publicImageVariantUrl(product.coverObjectKey, 640) ?? product.coverUrl;
                const srcSet = product.coverObjectKey
                  ? ([384, 640, 960] as const)
                      .map(
                        (width) =>
                          `${publicImageVariantUrl(product.coverObjectKey, width)} ${width}w`,
                      )
                      .join(', ')
                  : undefined;
                return (
                  <LinkComponent
                    className="browse-search-product-card"
                    href={productHref(product)}
                    key={product.id}
                  >
                    <span className="browse-search-product-cover">
                      <ResilientImage
                        alt=""
                        fallback={<span className="image-fallback" aria-hidden="true" />}
                        fetchPriority={index === 0 ? 'high' : 'auto'}
                        height={640}
                        loading={index < 2 ? 'eager' : 'lazy'}
                        sizes="(max-width: 767px) 46vw, 372px"
                        src={src}
                        srcSet={srcSet}
                        width={640}
                      />
                      <strong className="browse-search-product-title">
                        {product.title}
                      </strong>
                    </span>
                  </LinkComponent>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {normalizedSearch && productSearchQuery.isError ? (
        <div className="browse-directory-empty" role="status">
          <span>{SYSTEM_UI.temporarilyUnavailable}</span>
          <button
            className="browse-directory-retry"
            type="button"
            onClick={() => void productSearchQuery.refetch()}
          >
            {SYSTEM_UI.retry}
          </button>
        </div>
      ) : null}

      {noResults ? (
        <div className="browse-directory-empty">{SYSTEM_UI.noResults}</div>
      ) : null}
    </section>
  );
}
