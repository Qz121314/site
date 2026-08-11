import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { loadSectionSnapshot, type StorefrontBootstrap } from './content';
import { ResilientImage } from './ResilientMedia';
import { productHref } from './routing';
import { canNavigateStorefrontBack, navigateStorefrontBack } from './storefront-history';
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

export function SectionCatalogPage({
  bootstrap,
  sectionRef,
  LinkComponent,
}: {
  bootstrap: StorefrontBootstrap;
  sectionRef: string;
  LinkComponent: StorefrontLinkComponent;
}) {
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
    if (query.data)
      document.title = `${query.data.section.name} · ${bootstrap.site.site.name}`;
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

  function handleBack(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (!canNavigateStorefrontBack()) return;
    event.preventDefault();
    navigateStorefrontBack();
  }

  const hasFilters = Boolean(search.trim() || categoryId || selectedTags.size > 0);

  if (query.isLoading && !query.data) {
    return (
      <div className="inline-loading section-catalog-state">{SYSTEM_UI.loading}</div>
    );
  }

  if (query.error && !query.data) {
    return (
      <section
        className="section-catalog-state standalone-state embedded-state"
        role="status"
      >
        <div className="state-mark">!</div>
        <h1>{SYSTEM_UI.unavailable}</h1>
        <div className="state-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => void query.refetch()}
          >
            {SYSTEM_UI.retry}
          </button>
          <LinkComponent
            className="secondary-button"
            href="/browse/"
            onClick={handleBack}
          >
            {SYSTEM_UI.back}
          </LinkComponent>
        </div>
      </section>
    );
  }

  if (!query.data) return null;

  const hasFilterOptions = query.data.categories.length > 0 || query.data.tags.length > 0;
  const hasProducts = query.data.products.length > 0;

  return (
    <section className="section-catalog" aria-labelledby="section-catalog-title">
      <header className="section-catalog-header">
        <LinkComponent
          className="section-catalog-back"
          href="/browse/"
          aria-label={SYSTEM_UI.back}
          onClick={handleBack}
        >
          <span aria-hidden="true">‹</span>
        </LinkComponent>
        <h1 id="section-catalog-title">{query.data.section.name}</h1>
      </header>

      {hasProducts ? (
        <div className="section-catalog-controls">
          <label className="section-catalog-search">
            <SearchIcon />
            <input
              type="search"
              value={search}
              placeholder={SYSTEM_UI.search}
              aria-label={SYSTEM_UI.search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="section-catalog-search-clear"
                aria-label={SYSTEM_UI.clear}
                onClick={() => setSearch('')}
              >
                ×
              </button>
            ) : null}
          </label>

          {hasFilterOptions ? (
            <div className="section-catalog-filters" aria-label="Filters">
              {query.data.categories.length > 0 ? (
                <div className="section-category-options">
                  <button
                    className={!categoryId ? 'is-active' : undefined}
                    type="button"
                    aria-pressed={!categoryId}
                    onClick={() => setCategoryId('')}
                  >
                    {SYSTEM_UI.all}
                  </button>
                  {query.data.categories.map((category) => (
                    <button
                      className={categoryId === category.id ? 'is-active' : undefined}
                      key={category.id}
                      type="button"
                      aria-pressed={categoryId === category.id}
                      onClick={() => setCategoryId(category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              ) : null}

              {query.data.tags.length > 0 ? (
                <div className="section-tag-filter" aria-label="Tags">
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
        </div>
      ) : null}

      {filteredProducts.length > 0 ? (
        <div className="section-catalog-products">
          {filteredProducts.map((product) => (
            <LinkComponent
              className="section-product-card"
              href={productHref(product)}
              key={product.id}
            >
              <div className="section-product-cover">
                <ResilientImage
                  alt=""
                  fallback={<div className="image-fallback" aria-hidden="true" />}
                  loading="lazy"
                  src={product.coverUrl}
                />
              </div>
              <h2>{product.title}</h2>
            </LinkComponent>
          ))}
        </div>
      ) : (
        <div className="section-catalog-empty">
          <p>{SYSTEM_UI.noResults}</p>
          {hasFilters ? (
            <button
              className="section-catalog-empty-reset"
              type="button"
              onClick={clearFilters}
            >
              {SYSTEM_UI.clear}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
