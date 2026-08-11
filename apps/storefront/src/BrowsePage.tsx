import { useQuery } from '@tanstack/react-query';
import { StorefrontProductCard, type StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useMemo, useState } from 'react';
import {
  loadSectionSnapshot,
  type PublicProductSummary,
  type PublicSection,
  type StorefrontBootstrap,
} from './content';
import { ResilientImage } from './ResilientMedia';
import { productHref, sectionHref } from './routing';
import { SYSTEM_UI } from './system-ui';

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="10.8" cy="10.8" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
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
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const sections = useMemo(() => publishedSections(bootstrap), [bootstrap]);
  const productSearchQuery = useQuery({
    queryKey: ['storefront-browse-product-search', bootstrap.pointer.contentVersion],
    enabled: normalizedSearch.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) => {
      const snapshots = await Promise.all(
        sections.map(async (section) => {
          try {
            return await loadSectionSnapshot(bootstrap, section.id, signal);
          } catch {
            return null;
          }
        }),
      );
      const byId = new Map<string, PublicProductSummary>();
      for (const snapshot of snapshots) {
        for (const product of snapshot?.products ?? []) byId.set(product.id, product);
      }
      return [...byId.values()];
    },
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
    document.title = bootstrap.site.site.name;
  }, [bootstrap.site.site.name]);

  const noResults =
    normalizedSearch.length > 0 &&
    !productSearchQuery.isLoading &&
    filteredSections.length === 0 &&
    filteredProducts.length === 0;

  return (
    <section className="browse-directory">
      <label className="browse-directory-search">
        <SearchIcon />
        <input
          type="search"
          value={search}
          placeholder={SYSTEM_UI.search}
          aria-label={SYSTEM_UI.search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {filteredSections.length > 0 ? (
        <section className="browse-directory-section">
          <div
            className={`browse-section-list${filteredSections.length === 1 ? ' is-single' : ''}`}
          >
            {filteredSections.map((section) => (
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
                      loading="lazy"
                      src={section.browseBackgroundUrl}
                    />
                  ) : null}
                </span>
                <span className="browse-section-card-scrim" aria-hidden="true" />
                <span className="browse-section-card-content">
                  <strong>{section.name}</strong>
                  {section.description ? <p>{section.description}</p> : null}
                </span>
              </LinkComponent>
            ))}
          </div>
        </section>
      ) : null}

      {normalizedSearch &&
      (productSearchQuery.isLoading || filteredProducts.length > 0) ? (
        <section className="browse-directory-section">
          {productSearchQuery.isLoading ? (
            <div className="inline-loading">{SYSTEM_UI.loading}</div>
          ) : (
            <div className="product-grid browse-search-products">
              {filteredProducts.map((product) => (
                <StorefrontProductCard
                  address={product.address}
                  categoryName={product.category.name}
                  href={productHref(product)}
                  key={product.id}
                  LinkComponent={LinkComponent}
                  media={
                    <ResilientImage
                      alt=""
                      fallback={<div className="image-fallback" aria-hidden="true" />}
                      loading="lazy"
                      src={product.coverUrl}
                    />
                  }
                  sectionName={product.sectionName}
                  tags={product.tags}
                  title={product.title}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {noResults ? (
        <div className="browse-directory-empty">{SYSTEM_UI.noResults}</div>
      ) : null}
    </section>
  );
}
