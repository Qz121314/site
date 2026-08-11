import { useQuery } from '@tanstack/react-query';
import {
  StorefrontHero,
  type StorefrontLinkComponent,
} from '@site/storefront-ui';
import {
  type AnchorHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
} from 'react';
import {
  loadSectionSnapshot,
  type PublicHeroSlide,
  type PublicProductSummary,
  type PublicSection,
  type StorefrontBootstrap,
} from './content';
import { loadHomeLayout, resolveHomeLayout } from './home-layout';
import { ResilientImage, ResilientVideo } from './ResilientMedia';
import { productHref, sectionHref } from './routing';
import { SYSTEM_UI } from './system-ui';

const NAVIGATION_EVENT = 'storefront:navigate';

function HomeLink({
  href = '/',
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
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
    window.history.pushState(null, '', href);
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
  };

  return <a {...props} href={href} onClick={handleClick} />;
}

function isVideoMediaUrl(value: string): boolean {
  try {
    const pathname = new URL(value, window.location.origin).pathname.toLowerCase();
    return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
  } catch {
    return /\.(?:mp4|webm)(?:$|[?#])/i.test(value);
  }
}

function HeroMedia({ slide }: { slide: PublicHeroSlide }) {
  const fallback = <div className="hero-media-fallback" aria-hidden="true" />;
  if (slide.mediaKind === 'video' || isVideoMediaUrl(slide.mediaUrl)) {
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
  return <ResilientImage alt="" fallback={fallback} src={slide.mediaUrl} />;
}

function SectionIcon({ section }: { section: PublicSection }) {
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
  return <span aria-hidden="true">{section.icon.value || fallback}</span>;
}

function MoreIcon() {
  return (
    <span className="home-more-glyph" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function HomeShortcuts({ sections }: { sections: PublicSection[] }) {
  return (
    <nav className="home-shortcuts" aria-label="Sections">
      {sections.map((section) => (
        <HomeLink
          className="home-shortcut"
          href={sectionHref(section)}
          key={section.id}
        >
          <span className="home-shortcut-icon">
            <SectionIcon section={section} />
          </span>
          <span className="home-shortcut-label">{section.name}</span>
        </HomeLink>
      ))}
      <HomeLink className="home-shortcut is-more" href="/browse/">
        <span className="home-shortcut-icon">
          <MoreIcon />
        </span>
        <span className="home-shortcut-label">{SYSTEM_UI.more}</span>
      </HomeLink>
    </nav>
  );
}

function HomeProductTile({ product }: { product: PublicProductSummary }) {
  return (
    <HomeLink className="home-product-tile" href={productHref(product)}>
      <span className="home-product-cover">
        <ResilientImage
          alt=""
          fallback={
            <span className="home-product-cover-fallback" aria-hidden="true" />
          }
          loading="lazy"
          src={product.coverUrl}
        />
      </span>
      <strong>{product.title}</strong>
    </HomeLink>
  );
}

function HomeRecommendationRail({
  bootstrap,
  initialProducts,
  section,
}: {
  bootstrap: StorefrontBootstrap;
  initialProducts: PublicProductSummary[];
  section: PublicSection;
}) {
  const query = useQuery({
    queryKey: [
      'storefront-home-recommendation',
      bootstrap.pointer.contentVersion,
      section.id,
    ],
    queryFn: ({ signal }) => loadSectionSnapshot(bootstrap, section.id, signal),
    enabled: initialProducts.length === 0,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const products = useMemo(
    () =>
      (initialProducts.length > 0
        ? initialProducts
        : (query.data?.products ?? [])
      )
        .filter((product) => product.isFeatured)
        .sort(
          (left, right) =>
            left.featuredOrder - right.featuredOrder ||
            left.sortOrder - right.sortOrder ||
            left.title.localeCompare(right.title),
        ),
    [initialProducts, query.data?.products],
  );

  if (query.error || (query.data && products.length === 0)) return null;

  return (
    <section
      className="home-recommendation"
      aria-labelledby={`home-recommendation-${section.id}`}
    >
      <div className="home-recommendation-heading">
        <h2 id={`home-recommendation-${section.id}`}>{section.name}</h2>
        <HomeLink
          href={sectionHref(section)}
          aria-label={`${SYSTEM_UI.more}: ${section.name}`}
        >
          <span aria-hidden="true">›</span>
        </HomeLink>
      </div>
      {initialProducts.length === 0 && query.isLoading && !query.data ? (
        <div className="home-product-rail is-loading" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <span className="home-product-skeleton" key={index} />
          ))}
        </div>
      ) : (
        <div className="home-product-rail">
          {products.map((product) => (
            <HomeProductTile product={product} key={product.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function fallbackRecommendationSectionIds(bootstrap: StorefrontBootstrap): string[] {
  const ids: string[] = [];
  for (const product of bootstrap.home.featuredProducts) {
    if (!ids.includes(product.sectionId)) ids.push(product.sectionId);
    if (ids.length === 3) break;
  }
  return ids;
}

function publishedSections(bootstrap: StorefrontBootstrap): PublicSection[] {
  if (bootstrap.pointer.schemaVersion !== 2) return bootstrap.home.allSections;
  const published = new Set(Object.keys(bootstrap.pointer.sections));
  return bootstrap.home.allSections.filter((section) => published.has(section.id));
}

export function HomeFeed({ bootstrap }: { bootstrap: StorefrontBootstrap }) {
  const { site } = bootstrap.site;
  const layoutQuery = useQuery({
    queryKey: ['storefront-home-layout', bootstrap.pointer.contentVersion],
    queryFn: ({ signal }) => loadHomeLayout(bootstrap.pointer.contentVersion, signal),
    staleTime: 30_000,
  });
  const availableSections = useMemo(
    () => publishedSections(bootstrap),
    [bootstrap],
  );
  const publishedSectionIds = useMemo(
    () => new Set(availableSections.map((section) => section.id)),
    [availableSections],
  );
  const sectionById = useMemo(
    () => new Map(availableSections.map((section) => [section.id, section])),
    [availableSections],
  );
  const featuredProductsBySection = useMemo(() => {
    const groups = new Map<string, PublicProductSummary[]>();
    for (const product of bootstrap.home.featuredProducts) {
      const group = groups.get(product.sectionId) ?? [];
      group.push(product);
      groups.set(product.sectionId, group);
    }
    for (const group of groups.values()) {
      group.sort(
        (left, right) =>
          left.featuredOrder - right.featuredOrder ||
          left.sortOrder - right.sortOrder ||
          left.title.localeCompare(right.title),
      );
    }
    return groups;
  }, [bootstrap.home.featuredProducts]);
  const fallbackLayout = {
    shortcutSectionIds: availableSections.slice(0, 7).map((section) => section.id),
    recommendationSectionIds: fallbackRecommendationSectionIds(bootstrap),
  };
  const layout = resolveHomeLayout(
    layoutQuery.data,
    fallbackLayout,
    publishedSectionIds,
  );
  const shortcutSections = layout.shortcutSectionIds
    .flatMap((id) =>
      sectionById.get(id) ? [sectionById.get(id) as PublicSection] : [],
    )
    .slice(0, 7);
  const recommendationSections = layout.recommendationSectionIds
    .flatMap((id) =>
      sectionById.get(id) ? [sectionById.get(id) as PublicSection] : [],
    )
    .slice(0, 3);

  useEffect(() => {
    document.documentElement.lang = 'en';
    document.title = site.name;
  }, [site.name]);

  return (
    <>
      {site.hero ? (
        <StorefrontHero
          LinkComponent={HomeLink as StorefrontLinkComponent}
          slides={site.hero.slides.map((slide) => ({
            id: slide.id,
            media: <HeroMedia slide={slide} />,
            title: slide.title,
            description: slide.description,
            cta: slide.cta,
          }))}
        />
      ) : null}

      <HomeShortcuts sections={shortcutSections} />

      <div className="home-recommendation-feed">
        {recommendationSections.map((section) => (
          <HomeRecommendationRail
            bootstrap={bootstrap}
            initialProducts={featuredProductsBySection.get(section.id) ?? []}
            section={section}
            key={section.id}
          />
        ))}
      </div>
    </>
  );
}
