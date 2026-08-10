import { useQuery } from '@tanstack/react-query';
import { StorefrontProductCard, type StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  loadSectionSnapshot,
  type PublicSection,
  type StorefrontBootstrap,
} from './content';
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

function SectionVisual({ section }: { section: PublicSection }) {
  const fallback = (
    <span aria-hidden="true">{Array.from(section.name.trim())[0] ?? '•'}</span>
  );
  if (section.icon.type === 'image' && section.icon.value) {
    return (
      <ResilientImage
        alt=""
        fallback={fallback}
        loading="lazy"
        src={section.icon.value}
      />
    );
  }
  return (
    <span aria-hidden="true">
      {section.icon.value || Array.from(section.name.trim())[0] || '•'}
    </span>
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
          onClick={handleBack}
        >
          <span className="section-catalog-back-icon" aria-hidden="true">
            ←
          </span>
          <span>{SYSTEM_UI.back}</span>
        </LinkComponent>

        <div className="section-catalog-identity">
          <span className="section-catalog-visual">
            <SectionVisual section={query.data.section} />
          </span>
          <div className="section-catalog-title-group">
            <h1 id="section-catalog-title">{query.data.section.name}</h1>
          </div>
        </div>
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
          </label>

          {hasFilterOptions ? (
            <div className="section-catalog-filters" aria-label="Filters">
              {query.data.categories.length > 0 ? (
                <div className="section-category-filter">
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

      {hasFilters && filteredProducts.length > 0 ? (
        <div className="section-catalog-results">
          <strong>{filteredProducts.length}</strong>
          <button type="button" onClick={clearFilters}>
            {SYSTEM_UI.clear}
          </button>
        </div>
      ) : null}

      {filteredProducts.length > 0 ? (
        <div className="product-grid section-catalog-products">
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
      ) : (
        <div className="section-catalog-empty">
          <span className="section-catalog-empty-icon" aria-hidden="true">
            <SectionVisual section={query.data.section} />
          </span>
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
