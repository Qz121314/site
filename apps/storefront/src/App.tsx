import { useQuery } from '@tanstack/react-query';
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
import { MarkdownContent } from './MarkdownContent';

type Route =
  | { type: 'home' }
  | { type: 'section'; id: string }
  | { type: 'product'; id: string }
  | { type: 'not-found' };

const NAVIGATION_EVENT = 'storefront:navigate';

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

function decodeRoutePart(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded && decoded.length <= 120 ? decoded : null;
  } catch {
    return null;
  }
}

function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { type: 'home' };
  const sectionMatch = /^\/sections\/([^/]+)\/?$/.exec(pathname);
  if (sectionMatch) {
    const id = decodeRoutePart(sectionMatch[1] ?? '');
    return id ? { type: 'section', id } : { type: 'not-found' };
  }
  const productMatch = /^\/products\/([^/]+)\/?$/.exec(pathname);
  if (productMatch) {
    const id = decodeRoutePart(productMatch[1] ?? '');
    return id ? { type: 'product', id } : { type: 'not-found' };
  }
  return { type: 'not-found' };
}

function navigate(href: string) {
  window.history.pushState(null, '', href);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
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

function SectionIcon({ section }: { section: PublicSection }) {
  if (section.icon.type === 'image' && section.icon.value) {
    return <img alt="" loading="lazy" src={section.icon.value} />;
  }
  return <span aria-hidden="true">{section.icon.value || section.name.slice(0, 1)}</span>;
}

function ProductCard({ product }: { product: PublicProductSummary }) {
  return (
    <AppLink className="product-card" href={`/products/${encodeURIComponent(product.id)}/`}>
      <div className="product-card-media">
        {product.coverUrl ? (
          <img alt="" loading="lazy" src={product.coverUrl} />
        ) : (
          <div className="image-fallback" aria-hidden="true" />
        )}
        <span className="service-mode-badge">
          {product.serviceMode === 'online' ? 'Online' : 'In person'}
        </span>
      </div>
      <div className="product-card-body">
        <div className="product-card-heading">
          <h3>{product.title}</h3>
          <span>{product.sectionName}</span>
        </div>
        {product.category.name ? <p className="product-type">{product.category.name}</p> : null}
        {product.tags.length > 0 ? (
          <div className="tag-row" aria-label="Product tags">
            {product.tags.slice(0, 3).map((tag) => <span key={tag.id}>{tag.name}</span>)}
          </div>
        ) : null}
        {product.address ? <p className="product-address">⌖ {product.address}</p> : null}
      </div>
    </AppLink>
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

function BottomNavigation({ site }: { site: PublicSite }) {
  const items = [
    { label: 'Home', icon: '⌂', href: '/', enabled: true },
    { label: 'Hot', icon: '◆', href: '/#hot', enabled: site.navigation.showHot },
    { label: 'Latest', icon: '◷', href: '/#latest', enabled: site.navigation.showLatest },
    { label: 'FAQ', icon: '?', href: '/#faq', enabled: site.navigation.showFaq },
  ].filter((item) => item.enabled);

  return (
    <nav
      className="bottom-nav"
      aria-label="Primary navigation"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => (
        <a className={index === 0 ? 'is-active' : undefined} href={item.href} key={item.label}>
          <span aria-hidden="true">{item.icon}</span>
          <small>{item.label}</small>
        </a>
      ))}
    </nav>
  );
}

function SiteShell({ site, children }: { site: PublicSite; children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <AppLink className="brand-lockup" href="/">
          <span className="brand-logo">
            {site.logoUrl ? <img alt="" src={site.logoUrl} /> : site.name.slice(0, 1)}
          </span>
          <span>
            <strong>{site.name}</strong>
            <small>⌖ {site.locationLabel}</small>
          </span>
        </AppLink>
        <span className="site-language">EN</span>
      </header>
      <main>{children}</main>
      <footer className="site-footer">{site.name}</footer>
      <BottomNavigation site={site} />
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="app-shell loading-shell" aria-busy="true">
      <header className="topbar"><div className="loading-brand" /></header>
      <main>
        <div className="loading-hero" />
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

function FaqSection({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const query = useQuery({
    queryKey: ['storefront-faq', bootstrap.pointer.contentVersion],
    queryFn: ({ signal }) => loadFaqSnapshot(bootstrap, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (!bootstrap.site.site.navigation.showFaq) return null;
  return (
    <section className="content-section faq-section" id="faq">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Need to know</p>
          <h2>Frequently asked questions</h2>
        </div>
      </div>
      {query.isLoading ? <div className="inline-loading">Loading FAQ…</div> : null}
      {query.error ? <div className="inline-error">FAQ is temporarily unavailable.</div> : null}
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

  useEffect(() => {
    document.documentElement.lang = 'en';
    document.title = site.name;
  }, [site.name]);

  return (
    <SiteShell site={site}>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Discover nearby</p>
          <h1>Find the right service, faster.</h1>
          <p className="hero-copy">Browse verified listings and connect through the available contact option.</p>
        </div>
        <span className="hero-location">⌖ {site.locationLabel}</span>
      </section>

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
              <AppLink className="section-item" href={`/sections/${encodeURIComponent(section.id)}/`} key={section.id}>
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
      <FaqSection bootstrap={bootstrap} />
    </SiteShell>
  );
}

function SectionPage({ bootstrap, sectionId }: { bootstrap: StorefrontBootstrap; sectionId: string }) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(() => new Set());
  const query = useQuery({
    queryKey: ['storefront-section', bootstrap.pointer.contentVersion, sectionId],
    queryFn: ({ signal }) => loadSectionSnapshot(bootstrap, sectionId, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const filteredProducts = useMemo(() => {
    const source = query.data?.products ?? [];
    const normalizedSearch = search.trim().toLowerCase();
    return source.filter((product) => {
      if (categoryId && product.category.id !== categoryId) return false;
      if (selectedTags.size > 0) {
        const productTagIds = new Set(product.tags.map((tag) => tag.id));
        if (![...selectedTags].every((tagId) => productTagIds.has(tagId))) return false;
      }
      if (!normalizedSearch) return true;
      return [
        product.title,
        product.category.name ?? '',
        product.sectionName,
        ...product.tags.map((tag) => tag.name),
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
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
      {query.isLoading ? <div className="inline-loading page-loading">Loading services…</div> : null}
      {query.error ? <div className="inline-error page-loading">This service section is unavailable.</div> : null}
      {query.data ? (
        <>
          <section className="section-page-header">
            <AppLink className="back-link" href="/">← Home</AppLink>
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

function ProductPage({ bootstrap, productId }: { bootstrap: StorefrontBootstrap; productId: string }) {
  const query = useQuery({
    queryKey: ['storefront-product', bootstrap.pointer.contentVersion, productId],
    queryFn: ({ signal }) => loadProductSnapshot(bootstrap, productId, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (query.data) document.title = `${query.data.product.title} · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name, query.data]);

  return (
    <SiteShell site={bootstrap.site.site}>
      {query.isLoading ? <div className="inline-loading page-loading">Loading service…</div> : null}
      {query.error ? <div className="inline-error page-loading">This service is unavailable.</div> : null}
      {query.data ? (
        <article className="product-detail">
          <AppLink className="back-link" href={`/sections/${encodeURIComponent(query.data.product.sectionId)}/`}>
            ← {query.data.product.sectionName}
          </AppLink>

          <div className="detail-gallery">
            {query.data.product.media.length > 0 ? query.data.product.media.map((media) => (
              media.url ? <img alt={media.altText || query.data.product.title} key={media.id} src={media.url} /> : null
            )) : query.data.product.coverUrl ? (
              <img alt={query.data.product.title} src={query.data.product.coverUrl} />
            ) : null}
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
  const route = useMemo(() => parseRoute(pathname), [pathname]);
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
    case 'section':
      return <SectionPage bootstrap={bootstrapQuery.data} sectionId={route.id} />;
    case 'product':
      return <ProductPage bootstrap={bootstrapQuery.data} productId={route.id} />;
    default:
      return <NotFoundPage site={bootstrapQuery.data.site.site} />;
  }
}
