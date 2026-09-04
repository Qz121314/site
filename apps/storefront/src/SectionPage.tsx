import { useQuery } from '@tanstack/react-query';
import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { StorefrontIconButton } from '@site/storefront-ui/icon-button';
import { ChevronLeft, CircleAlert, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { publicImageVariantUrl, type StorefrontBootstrap } from './content';
import { loadSectionSnapshot } from './content-route';
import { SquareSkeletonGrid } from './LoadingStates';
import { ResilientImage } from './ResilientMedia';
import { productHref } from './routing';
import { SectionFilterControls } from './SectionFilterControls';
import {
  canNavigateStorefrontBack,
  navigateStorefrontBack,
  readCurrentStorefrontViewState,
  writeCurrentStorefrontViewState,
} from './storefront-history';
import { SYSTEM_UI } from './system-ui';
import './section-ui.css';

const SECTION_VIEW_STATE_KEY = 'section-catalog';

type SectionViewState = {
  search: string;
  categoryId: string;
  selectedTagIds: string[];
};

function restoredSectionViewState(): SectionViewState {
  const value = readCurrentStorefrontViewState<unknown>(SECTION_VIEW_STATE_KEY);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { search: '', categoryId: '', selectedTagIds: [] };
  }
  const record = value as Record<string, unknown>;
  const search = typeof record.search === 'string' ? record.search : '';
  const categoryId = typeof record.categoryId === 'string' ? record.categoryId : '';
  const selectedTagIds = Array.isArray(record.selectedTagIds)
    ? record.selectedTagIds.filter((item): item is string => typeof item === 'string')
    : [];
  return { search, categoryId, selectedTagIds };
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
  const [initialViewState] = useState(restoredSectionViewState);
  const [search, setSearch] = useState(initialViewState.search);
  const [categoryId, setCategoryId] = useState(initialViewState.categoryId);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    () => new Set(initialViewState.selectedTagIds),
  );
  const canonicalSectionId =
    bootstrap.home.allSections.find(
      (section) => section.id === sectionRef || section.slug === sectionRef,
    )?.id ?? sectionRef;
  const query = useQuery({
    queryKey: [
      'storefront-section',
      bootstrap.pointer.contentVersion,
      canonicalSectionId,
    ],
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

  useEffect(() => {
    writeCurrentStorefrontViewState(SECTION_VIEW_STATE_KEY, {
      search,
      categoryId,
      selectedTagIds: [...selectedTags],
    } satisfies SectionViewState);
  }, [categoryId, search, selectedTags]);

  function toggleTag(tagId: string) {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function clearTags() {
    setSelectedTags(new Set());
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
      <section className="section-catalog-state" aria-busy="true">
        <SquareSkeletonGrid count={6} />
      </section>
    );
  }

  if (query.error && !query.data) {
    return (
      <section
        className="section-catalog-state standalone-state embedded-state"
        role="status"
      >
        <div className="state-mark" aria-hidden="true">
          <CircleAlert />
        </div>
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
          <ChevronLeft aria-hidden="true" />
          <span className="section-catalog-back-label">{SYSTEM_UI.back}</span>
        </LinkComponent>
        <h1 id="section-catalog-title">{query.data.section.name}</h1>
      </header>

      {hasProducts ? (
        <div className="section-catalog-controls">
          <div className="section-catalog-search">
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
                className="section-catalog-search-clear"
                aria-label={SYSTEM_UI.clear}
                onClick={() => setSearch('')}
              >
                <X aria-hidden="true" />
              </StorefrontIconButton>
            ) : null}
          </div>

          <SectionFilterControls
            categories={query.data.categories}
            tags={query.data.tags}
            categoryId={categoryId}
            selectedTags={selectedTags}
            onCategoryChange={setCategoryId}
            onToggleTag={toggleTag}
            onClearTags={clearTags}
          />
        </div>
      ) : null}

      <div className="section-catalog-content" data-storefront-scroll-surface>
        {filteredProducts.length > 0 ? (
          <div className="section-catalog-products">
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
                  className="section-product-card"
                  href={productHref(product)}
                  key={product.id}
                >
                  <div className="section-product-cover">
                    <ResilientImage
                      alt=""
                      fallback={<div className="image-fallback" aria-hidden="true" />}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      height={640}
                      loading={index < 2 ? 'eager' : 'lazy'}
                      sizes="(max-width: 767px) 46vw, 372px"
                      src={src}
                      srcSet={srcSet}
                      width={640}
                    />
                    <h2 className="section-product-title">{product.title}</h2>
                  </div>
                </LinkComponent>
              );
            })}
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
      </div>
    </section>
  );
}
