import { routes } from '@site/config';
import { resolveLocale, type Locale } from '@site/shared';
import { useEffect } from 'react';

type Copy = {
  appName: string;
  eyebrow: string;
  headline: string;
  description: string;
  explore: string;
  nearby: string;
  online: string;
  sectionTitle: string;
  sectionDescription: string;
  action: string;
  nav: readonly string[];
};

const messages: Record<Locale, Copy> = {
  en: {
    appName: 'Service Hub',
    eyebrow: 'Local and online services',
    headline: 'Find the right service without the noise.',
    description:
      'A mobile-first catalog for stores, professional services, and trusted online experiences.',
    explore: 'Explore services',
    nearby: 'Nearby stores',
    online: 'Online services',
    sectionTitle: 'Recommended for you',
    sectionDescription: 'The first content stream will be populated from the R2 public snapshot.',
    action: 'View details',
    nav: ['Home', 'Services', 'Stores', 'Messages', 'Account'],
  },
  es: {
    appName: 'Centro de Servicios',
    eyebrow: 'Servicios locales y en línea',
    headline: 'Encuentra el servicio adecuado sin complicaciones.',
    description:
      'Un catálogo móvil para tiendas, servicios profesionales y experiencias en línea confiables.',
    explore: 'Explorar servicios',
    nearby: 'Tiendas cercanas',
    online: 'Servicios en línea',
    sectionTitle: 'Recomendado para ti',
    sectionDescription: 'El contenido se publicará desde la instantánea pública de R2.',
    action: 'Ver detalles',
    nav: ['Inicio', 'Servicios', 'Tiendas', 'Mensajes', 'Cuenta'],
  },
};

const cards = [
  { icon: '✦', title: 'Personal care', meta: 'Local service · Flexible booking' },
  { icon: '⌁', title: 'Digital entertainment', meta: 'Online service · Instant access' },
  { icon: '◫', title: 'Professional support', meta: 'Local and remote consultation' },
  { icon: '◎', title: 'Featured experiences', meta: 'Curated recommendations' },
] as const;

export function App() {
  const locale = resolveLocale(window.location.pathname);
  const copy = messages[locale];
  const alternateLocale: Locale = locale === 'en' ? 'es' : 'en';

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = copy.appName;
  }, [copy.appName, locale]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href={routes.storefront[locale]}>
          <span className="brand-mark">S</span>
          <span>{copy.appName}</span>
        </a>
        <a className="language-switch" href={routes.storefront[alternateLocale]}>
          {alternateLocale.toUpperCase()}
        </a>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.headline}</h1>
            <p className="hero-copy">{copy.description}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#recommendations">
                {copy.explore}
              </a>
              <a className="button button-secondary" href="#recommendations">
                {copy.nearby}
              </a>
            </div>
          </div>
          <div className="hero-panel" aria-label={copy.online}>
            <span className="hero-panel-icon">⌁</span>
            <strong>{copy.online}</strong>
            <span>Fast discovery · Clear conversion paths</span>
          </div>
        </section>

        <section className="content-section" id="recommendations">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MVP 0.1</p>
              <h2>{copy.sectionTitle}</h2>
            </div>
            <p>{copy.sectionDescription}</p>
          </div>

          <div className="listing-grid">
            {cards.map((card) => (
              <article className="listing-card" key={card.title}>
                <div className="listing-media" aria-hidden="true">
                  <span>{card.icon}</span>
                </div>
                <div className="listing-body">
                  <p className="listing-meta">{card.meta}</p>
                  <h3>{card.title}</h3>
                  <button type="button">{copy.action}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {copy.nav.map((label, index) => (
          <a className={index === 0 ? 'is-active' : undefined} href="#top" key={label}>
            <span aria-hidden="true">{['⌂', '◫', '⌖', '◌', '○'][index]}</span>
            <small>{label}</small>
          </a>
        ))}
      </nav>
    </div>
  );
}
