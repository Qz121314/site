import { useQuery } from '@tanstack/react-query';
import {
  StorefrontBottomNavigation,
  StorefrontBrandBar,
  StorefrontHero,
  StorefrontProductCard,
} from '@site/storefront-ui';
import {
  type AnchorHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  loadFaqSnapshot,
  loadProductSnapshot,
  loadSectionSnapshot,
  loadStorefrontBootstrap,
  PublicContentError,
  type PublicProductSummary,
  type PublicSection,
  type PublicSite,
  type StorefrontBootstrap,
} from './content';
import { loadPublishedHero, type PublishedHeroSlide } from './hero-content';
import { HomepageAnalytics } from './HomepageAnalytics';
import { MarkdownContent } from './MarkdownContent';
import { ResilientImage, ResilientVideo } from './ResilientMedia';
import {
  bottomNavigationActiveHref,
  parseStorefrontRoute,
  productHref,
  sectionHref,
} from './routing';
import {
  FALLBACK_STOREFRONT_COPY,
  loadStorefrontCopy,
  StorefrontCopyProvider,
  useStorefrontCopy,
} from './storefront-copy';
import { primaryNavigationItems } from './storefront-navigation';
import {
  MessageThreadPageContent,
  MessagesPageContent,
  type SupportConversationSummary,
} from './support-ui';

type RouteResource = 'section' | 'product';

const NAVIGATION_EVENT = 'storefront:navigate';
const supportConversations: SupportConversationSummary[] = [];

function subscribePathname(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATION_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATION_EVENT, callback);
  };
}

function currentPathname() {
  return window.location.pathname;
}

function usePathname() {
  return useSyncExternalStore(subscribePathname, currentPathname, () => '/');
}

function navigate(href: string) {
  window.history.pushState(null, '', href);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

function isVideoMediaUrl(value: string): boolean {
  try {
    const pathname = new URL(value, window.location.origin).pathname.toLowerCase();
    return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
  } catch {
    return /\.(?:mp4|webm)(?:$|[?#])/i.test(value);
  }
}

function isNotPublishedError(error: unknown): boolean {
  return error instanceof PublicContentError && (
    error.code === 'CONTENT_NOT_PUBLISHED'
    || error.code === 'INVALID_SECTION'
    || error.code === 'INVALID_PRODUCT'
  );
}

function AppLink({ href = '/', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !href.startsWith('/') ||
      href.startsWith('/go/')
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };

  return <a {...props} href={href} onClick={handleClick} />;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function SectionIcon({ section }: { section: PublicSection }) {
  const fallback = <span aria-hidden="true">{section.name.slice(0, 1)}</span>;
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
  return <span aria-hidden="true">{section.icon.value || section.name.slice(0, 1)}</span>;
}

function ProductCard({ product }: { product: PublicProductSummary }) {
  const { product: productCopy } = useStorefrontCopy();
  return (
    <StorefrontProductCard
      address={product.address}
      categoryName={product.category.name}
      href={productHref(product)}
      LinkComponent={AppLink}
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
  );
}

function HeroMedia({ slide }: { slide: PublishedHeroSlide }) {
  const fallback = <div className="hero-media-fallback" aria-hidden="true" />;
  if (slide.mediaKind === 'video') {
    return (
      <ResilientVideo
        fallback={fallback}
        muted
        playsInline
        preload="metadata"
        src={slide.mediaUrl}
      />
    );
  }
  return (
    <ResilientImage
      alt=""
      fallback={fallback}
      src={slide.mediaUrl}
    />
  );
}

function ProductCollection({
  eyebrow,
  title,
  id,
  products,
}: {
  eyebrow: string;
  title: string;
  id: string;
  products: PublicProductSummary[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="content-section" id={id}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="product-grid">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}

function BottomNavigation() {
  const pathname = usePathname();
  const copy = useStorefrontCopy();
  const unreadMessages = supportConversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  return (
    <StorefrontBottomNavigation
      activeHref={bottomNavigationActiveHref(pathname)}
      items={primaryNavigationItems(copy.navigation, unreadMessages)}
      LinkComponent={AppLink}
    />
  );
}

function SiteShell({ site, children }: { site: PublicSite; children: ReactNode }) {
  return (
    <div className="app-shell">
      <StorefrontBrandBar
        LinkComponent={AppLink}
        locationLabel={site.locationLabel}
        logo={(
          <ResilientImage
            alt=""
            fallback={site.name.slice(0, 1)}
            src={site.logoUrl}
          />
        )}
        siteName={site.name}
      />
      <main>{children}</main>
      <footer className="site-footer">{site.name}</footer>
      <BottomNavigation />
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="app-shell loading-shell" aria-busy="true">
      <header className="topbar"><div className="loading-brand" /></header>
      <main>
        <div className="loading-grid">
          {Array.from({ length: 6 }, (_, index) => <div className="loading-card" key={index} />)}
        </div>
      </main>
    </div>
  );
}

function ErrorPage({ error }: { error: unknown }) {
  const message = error instanceof PublicContentError
    ? error.message
    : 'The storefront is temporarily unavailable.';
  return (
    <div className="standalone-state">
      <div className="state-mark">!</div>
      <h1>Storefront unavailable</h1>
      <p>{message}</p>
      <button type="button" onClick={() => window.location.reload()}>Try again</button>
    </div>
  );
}

function NotFoundPage({ site }: { site: PublicSite }) {
  useEffect(() => {
    document.title = `Not found · ${site.name}`;
  }, [site.name]);

  return (
    <SiteShell site={site}>
      <div className="standalone-state embedded-state">
        <div className="state-mark">404</div>
        <h1>Page not found</h1>
        <p>The service or page you requested is not part of the current published version.</p>
        <AppLink className="primary-button" href="/">Back to home</AppLink>
      </div>
    </SiteShell>
  );
}

function RouteErrorState({
  error,
  resource,
  onRetry,
}: {
  error: unknown;
  resource: RouteResource;
  onRetry: () => void;
}) {
  const notPublished = isNotPublishedError(error);
  const resourceLabel = resource === 'section' ? 'Service section' : 'Service';
  const missingMessage = resource === 'section'
    ? 'This service section is not part of the current published version.'
    : 'This service is not part of the current published version.';

  return (
    <div className="standalone-state embedded-state" role="status">
      <div className="state-mark">{notPublished ? '404' : '!'}</div>
      <h1>{notPublished ? `${resourceLabel} not found` : `${resourceLabel} unavailable`}</h1>
      <p>{notPublished ? missingMessage : 'The latest published data could not be loaded. Please try again.'}</p>
      <div className="state-actions">
        {!notPublished ? (
          <button className="primary-button" type="button" onClick={onRetry}>Try again</button>
        ) : null}
        <AppLink className={notPublished ? 'primary-button' : 'secondary-button'} href="/">Back to home</AppLink>
      </div>
    </div>
  );
}

function FaqSection({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const { faq } = useStorefrontCopy();
  const query = useQuery({
    queryKey: ['storefront-faq', bootstrap.pointer.contentVersion],
    queryFn: ({ signal }) => loadFaqSnapshot(bootstrap, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <section className="content-section faq-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{faq.kicker}</p>
          <h2>{faq.title}</h2>
        </div>
      </div>
      {query.isLoading && !query.data ? <div className="inline-loading">{faq.loading}</div> : null}
      {query.error && !query.data ? (
        <div className="inline-error inline-error-action">
          <span>{faq.unavailable}</span>
          <button type="button" onClick={() => void query.refetch()}>{faq.retry}</button>
        </div>
      ) : null}
      {query.data?.faqs.length === 0 ? <div className="inline-empty">{faq.empty}</div> : null}
      <div className="faq-list">
        {query.data?.faqs.map((item) => (
          <details key={item.id}>
            <summary>{item.title}</summary>
            <MarkdownContent source={item.body} />
          </details>
        ))}
      </div>
    </section>
  );
}

function HomePage({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const { site } = bootstrap.site;
  const { home } = bootstrap;
  const copy = useStorefrontCopy();
  const [showAllSections, setShowAllSections] = useState(false);
  const visibleSections = showAllSections ? home.allSections : home.sections;
  const canShowMore = site.navigation.showMore && home.allSections.length > home.sections.length;
  const heroVersion = bootstrap.pointer.schemaVersion === 2
    ? bootstrap.pointer.site.contentVersion
    : bootstrap.pointer.contentVersion;
  const heroQuery = useQuery({
    queryKey: ['storefront-hero', heroVersion],
    queryFn: ({ signal }) => loadPublishedHero(bootstrap, signal),
    enabled: bootstrap.pointer.schemaVersion === 2,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    document.documentElement.lang = 'en';
    document.title = site.name;
  }, [site.name]);

  return (
    <SiteShell site={site}>
      <HomepageAnalytics measurementId={site.analytics.ga4MeasurementId} />
      {heroQuery.data ? (
        <StorefrontHero
          LinkComponent={AppLink}
          slides={heroQuery.data.slides.map((slide) => ({
            id: slide.id,
            media: <HeroMedia slide={slide} />,
            title: slide.title,
            description: slide.description,
            cta: slide.cta,
          }))}
        />
      ) : null}

      <section className="content-section" id="services">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.home.sectionsKicker}</p>
            <h2>{copy.home.sectionsTitle}</h2>
          </div>
          {canShowMore ? (
            <button className="text-button" type="button" onClick={() => setShowAllSections((value) => !value)}>
              {showAllSections ? copy.home.showLess : copy.home.viewAll}
            </button>
          ) : null}
        </div>
        {visibleSections.length > 0 ? (
          <div className="section-grid">
            {visibleSections.map((section) => (
              <AppLink className="section-item" href={sectionHref(section)} key={section.id}>
                <span className="section-icon"><SectionIcon section={section} /></span>
                <span>{section.name}</span>
              </AppLink>
            ))}
          </div>
        ) : (
          <div className="inline-empty">{copy.home.emptySections}</div>
        )}
      </section>

      {site.navigation.showHot ? (
        <ProductCollection
          eyebrow={copy.home.featuredKicker}
          title={copy.home.featuredTitle}
          id="hot"
          products={home.featuredProducts}
        />
      ) : null}
      {site.navigation.showLatest ? (
        <ProductCollection
          eyebrow={copy.home.latestKicker}
          title={copy.home.latestTitle}
          id="latest"
          products={home.latestProducts}
        />
      ) : null}
    </SiteShell>
  );
}

function DiscoverPage({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const { site } = bootstrap.site;
  const { browse } = useStorefrontCopy();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const discoverProducts = useMemo(() => {
    const byId = new Map<string, PublicProductSummary>();
    for (const product of [...bootstrap.home.featuredProducts, ...bootstrap.home.latestProducts]) {
      if (!byId.has(product.id)) byId.set(product.id, product);
    }
    return [...byId.values()];
  }, [bootstrap.home.featuredProducts, bootstrap.home.latestProducts]);
  const filteredSections = useMemo(
    () => bootstrap.home.allSections.filter((section) => (
      !normalizedSearch || section.name.toLowerCase().includes(normalizedSearch)
    )),
    [bootstrap.home.allSections, normalizedSearch],
  );
  const filteredProducts = useMemo(
    () => discoverProducts.filter((product) => {
      if (!normalizedSearch) return true;
      return [
        product.title,
        product.sectionName,
        product.category.name ?? '',
        ...product.tags.map((tag) => tag.name),
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    }),
    [discoverProducts, normalizedSearch],
  );

  useEffect(() => {
    document.title = `${browse.title} · ${site.name}`;
  }, [browse.title, site.name]);

  const noResults = filteredSections.length === 0 && filteredProducts.length === 0;

  return (
    <SiteShell site={site}>
      <section className="discover-page" aria-labelledby="discover-title">
        <header className="app-page-heading">
          <div>
            <p className="app-page-kicker">{browse.kicker}</p>
            <h1 id="discover-title">{browse.title}</h1>
          </div>
        </header>

        <label className="discover-search">
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
          <section className="discover-section-block" aria-labelledby="discover-sections-title">
            <div className="discover-section-title">
              <h2 id="discover-sections-title">{browse.sectionsTitle}</h2>
              <span>{filteredSections.length}</span>
            </div>
            <div className="discover-section-grid">
              {filteredSections.map((section) => (
                <AppLink className="section-item" href={sectionHref(section)} key={section.id}>
                  <span className="section-icon"><SectionIcon section={section} /></span>
                  <span>{section.name}</span>
                </AppLink>
              ))}
            </div>
          </section>
        ) : null}

        {filteredProducts.length > 0 ? (
          <section className="discover-section-block" aria-labelledby="discover-products-title">
            <div className="discover-section-title">
              <h2 id="discover-products-title">{browse.productsTitle}</h2>
              <span>{filteredProducts.length}</span>
            </div>
            <div className="product-grid">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>
        ) : null}

        {noResults ? <div className="discover-results-empty">{browse.noResults}</div> : null}
      </section>
    </SiteShell>
  );
}

function MessagesPage({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const { messages } = useStorefrontCopy();
  useEffect(() => {
    document.title = `${messages.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, messages.title]);

  return (
    <SiteShell site={bootstrap.site.site}>
      <MessagesPageContent conversations={supportConversations} LinkComponent={AppLink} />
    </SiteShell>
  );
}

function MessagePage({
  bootstrap,
  conversationRef,
}: {
  bootstrap: StorefrontBootstrap;
  conversationRef: string;
}) {
  const { messages } = useStorefrontCopy();
  useEffect(() => {
    document.title = `${messages.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, messages.title]);

  const conversation = supportConversations.find((item) => item.id === conversationRef) ?? null;

  return (
    <SiteShell site={bootstrap.site.site}>
      <MessageThreadPageContent conversation={conversation ? null : null} LinkComponent={AppLink} />
    </SiteShell>
  );
}

function FaqPage({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const { faq } = useStorefrontCopy();
  useEffect(() => {
    document.title = `${faq.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, faq.title]);

  return (
    <SiteShell site={bootstrap.site.site}>
      <section className="faq-page" aria-labelledby="faq-page-title">
        <header className="app-page-heading">
          <div>
            <p className="app-page-kicker">{faq.kicker}</p>
            <h1 id="faq-page-title">{faq.title}</h1>
          </div>
        </header>
        <FaqSection bootstrap={bootstrap} />
      </section>
    </SiteShell>
  );
}

function SectionPage({ bootstrap, sectionRef }: { bootstrap: StorefrontBootstrap; sectionRef: string }) {
  const { section: sectionCopy } = useStorefrontCopy();
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
    const normalizedSearchValue = search.trim().toLowerCase();
    return source.filter((product) => {
      if (categoryId && product.category.id !== categoryId) return false;
      if (selectedTags.size > 0) {
        const productTagIds = new Set(product.tags.map((tag) => tag.id));
        if (![...selectedTags].every((tagId) => productTagIds.has(tagId))) return false;
      }
      if (!normalizedSearchValue) return true;
      return [
        product.title,
        product.category.name ?? '',
        product.sectionName,
        ...product.tags.map((tag) => tag.name),
      ].some((value) => value.toLowerCase().includes(normalizedSearchValue));
    });
  }, [categoryId, query.data?.products, search, selectedTags]);

  useEffect(() => {
    if (query.data) document.title = `${query.data.section.name} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, query.data]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const resultWord = filteredProducts.length === 1
    ? sectionCopy.resultSingular
    : sectionCopy.resultPlural;

  return (
    <SiteShell site={bootstrap.site.site}>
      {query.isLoading && !query.data ? <div className="inline-loading page-loading">{sectionCopy.loading}</div> : null}
      {query.error && !query.data ? (
        <RouteErrorState error={query.error} resource="section" onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <>
          <section className="section-page-header">
            <AppLink className="back-link" href="/browse/">← {sectionCopy.backLabel}</AppLink>
            <div className="section-page-title">
              <span className="section-icon large"><SectionIcon section={query.data.section} /></span>
              <div>
                <p className="eyebrow">{sectionCopy.kicker}</p>
                <h1>{query.data.section.name}</h1>
                <p>{query.data.products.length} {query.data.products.length === 1 ? sectionCopy.resultSingular : sectionCopy.resultPlural}</p>
              </div>
            </div>
          </section>

          <section className="filter-panel" aria-label="Service filters">
            <label className="search-field">
              <span>{sectionCopy.searchLabel}</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={sectionCopy.searchPlaceholder} />
            </label>
            <label className="select-field">
              <span>{sectionCopy.typeLabel}</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">{sectionCopy.allTypes}</option>
                {query.data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {query.data.tags.length > 0 ? (
              <div className="tag-filter" aria-label="Filter by tags">
                {query.data.tags.map((tag) => (
                  <button
                    className={selectedTags.has(tag.id) ? 'is-active' : undefined}
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <div className="result-toolbar">
            <strong>{filteredProducts.length} {resultWord}</strong>
            {(search || categoryId || selectedTags.size > 0) ? (
              <button type="button" onClick={() => {
                setSearch('');
                setCategoryId('');
                setSelectedTags(new Set());
              }}>{sectionCopy.clearFilters}</button>
            ) : null}
          </div>

          {filteredProducts.length > 0 ? (
            <div className="product-grid section-product-grid">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="inline-empty">{sectionCopy.emptyResults}</div>
          )}
        </>
      ) : null}
    </SiteShell>
  );
}

function ProductPage({
  bootstrap,
  productRef,
  sectionRef,
}: {
  bootstrap: StorefrontBootstrap;
  productRef: string;
  sectionRef: string | null;
}) {
  const { product: productCopy } = useStorefrontCopy();
  const query = useQuery({
    queryKey: ['storefront-product', bootstrap.pointer.contentVersion, sectionRef, productRef],
    queryFn: ({ signal }) => loadProductSnapshot(bootstrap, productRef, signal, sectionRef),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const productMedia = query.data?.product.media.filter((media) => Boolean(media.url)) ?? [];

  useEffect(() => {
    if (query.data) document.title = `${query.data.product.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, query.data]);

  return (
    <SiteShell site={bootstrap.site.site}>
      {query.isLoading && !query.data ? <div className="inline-loading page-loading">{productCopy.loading}</div> : null}
      {query.error && !query.data ? (
        <RouteErrorState error={query.error} resource="product" onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <article className="product-detail">
          <AppLink
            className="back-link"
            href={sectionHref({ id: query.data.product.sectionId, slug: query.data.product.sectionSlug })}
          >
            ← {query.data.product.sectionName}
          </AppLink>

          <div className="detail-gallery">
            {productMedia.length > 0 ? productMedia.map((media) => {
              if (!media.url) return null;
              const fallback = <div className="detail-media-fallback">{productCopy.mediaUnavailable}</div>;
              return isVideoMediaUrl(media.url) ? (
                <ResilientVideo
                  aria-label={media.altText || query.data.product.title}
                  controls
                  fallback={fallback}
                  key={media.id}
                  playsInline
                  preload="metadata"
                  src={media.url}
                />
              ) : (
                <ResilientImage
                  alt={media.altText || query.data.product.title}
                  fallback={fallback}
                  key={media.id}
                  src={media.url}
                />
              );
            }) : query.data.product.coverUrl ? (
              <ResilientImage
                alt={query.data.product.title}
                fallback={<div className="detail-media-fallback">{productCopy.imageUnavailable}</div>}
                src={query.data.product.coverUrl}
              />
            ) : (
              <div className="detail-media-fallback">{productCopy.noMedia}</div>
            )}
          </div>

          <div className="detail-layout">
            <div className="detail-main">
              <div className="detail-heading">
                <p className="eyebrow">
                  {query.data.product.serviceMode === 'online' ? productCopy.onlineKicker : productCopy.offlineKicker}
                </p>
                <h1>{query.data.product.title}</h1>
                {query.data.product.category.name ? (
                  <p className="detail-type"><span>{productCopy.typeLabel}</span>{query.data.product.category.name}</p>
                ) : null}
                {query.data.product.tags.length > 0 ? (
                  <div className="tag-row detail-tags">
                    {query.data.product.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}
                  </div>
                ) : null}
                {query.data.product.address ? <address>⌖ {query.data.product.address}</address> : null}
              </div>
              <section className="detail-description">
                <h2>{productCopy.aboutTitle}</h2>
                <MarkdownContent source={query.data.product.body} />
              </section>
            </div>

            {query.data.product.cta ? (
              <aside className="contact-card">
                <span>{productCopy.contactKicker}</span>
                <strong>{query.data.product.cta.label}</strong>
                <p>{productCopy.contactHint}</p>
                <a className="cta-button" href={query.data.product.cta.path} rel="nofollow">
                  {query.data.product.cta.label}
                </a>
              </aside>
            ) : null}
          </div>

          {query.data.product.cta ? (
            <div className="mobile-cta-bar">
              <a className="cta-button" href={query.data.product.cta.path} rel="nofollow">
                {query.data.product.cta.label}
              </a>
            </div>
          ) : null}
        </article>
      ) : null}
    </SiteShell>
  );
}

export function App() {
  const pathname = usePathname();
  const route = useMemo(() => parseStorefrontRoute(pathname), [pathname]);
  const bootstrapQuery = useQuery({
    queryKey: ['storefront-bootstrap'],
    queryFn: ({ signal }) => loadStorefrontBootstrap(undefined, signal),
    staleTime: 30_000,
  });
  const copyQuery = useQuery({
    queryKey: ['storefront-copy'],
    queryFn: ({ signal }) => loadStorefrontCopy(signal),
    staleTime: 30_000,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  if (bootstrapQuery.isLoading) return <LoadingPage />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <ErrorPage error={bootstrapQuery.error} />;

  let page: ReactNode;
  switch (route.type) {
    case 'home':
      page = <HomePage bootstrap={bootstrapQuery.data} />;
      break;
    case 'discover':
      page = <DiscoverPage bootstrap={bootstrapQuery.data} />;
      break;
    case 'messages':
      page = <MessagesPage bootstrap={bootstrapQuery.data} />;
      break;
    case 'message':
      page = (
        <MessagePage
          bootstrap={bootstrapQuery.data}
          conversationRef={route.conversationRef}
        />
      );
      break;
    case 'faq':
      page = <FaqPage bootstrap={bootstrapQuery.data} />;
      break;
    case 'section':
      page = <SectionPage bootstrap={bootstrapQuery.data} sectionRef={route.sectionRef} />;
      break;
    case 'product':
      page = (
        <ProductPage
          bootstrap={bootstrapQuery.data}
          productRef={route.productRef}
          sectionRef={route.sectionRef}
        />
      );
      break;
    default:
      page = <NotFoundPage site={bootstrapQuery.data.site.site} />;
  }

  return (
    <StorefrontCopyProvider value={copyQuery.data ?? FALLBACK_STOREFRONT_COPY}>
      {page}
    </StorefrontCopyProvider>
  );
}
