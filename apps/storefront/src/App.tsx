import { routes } from '@site/config';
import { useEffect } from 'react';

type PublishedSection = {
  id: string;
  name: string;
  iconUrl?: string;
};

type FeaturedProduct = {
  id: string;
  sectionName: string;
  title: string;
  body: string;
  coverUrl?: string;
  address?: string;
};

const sections: readonly PublishedSection[] = [];
const featuredProducts: readonly FeaturedProduct[] = [];

const bottomNavigation = [
  { label: 'Home', icon: '⌂', href: routes.storefront },
  { label: 'Hot', icon: '◆', href: '#featured' },
  { label: 'Messages', icon: '◌', href: '#messages' },
  { label: 'FAQ', icon: '?', href: '#faq' },
] as const;

export function App() {
  useEffect(() => {
    document.documentElement.lang = 'en';
    document.title = 'Service Directory';
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="location-button" type="button" aria-label="Choose location">
          <span aria-hidden="true">⌖</span>
          <span>Location / City</span>
        </button>
        <span className="site-language">English</span>
      </header>

      <main>
        <section className="section-navigation" aria-labelledby="section-navigation-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Explore</p>
              <h1 id="section-navigation-title">Services</h1>
            </div>
          </div>

          {sections.length > 0 ? (
            <div className="section-grid">
              {sections.map((section) => (
                <a className="section-item" href={`/sections/${section.id}/`} key={section.id}>
                  <span className="section-icon" aria-hidden="true">
                    {section.iconUrl ? <img alt="" src={section.iconUrl} /> : section.name.slice(0, 1)}
                  </span>
                  <span>{section.name}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No sections published</strong>
              <span>Sections created and enabled in Admin will appear here automatically.</span>
            </div>
          )}
        </section>

        <section className="featured-section" id="featured" aria-labelledby="featured-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Featured</p>
              <h2 id="featured-title">Hot recommendations</h2>
            </div>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="featured-track">
              {featuredProducts.map((product) => (
                <article className="featured-card" key={product.id}>
                  <div className="featured-media">
                    {product.coverUrl ? <img alt="" src={product.coverUrl} /> : null}
                    <span>{product.sectionName}</span>
                  </div>
                  <div className="featured-body">
                    <h3>{product.title}</h3>
                    <p>{product.body}</p>
                    {product.address ? <address>{product.address}</address> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="featured-placeholder">
              <div className="featured-placeholder-media" />
              <div>
                <span>Featured product</span>
                <strong>Products marked as hot in Admin will appear here.</strong>
              </div>
            </div>
          )}
        </section>

        <section className="reserved-section" id="messages" aria-label="Messages" />
        <section className="reserved-section" id="faq" aria-label="FAQ" />
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {bottomNavigation.map((item, index) => (
          <a className={index === 0 ? 'is-active' : undefined} href={item.href} key={item.label}>
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </a>
        ))}
      </nav>
    </div>
  );
}
