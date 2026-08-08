import type {
  AnchorHTMLAttributes,
  ElementType,
  ReactNode,
} from 'react';

export type StorefrontLinkComponent = ElementType<AnchorHTMLAttributes<HTMLAnchorElement>>;

export function StorefrontBrandBar({
  homeHref = '/',
  language = 'EN',
  LinkComponent = 'a',
  locationLabel,
  logo,
  siteName,
}: {
  homeHref?: string;
  language?: string;
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
      <span className="site-language">{language}</span>
    </header>
  );
}

export function StorefrontHero({
  description,
  eyebrow,
  locationLabel,
  title,
}: {
  description: string;
  eyebrow: string;
  locationLabel: string;
  title: string;
}) {
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
  modeLabel: string;
  sectionName: string;
  tags: Array<{ id: string; name: string }>;
  title: string;
}) {
  return (
    <LinkComponent className="product-card" href={href}>
      <div className="product-card-media">
        {media}
        <span className="service-mode-badge">{modeLabel}</span>
      </div>
      <div className="product-card-body">
        <div className="product-card-heading">
          <h3>{title}</h3>
          <span>{sectionName}</span>
        </div>
        {categoryName ? <p className="product-type">{categoryName}</p> : null}
        {tags.length > 0 ? (
          <div className="tag-row" aria-label="Product tags">
            {tags.slice(0, 3).map((tag) => <span key={tag.id}>{tag.name}</span>)}
          </div>
        ) : null}
        {address ? <p className="product-address">⌖ {address}</p> : null}
      </div>
    </LinkComponent>
  );
}

export type StorefrontNavigationItem = {
  href: string;
  icon: string;
  label: string;
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
          key={item.label}
        >
          <span aria-hidden="true">{item.icon}</span>
          <small>{item.label}</small>
        </LinkComponent>
      ))}
    </nav>
  );
}
