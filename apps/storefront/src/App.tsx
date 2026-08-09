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
      modeLabel={product.serviceMode === 'online' ? 'Online' : 'In person'}
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
  const unreadMessages = supportConversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  return (
    <StorefrontBottomNavigation
      activeHref={bottomNavigationActiveHref(pathname)}
      items={primaryNavigationItems(unreadMessages)}
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
  const query = useQuery({
    queryKey: ['storefront-faq', bootstrap.pointer.contentVersion],
    queryFn: ({ signal }) => loadFaqSnapshot(bootstrap, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <section className="content-section faq-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Need to know</p>
          <h2>Frequently asked questions</h2>
        </div>
      </div>
      {query.isLoading && !query.data ? <div className="inline-loading">Loading FAQ…</div> : null}
      {query.error && !query.data ? (
        <div className="inline-error inline-error-action">
          <span>FAQ is temporarily unavailable.</span>
          <button type="button" onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : null}
      {query.data?.faqs.length === 0 ? <div className="inline-empty">No FAQs are published yet.</div> : null}
      <div className="faq-list">
        {query.data?.faqs.map((faq) => (
          <details key={faq.id}>
            <summary>{faq.title}</summary>
            <MarkdownContent source={faq.body} />
          </details>
        ))}
      </div>
    </section>
  );
}

function HomePage({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const { site } = bootstrap.site;
  const { home } = bootstrap;
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
            <p className="eyebrow">Explore</p>
            <h2>Services</h2>
          </div>
          {canShowMore ? (
            <button className="text-button" type="button" onClick={() => setShowAllSections((value) => !value)}>
              {showAllSections ? 'Show less' : 'View all'}
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
          <div className="inline-empty">No services are published yet.</div>
        )}
      </section>

      {site.navigation.showHot ? (
        <ProductCollection eyebrow="Popular now" title="Hot picks" id="hot" products={home.featuredProducts} />
      ) : null}
      {site.navigation.showLatest ? (
        <ProductCollection eyebrow="Recently added" title="Latest services" id="latest" products={home.latestProducts} />
      ) : null}
    </SiteShell>
  );
}

function DiscoverPage({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const { site } = bootstrap.site;
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
    document.title = `发现 · ${site.name}`;
  }, [site.name]);

  const noResults = filteredSections.length === 0 && filteredProducts.length === 0;

  return (
    <SiteShell site={site}>
      <section className="discover-page" aria-labelledby="discover-title">
        <header className="app-page-heading">
          <div>
            <p className="app-page-kicker">Explore</p>
            <h1 id="discover-title">发现</h1>
          </div>
        </header>

        <label className="discover-search">
          <SearchIcon />
          <input
            type="search"
            value={search}
            placeholder="搜索分区、产品或标签"
            aria-label="搜索发现内容"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        {filteredSections.length > 0 ? (
          <section className="discover-section-block" aria-labelledby="discover-sections-title">
            <div className="discover-section-title">
              <h2 id="discover-sections-title">分区</h2>
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
              <h2 id="discover-products-title">产品</h2>
              <span>{filteredProducts.length}</span>
            </div>
            <div className="product-grid">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>
        ) : null}

        {noResults ? <div className="discover-results-empty">没有找到匹配的内容。</div> : null}
      </section>
    </SiteShell>
  );
}

function MessagesPage({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  useEffect(() => {
    document.title = `消息 · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name]);

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
  useEffect(() => {
    document.title = `消息 · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name]);

  const conversation = supportConversations.find((item) => item.id === conversationRef) ?? null;

  return (
    <SiteShell site={bootstrap.site.site}>
      <MessageThreadPageContent conversation={conversation ? null : null} LinkComponent={AppLink} />
    </SiteShell>
  );
}

function FaqPage({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  useEffect(() => {
    document.title = `FAQ · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name]);

  return (
    <SiteShell site={bootstrap.site.site}>
      <section className="faq-page" aria-labelledby="faq-page-title">
        <header className="app-page-heading">
          <div>
            <p className="app-page-kicker">Help</p>
            <h1 id="faq-page-title">FAQ</h1>
          </div>
        </header>
        <FaqSection bootstrap={bootstrap} />
      </section>
    </SiteShell>
  );
}

function SectionPage({ bootstrap, sectionRef }: { bootstrap: StorefrontBootstrap; sectionRef: string }) {
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

  return (
    <SiteShell site={bootstrap.site.site}>
      {query.isLoading && !query.data ? <div className="inline-loading page-loading">Loading services…</div> : null}
      {query.error && !query.data ? (
        <RouteErrorState error={query.error} resource="section" onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <>
          <section className="section-page-header">
            <AppLink className="back-link" href="/discover/">← 发现</AppLink>
            <div className="section-page-title">
              <span className="section-icon large"><SectionIcon section={query.data.section} /></span>
              <div>
                <p className="eyebrow">Browse services</p>
                <h1>{query.data.section.name}</h1>
                <p>{query.data.products.length} published service{query.data.products.length === 1 ? '' : 's'}</p>
              </div>
            </div>
          </section>

          <section className="filter-panel" aria-label="Service filters">
            <label className="search-field">
              <span>Search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, type or tag" />
            </label>
            <label className="select-field">
              <span>Service type</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">All types</option>
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
            <strong>{filteredProducts.length} result{filteredProducts.length === 1 ? '' : 's'}</strong>
            {(search || categoryId || selectedTags.size > 0) ? (
              <button type="button" onClick={() => {
                setSearch('');
                setCategoryId('');
                setSelectedTags(new Set());
              }}>Clear filters</button>
            ) : null}
          </div>

          {filteredProducts.length > 0 ? (
            <div className="product-grid section-product-grid">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="inline-empty">No services match these filters.</div>
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
      {query.isLoading && !query.data ? <div className="inline-loading page-loading">Loading service…</div> : null}
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
              const fallback = <div className="detail-media-fallback">Media unavailable</div>;
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
                fallback={<div className="detail-media-fallback">Image unavailable</div>}
                src={query.data.product.coverUrl}
              />
            ) : (
              <div className="detail-media-fallback">No media available</div>
            )}
          </div>

          <div className="detail-layout">
            <div className="detail-main">
              <div className="detail-heading">
                <p className="eyebrow">{query.data.product.serviceMode === 'online' ? 'Online service' : 'In-person service'}</p>
                <h1>{query.data.product.title}</h1>
                {query.data.product.category.name ? (
                  <p className="detail-type"><span>Service type</span>{query.data.product.category.name}</p>
                ) : null}
                {query.data.product.tags.length > 0 ? (
                  <div className="tag-row detail-tags">
                    {query.data.product.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}
                  </div>
                ) : null}
                {query.data.product.address ? <address>⌖ {query.data.product.address}</address> : null}
              </div>
              <section className="detail-description">
                <h2>About this service</h2>
                <MarkdownContent source={query.data.product.body} />
              </section>
            </div>

            {query.data.product.cta ? (
              <aside className="contact-card">
                <span>Ready to connect?</span>
                <strong>{query.data.product.cta.label}</strong>
                <p>The available contact destination is selected when you continue.</p>
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  if (bootstrapQuery.isLoading) return <LoadingPage />;
  if (bootstrapQuery.error || !bootstrapQuery.data) return <ErrorPage error={bootstrapQuery.error} />;

  switch (route.type) {
    case 'home':
      return <HomePage bootstrap={bootstrapQuery.data} />;
    case 'discover':
      return <DiscoverPage bootstrap={bootstrapQuery.data} />;
    case 'messages':
      return <MessagesPage bootstrap={bootstrapQuery.data} />;
    case 'message':
      return (
        <MessagePage
          bootstrap={bootstrapQuery.data}
          conversationRef={route.conversationRef}
        />
      );
    case 'faq':
      return <FaqPage bootstrap={bootstrapQuery.data} />;
    case 'section':
      return <SectionPage bootstrap={bootstrapQuery.data} sectionRef={route.sectionRef} />;
    case 'product':
      return (
        <ProductPage
          bootstrap={bootstrapQuery.data}
          productRef={route.productRef}
          sectionRef={route.sectionRef}
        />
      );
    default:
      return <NotFoundPage site={bootstrapQuery.data.site.site} />;
  }
}
