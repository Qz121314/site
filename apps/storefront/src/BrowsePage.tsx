import { useQuery } from '@tanstack/react-query';
import { StorefrontProductCard, type StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useMemo, useState } from 'react';
import { loadBrowseSectionPresentations } from './browse-sections';
import {
  loadSectionSnapshot,
  type PublicProductSummary,
  type PublicSection,
  type StorefrontBootstrap,
} from './content';
import { ResilientImage } from './ResilientMedia';
import { productHref, sectionHref } from './routing';
import { useStorefrontCopy } from './storefront-copy';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function publishedSections(bootstrap: StorefrontBootstrap): PublicSection[] {
  const pointer = bootstrap.pointer;
  if (pointer.schemaVersion !== 2) return bootstrap.home.allSections;
  return bootstrap.home.allSections.filter((section) => Boolean(pointer.sections[section.id]));
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
  const { browse, product: productCopy, section: sectionCopy } = useStorefrontCopy();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const sections = useMemo(() => publishedSections(bootstrap), [bootstrap]);
  const presentationQuery = useQuery({
    queryKey: ['storefront-browse-section-presentation'],
    queryFn: ({ signal }) => loadBrowseSectionPresentations(signal),
    staleTime: 30_000,
  });
  const presentationById = useMemo(
    () => new Map((presentationQuery.data ?? []).map((item) => [item.id, item])),
    [presentationQuery.data],
  );
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

  const filteredSections = useMemo(() => sections.filter((section) => {
    if (!normalizedSearch) return true;
    const presentation = presentationById.get(section.id);
    return `${section.name} ${presentation?.description ?? ''}`.toLowerCase().includes(normalizedSearch);
  }), [normalizedSearch, presentationById, sections]);

  const filteredProducts = useMemo(() => {
    if (!normalizedSearch) return [];
    return (productSearchQuery.data ?? []).filter((product) => productMatches(product, normalizedSearch));
  }, [normalizedSearch, productSearchQuery.data]);

  useEffect(() => {
    document.title = `${browse.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, browse.title]);

  const noResults = normalizedSearch.length > 0 &&
    !productSearchQuery.isLoading &&
    filteredSections.length === 0 &&
    filteredProducts.length === 0;

  return (
    <section className="browse-directory" aria-labelledby="browse-directory-title">
      <header className="browse-directory-heading">
        <h1 id="browse-directory-title">{browse.title}</h1>
      </header>

      <label className="browse-directory-search">
        <SearchIcon />
        <input
          type="search"
          value={search}
          placeholder={browse.searchPlaceholder}
          aria-label={browse.searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {filteredSections.length > 0 ? (
        <section className="browse-directory-section" aria-labelledby="browse-directory-sections-title">
          <div className="browse-directory-section-heading">
            <h2 id="browse-directory-sections-title">{browse.sectionsTitle}</h2>
            <span>{filteredSections.length}</span>
          </div>
          <div className="browse-section-list">
            {filteredSections.map((section) => {
              const presentation = presentationById.get(section.id);
              return (
                <LinkComponent
                  className={`browse-section-card${presentation?.backgroundUrl ? ' has-image' : ''}`}
                  href={sectionHref(section)}
                  key={section.id}
                >
                  <span className="browse-section-card-background" aria-hidden="true">
                    {presentation?.backgroundUrl ? (
                      <ResilientImage
                        alt=""
                        fallback={<span className="browse-section-card-fallback" />}
                        loading="lazy"
                        src={presentation.backgroundUrl}
                      />
                    ) : (
                      <span className="browse-section-card-fallback" />
                    )}
                  </span>
                  <span className="browse-section-card-overlay" aria-hidden="true" />
                  <span className="browse-section-card-content">
                    <strong>{section.name}</strong>
                    {presentation?.description ? <p>{presentation.description}</p> : null}
                    {presentation ? <small>{presentation.productCount} {browse.productsTitle}</small> : null}
                  </span>
                  <span className="browse-section-card-chevron" aria-hidden="true">›</span>
                </LinkComponent>
              );
            })}
          </div>
        </section>
      ) : null}

      {normalizedSearch && (productSearchQuery.isLoading || filteredProducts.length > 0) ? (
        <section className="browse-directory-section" aria-labelledby="browse-directory-products-title">
          <div className="browse-directory-section-heading">
            <h2 id="browse-directory-products-title">{browse.productsTitle}</h2>
            {!productSearchQuery.isLoading ? <span>{filteredProducts.length}</span> : null}
          </div>
          {productSearchQuery.isLoading ? (
            <div className="inline-loading">{sectionCopy.loading}</div>
          ) : (
            <div className="product-grid browse-search-products">
              {filteredProducts.map((product) => (
                <StorefrontProductCard
                  address={product.address}
                  categoryName={product.category.name}
                  href={productHref(product)}
                  key={product.id}
                  LinkComponent={LinkComponent}
                  media={(
                    <ResilientImage
                      alt=""
                      fallback={<div className="image-fallback" aria-hidden="true" />}
                      loading="lazy"
                      src={product.coverUrl}
                    />
                  )}
                  modeLabel={product.serviceMode === 'online' ? productCopy.onlineLabel : productCopy.offlineLabel}
                  sectionName={product.sectionName}
                  tags={product.tags}
                  title={product.title}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {noResults ? <div className="browse-directory-empty">{browse.noResults}</div> : null}
    </section>
  );
}
