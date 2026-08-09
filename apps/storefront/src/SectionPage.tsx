import { useQuery } from '@tanstack/react-query';
import { StorefrontProductCard, type StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useMemo, useState } from 'react';
import { loadSectionSnapshot, type StorefrontBootstrap } from './content';
import { ResilientImage } from './ResilientMedia';
import { productHref } from './routing';
import { useStorefrontCopy } from './storefront-copy';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

export function SectionCatalogPage({
  bootstrap,
  sectionRef,
  LinkComponent,
}: {
  bootstrap: StorefrontBootstrap;
  sectionRef: string;
  LinkComponent: StorefrontLinkComponent;
}) {
  const { product: productCopy, section: sectionCopy } = useStorefrontCopy();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set());
  const query = useQuery({
    queryKey: ['storefront-section', bootstrap.pointer.contentVersion, sectionRef],
    queryFn: ({ signal }) => loadSectionSnapshot(bootstrap, sectionRef, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const filteredProducts = useMemo(() => {
    const source = query.data?.products ?? [];
    const keyword = search.trim().toLowerCase();
    return source.filter((product) => {
      if (categoryId && product.category.id !== categoryId) return false;
      if (selectedTags.size > 0) {
        const productTagIds = new Set(product.tags.map((tag) => tag.id));
        if (![...selectedTags].every((tagId) => productTagIds.has(tagId))) return false;
      }
      if (!keyword) return true;
      return [
        product.title,
        product.category.name ?? '',
        ...product.tags.map((tag) => tag.name),
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [categoryId, query.data?.products, search, selectedTags]);

  useEffect(() => {
    if (query.data) document.title = `${query.data.section.name} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, query.data]);

  function toggleTag(tagId: string) {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function clearFilters() {
    setSearch('');
    setCategoryId('');
    setSelectedTags(new Set());
  }

  const hasFilters = Boolean(search.trim() || categoryId || selectedTags.size > 0);

  if (query.isLoading && !query.data) {
    return <div className="inline-loading section-catalog-state">{sectionCopy.loading}</div>;
  }

  if (query.error && !query.data) {
    return (
      <section className="section-catalog-state standalone-state embedded-state" role="status">
        <div className="state-mark">!</div>
        <h1>Section unavailable</h1>
        <p>The latest published products could not be loaded.</p>
        <div className="state-actions">
          <button className="primary-button" type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
          <LinkComponent className="secondary-button" href="/browse/">{sectionCopy.backLabel}</LinkComponent>
        </div>
      </section>
    );
  }

  if (!query.data) return null;

  const resultWord = filteredProducts.length === 1
    ? sectionCopy.resultSingular
    : sectionCopy.resultPlural;

  return (
    <section className="section-catalog" aria-labelledby="section-catalog-title">
      <LinkComponent className="section-catalog-back" href="/browse/">
        <span aria-hidden="true">←</span> {sectionCopy.backLabel}
      </LinkComponent>

      <header className="section-catalog-heading">
        <div>
          <h1 id="section-catalog-title">{query.data.section.name}</h1>
          <p>{query.data.products.length} {query.data.products.length === 1 ? sectionCopy.resultSingular : sectionCopy.resultPlural}</p>
        </div>
      </header>

      <label className="section-catalog-search">
        <SearchIcon />
        <input
          type="search"
          value={search}
          placeholder={sectionCopy.searchPlaceholder}
          aria-label={sectionCopy.searchLabel}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {(query.data.categories.length > 0 || query.data.tags.length > 0) ? (
        <div className="section-catalog-filters" aria-label="Product filters">
          {query.data.categories.length > 0 ? (
            <label className="section-category-filter">
              <span>{sectionCopy.typeLabel}</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">{sectionCopy.allTypes}</option>
                {query.data.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {query.data.tags.length > 0 ? (
            <div className="section-tag-filter" aria-label="Product tags">
              {query.data.tags.map((tag) => (
                <button
                  className={selectedTags.has(tag.id) ? 'is-active' : undefined}
                  key={tag.id}
                  type="button"
                  aria-pressed={selectedTags.has(tag.id)}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="section-catalog-results">
        <strong>{filteredProducts.length} {resultWord}</strong>
        {hasFilters ? (
          <button type="button" onClick={clearFilters}>{sectionCopy.clearFilters}</button>
        ) : null}
      </div>

      {filteredProducts.length > 0 ? (
        <div className="product-grid section-catalog-products">
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
      ) : (
        <div className="section-catalog-empty">{sectionCopy.emptyResults}</div>
      )}
    </section>
  );
}
