import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ElementType,
  type ReactNode,
} from 'react';

export type StorefrontLinkComponent = ElementType<
  AnchorHTMLAttributes<HTMLAnchorElement>
>;

export function StorefrontBrandBar({
  homeHref = '/',
  LinkComponent = 'a',
  locationLabel,
  logo,
  siteName,
}: {
  homeHref?: string;
  LinkComponent?: StorefrontLinkComponent;
  locationLabel: string;
  logo: ReactNode;
  siteName: string;
}) {
  return (
    <header className="topbar">
      <LinkComponent className="brand-lockup" href={homeHref}>
        <span className="brand-logo">{logo}</span>
        <span>
          <strong>{siteName}</strong>
          <small>⌖ {locationLabel}</small>
        </span>
      </LinkComponent>
    </header>
  );
}

export type StorefrontHeroSlide = {
  id: string;
  media: ReactNode;
  title?: string | null;
  description?: string | null;
  cta?: { label: string; href: string } | null;
};

type StorefrontHeroCarouselProps = {
  slides: StorefrontHeroSlide[];
  LinkComponent?: StorefrontLinkComponent;
  intervalMs?: number;
};

type StorefrontHeroLegacyProps = {
  description: string;
  eyebrow: string;
  locationLabel: string;
  title: string;
};

function StorefrontHeroCarousel({
  slides,
  LinkComponent = 'a',
  intervalMs = 5000,
}: StorefrontHeroCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (activeIndex < slides.length) return;
    setActiveIndex(Math.max(0, slides.length - 1));
  }, [activeIndex, slides.length]);

  const goTo = useCallback(
    (index: number, behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth') => {
      const viewport = viewportRef.current;
      if (!viewport || slides.length === 0) return;
      const normalized = (index + slides.length) % slides.length;
      setActiveIndex(normalized);
      viewport.scrollTo({ left: viewport.clientWidth * normalized, behavior });
    },
    [reducedMotion, slides.length],
  );

  useEffect(() => {
    if (slides.length < 2 || interactionPaused || reducedMotion || !pageVisible) return;
    const timer = window.setInterval(
      () => goTo(activeIndex + 1),
      Math.max(2500, intervalMs),
    );
    return () => window.clearInterval(timer);
  }, [
    activeIndex,
    goTo,
    interactionPaused,
    intervalMs,
    pageVisible,
    reducedMotion,
    slides.length,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const slideElements = viewport.querySelectorAll<HTMLElement>(
      '[data-hero-slide-index]',
    );
    slideElements.forEach((element, index) => {
      element.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
        video.muted = true;
        if (index === activeIndex && pageVisible) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      });
    });
  }, [activeIndex, pageVisible, slides]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  if (slides.length === 0) return null;

  return (
    <section
      className={`hero-carousel${slides.length === 1 ? ' is-single' : ''}`}
      aria-roledescription="carousel"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={() => setInteractionPaused(false)}
    >
      <div
        className="hero-carousel-viewport"
        ref={viewportRef}
        onPointerDown={() => setInteractionPaused(true)}
        onPointerUp={() => setInteractionPaused(false)}
        onPointerCancel={() => setInteractionPaused(false)}
        onScroll={() => {
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
          frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            const viewport = viewportRef.current;
            if (!viewport || viewport.clientWidth <= 0) return;
            const index = Math.max(
              0,
              Math.min(
                slides.length - 1,
                Math.round(viewport.scrollLeft / viewport.clientWidth),
              ),
            );
            setActiveIndex(index);
          });
        }}
      >
        <div className="hero-carousel-track">
          {slides.map((slide, index) => {
            const hasCopy = Boolean(slide.title || slide.description || slide.cta);
            return (
              <article
                className="hero-carousel-slide"
                data-hero-slide-index={index}
                key={slide.id}
                aria-hidden={index !== activeIndex}
              >
                <div className="hero-carousel-media">{slide.media}</div>
                {hasCopy ? (
                  <div className="hero-carousel-overlay">
                    <div className="hero-carousel-copy">
                      {slide.title ? <h1>{slide.title}</h1> : null}
                      {slide.description ? <p>{slide.description}</p> : null}
                      {slide.cta ? (
                        <LinkComponent
                          className="hero-carousel-cta"
                          href={slide.cta.href}
                        >
                          {slide.cta.label}
                        </LinkComponent>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <button
            className="hero-carousel-arrow is-prev"
            type="button"
            aria-label="Previous slide"
            onClick={() => goTo(activeIndex - 1)}
          >
            ‹
          </button>
          <button
            className="hero-carousel-arrow is-next"
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(activeIndex + 1)}
          >
            ›
          </button>
          <div className="hero-carousel-dots" role="group" aria-label="Hero slides">
            {slides.map((slide, index) => (
              <button
                className={`hero-carousel-dot${index === activeIndex ? ' is-active' : ''}`}
                type="button"
                key={slide.id}
                aria-label={`Slide ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function StorefrontHero(
  props: StorefrontHeroCarouselProps | StorefrontHeroLegacyProps,
) {
  if ('slides' in props) {
    return <StorefrontHeroCarousel {...props} />;
  }

  const { description, eyebrow, locationLabel, title } = props;
  return (
    <section className="hero-panel">
      <div>
        <p className="hero-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-copy">{description}</p>
      </div>
      <span className="hero-location">⌖ {locationLabel}</span>
    </section>
  );
}

export function StorefrontProductCard({
  address,
  categoryName,
  href,
  LinkComponent = 'a',
  media,
  modeLabel,
  sectionName,
  tags,
  title,
}: {
  address?: string | null;
  categoryName?: string | null;
  href: string;
  LinkComponent?: StorefrontLinkComponent;
  media: ReactNode;
  modeLabel?: string | null;
  sectionName?: string | null;
  tags: Array<{ id: string; name: string }>;
  title: string;
}) {
  return (
    <LinkComponent className="product-card" href={href}>
      <div className="product-card-media">
        {media}
        {modeLabel ? <span className="service-mode-badge">{modeLabel}</span> : null}
      </div>
      <div className="product-card-body">
        <div className="product-card-heading">
          <h3>{title}</h3>
          {sectionName ? <span>{sectionName}</span> : null}
        </div>
        {categoryName ? <p className="product-type">{categoryName}</p> : null}
        {tags.length > 0 ? (
          <div className="tag-row" aria-label="Tags">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag.id}>{tag.name}</span>
            ))}
          </div>
        ) : null}
        {address ? <p className="product-address">⌖ {address}</p> : null}
      </div>
    </LinkComponent>
  );
}

export type StorefrontNavigationItem = {
  href: string;
  icon: ReactNode;
  label: string;
  badgeCount?: number;
};

export function StorefrontBottomNavigation({
  activeHref = '/',
  items,
  LinkComponent = 'a',
}: {
  activeHref?: string;
  items: StorefrontNavigationItem[];
  LinkComponent?: StorefrontLinkComponent;
}) {
  return (
    <nav
      className="bottom-nav"
      aria-label="Primary navigation"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <LinkComponent
          className={item.href === activeHref ? 'is-active' : undefined}
          href={item.href}
          key={item.href}
          aria-current={item.href === activeHref ? 'page' : undefined}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            {item.icon}
            {item.badgeCount && item.badgeCount > 0 ? (
              <b className="bottom-nav-badge">
                {item.badgeCount > 99 ? '99+' : item.badgeCount}
              </b>
            ) : null}
          </span>
          <small>{item.label}</small>
        </LinkComponent>
      ))}
    </nav>
  );
}
