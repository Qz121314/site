import { useQuery } from '@tanstack/react-query';
import {
  StorefrontHero,
  StorefrontHomeProductTile,
  StorefrontHomeShortcut,
  type StorefrontHeroSlide,
} from '@site/storefront-ui';
import {
  type AnchorHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
} from 'react';
import {
  publicImageVariantUrl,
  type PublicHeroSlide,
  type PublicProductSummary,
  type PublicSection,
  type StorefrontBootstrap,
} from './content';
import { resolveHomeLayout, resolveHomeShortcuts } from './home-layout';
import { ResilientImage, ResilientVideo } from './ResilientMedia';
import { productHref, sectionHref } from './routing';
import { handleStorefrontLinkClick } from './storefront-navigation-runtime';
import { SYSTEM_UI } from './system-ui';

function HomeLink({
  href = '/',
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    handleStorefrontLinkClick(event, href);
  };

  return <a {...props} href={href} onClick={handleClick} />;
}

function HomeHero({ siteName, slides }: { siteName: string; slides: PublicHeroSlide[] }) {
  const availableSlides = slides.filter((slide) => slide.mediaUrl.trim());
  const sharedSlides: StorefrontHeroSlide[] = availableSlides.map((slide, index) => {
    const mediaFallback = (
      <span className="hero-carousel-media-fallback" aria-hidden="true" />
    );
    const media =
      slide.mediaKind === 'video' ? (
        <ResilientVideo
          aria-label={slide.title || siteName}
          autoPlay={index === 0}
          fallback={mediaFallback}
          loop
          muted
          playsInline
          preload={index === 0 ? 'auto' : 'none'}
          src={slide.mediaUrl}
        />
      ) : (
        <ResilientImage
          alt={slide.title || ''}
          fallback={mediaFallback}
          fetchPriority={index === 0 ? 'high' : 'low'}
          loading={index === 0 ? 'eager' : 'lazy'}
          src={slide.mediaUrl}
        />
      );

    return {
      id: slide.id,
      media,
      title: slide.title,
      description: slide.description,
      cta: slide.cta,
    };
  });

  return (
    <StorefrontHero ariaLabel={siteName} LinkComponent={HomeLink} slides={sharedSlides} />
  );
}

function SectionIcon({ section }: { section: PublicSection }) {
  const fallback = (
    <span aria-hidden="true">{Array.from(section.name.trim())[0] ?? '•'}</span>
  );
  if (section.icon.type === 'image' && section.icon.value) {
    const src = publicImageVariantUrl(section.icon.objectKey, 160) ?? section.icon.value;
    const srcSet = section.icon.objectKey
      ? ([96, 160, 240] as const)
          .map(
            (width) =>
              `${publicImageVariantUrl(section.icon.objectKey, width)} ${width}w`,
          )
          .join(', ')
      : undefined;
    return (
      <ResilientImage
        alt=""
        decoding="async"
        fallback={fallback}
        fetchPriority="low"
        height={160}
        loading="lazy"
        sizes="58px"
        src={src}
        srcSet={srcSet}
        width={160}
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

function HomeShortcuts({
  sections,
  showMore,
}: {
  sections: PublicSection[];
  showMore: boolean;
}) {
  return (
    <div className="home-shortcut-zone">
      <nav className="home-shortcuts home-shortcut-hero" aria-label="Sections">
        {sections.map((section) => (
          <StorefrontHomeShortcut
            href={sectionHref(section)}
            icon={<SectionIcon section={section} />}
            key={section.id}
            label={section.name}
            LinkComponent={HomeLink}
          />
        ))}
        {showMore ? (
          <StorefrontHomeShortcut
            href="/browse/"
            icon={<MoreIcon />}
            isMore
            label={SYSTEM_UI.more}
            LinkComponent={HomeLink}
          />
        ) : null}
      </nav>
    </div>
  );
}

function HomeProductTile({
  priority,
  product,
}: {
  priority: boolean;
  product: PublicProductSummary;
}) {
  const src = publicImageVariantUrl(product.coverObjectKey, 640) ?? product.coverUrl;
  const srcSet = product.coverObjectKey
    ? ([384, 640, 960] as const)
        .map(
          (width) => `${publicImageVariantUrl(product.coverObjectKey, width)} ${width}w`,
        )
        .join(', ')
    : undefined;

  return (
    <StorefrontHomeProductTile
      href={productHref(product)}
      LinkComponent={HomeLink}
      media={
        <ResilientImage
          alt=""
          fallback={<span className="home-product-cover-fallback" aria-hidden="true" />}
          fetchPriority={priority ? 'high' : 'low'}
          height={640}
          loading={priority ? 'eager' : 'lazy'}
          sizes="(max-width: 767px) 44vw, 176px"
          src={src}
          srcSet={srcSet}
          width={640}
        />
      }
      title={product.title}
    />
  );
}

function HomeRecommendationRail({
  bootstrap,
  initialProducts,
  priority,
  section,
}: {
  bootstrap: StorefrontBootstrap;
  initialProducts: PublicProductSummary[];
  priority: boolean;
  section: PublicSection;
}) {
  const query = useQuery({
    queryKey: ['storefront-section', bootstrap.pointer.contentVersion, section.id],
    queryFn: async ({ signal }) => {
      const { loadSectionSnapshot } = await import('./content-route');
      return loadSectionSnapshot(bootstrap, section.id, signal);
    },
    enabled: initialProducts.length === 0,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const products = useMemo(
    () =>
      (initialProducts.length > 0 ? initialProducts : (query.data?.products ?? []))
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
        <span className="home-recommendation-heading-copy">
          <h2 id={`home-recommendation-${section.id}`}>{section.name}</h2>
          {section.description ? <p>{section.description}</p> : null}
        </span>
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
          {products.map((product, index) => (
            <HomeProductTile
              priority={priority && index === 0}
              product={product}
              key={product.id}
            />
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
  const availableSections = useMemo(() => publishedSections(bootstrap), [bootstrap]);
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
    shortcutSectionIds: availableSections.map((section) => section.id),
    recommendationSectionIds: fallbackRecommendationSectionIds(bootstrap),
  };
  const layout = resolveHomeLayout(site.homeLayout, fallbackLayout, publishedSectionIds);
  const shortcutLayout = resolveHomeShortcuts(
    site.homeLayout?.shortcutSectionIds,
    fallbackLayout.shortcutSectionIds,
    publishedSectionIds,
  );
  const shortcutSections = shortcutLayout.sectionIds.flatMap((id) =>
    sectionById.get(id) ? [sectionById.get(id) as PublicSection] : [],
  );
  const recommendationSections = layout.recommendationSectionIds
    .flatMap((id) => (sectionById.get(id) ? [sectionById.get(id) as PublicSection] : []))
    .slice(0, 3);
  const priorityRecommendationSectionId =
    recommendationSections.find(
      (section) => (featuredProductsBySection.get(section.id)?.length ?? 0) > 0,
    )?.id ?? recommendationSections[0]?.id;
  const heroSlides = site.hero?.slides ?? [];
  const hasHero = heroSlides.some((slide) => slide.mediaUrl.trim());

  useEffect(() => {
    document.documentElement.lang = 'en';
    document.title = site.name;
  }, [site.name]);

  return (
    <div className={`home-feed${hasHero ? ' has-hero' : ''}`}>
      <h1 className="sr-only">{site.name}</h1>
      <HomeHero siteName={site.name} slides={heroSlides} />
      <HomeShortcuts sections={shortcutSections} showMore={shortcutLayout.showMore} />

      <div className="home-recommendation-feed">
        {recommendationSections.map((section) => (
          <HomeRecommendationRail
            bootstrap={bootstrap}
            initialProducts={featuredProductsBySection.get(section.id) ?? []}
            priority={!hasHero && section.id === priorityRecommendationSectionId}
            section={section}
            key={section.id}
          />
        ))}
      </div>
    </div>
  );
}
