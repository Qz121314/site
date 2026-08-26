import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  StorefrontBottomNavigation,
  StorefrontBrandBar,
  StorefrontHero,
  StorefrontHomeProductTile,
  StorefrontHomeShortcut,
  StorefrontProductCard,
} from './index';
import {
  storefrontBrandContrast,
  storefrontBrandForeground,
  storefrontThemeStyle,
} from './theme';

describe('shared storefront UI', () => {
  it('renders the generic product-card contract', () => {
    const html = renderToStaticMarkup(
      <StorefrontProductCard
        categoryName="Live"
        href="/sections/live/products/demo/"
        media={<span>media</span>}
        modeLabel="Online"
        sectionName="Streaming"
        tags={[{ id: 'tag-1', name: 'Popular' }]}
        title="Demo product"
      />,
    );
    expect(html).toContain('class="product-card"');
    expect(html).toContain('class="product-card-media"');
    expect(html).toContain('class="tag-row"');
    expect(html).toContain('href="/sections/live/products/demo/"');
  });

  it('renders the EROSDOOR wordmark as two theme-driven brand segments', () => {
    const html = renderToStaticMarkup(
      <StorefrontBrandBar locationLabel="Local" logo={null} siteName="EROSDOOR" />,
    );

    expect(html).toContain('class="brand-wordmark is-duotone"');
    expect(html).toContain('class="brand-wordmark-accent">EROS</span>');
    expect(html).toContain('class="brand-wordmark-primary">DOOR</span>');
  });

  it('renders the shared Home hero, shortcut, product, and navigation landmarks', () => {
    const html = renderToStaticMarkup(
      <>
        <StorefrontHero
          ariaLabel="Featured"
          slides={[{ id: 'hero-1', media: <span>media</span>, title: 'Title' }]}
        />
        <StorefrontHomeShortcut href="/browse/" icon="◆" label="Browse" />
        <StorefrontHomeProductTile
          href="/products/demo/"
          media={<span>media</span>}
          title="Demo"
        />
        <StorefrontBottomNavigation items={[{ href: '/', icon: '⌂', label: 'Home' }]} />
      </>,
    );
    expect(html).toContain('class="hero-carousel is-single"');
    expect(html).toContain('class="hero-carousel-slide is-active"');
    expect(html).toContain('class="home-shortcut"');
    expect(html).toContain('class="home-product-tile"');
    expect(html).toContain('class="bottom-nav"');
    expect(html).toContain('aria-label="Primary navigation"');
  });

  it('applies an optional accent without changing the remaining resolved tokens', () => {
    const style = storefrontThemeStyle(
      {
        brand: '#111111',
        brandStrong: '#222222',
        text: '#333333',
        muted: '#444444',
        surface: '#555555',
        surfaceSoft: '#666666',
        line: '#777777',
        pageBg: '#888888',
        heroStart: '#999999',
        heroEnd: '#aaaaaa',
        heroGlow: '#bbbbbb',
        shadow: 'none',
      },
      '#ff0000',
    ) as Record<string, string>;
    expect(style['--brand']).toBe('#ff0000');
    expect(style['--brand-strong']).toBe('#ff0000');
    expect(style['--theme-on-brand']).toBe('#000000');
    expect(style['--page-bg']).toBe('#888888');
  });

  it('chooses a readable foreground for every official brand family', () => {
    expect(storefrontBrandForeground('#ff5a1f', 'light')).toBe('#000000');
    expect(storefrontBrandForeground('#df5d87', 'dark')).toBe('#000000');
    expect(storefrontBrandForeground('#e3486d', 'dark')).toBe('#000000');
    expect(storefrontBrandForeground('#b6405f', 'dark')).toBe('#ffffff');
    expect(storefrontBrandForeground('#8fa7d8', 'dark')).toBe('#000000');
    expect(storefrontBrandForeground('#a64562', 'light')).toBe('#ffffff');
    expect(storefrontBrandForeground('#4f46e5', 'light')).toBe('#ffffff');
    expect(storefrontBrandForeground('#df6c4f', 'light')).toBe('#000000');
    expect(storefrontBrandForeground('#22d3ee', 'dark')).toBe('#000000');
  });

  it('reports the selected brand foreground contrast without guessing for CSS colors', () => {
    for (const brand of [
      '#ff5a1f',
      '#df5d87',
      '#e3486d',
      '#b6405f',
      '#8fa7d8',
      '#a64562',
      '#4f46e5',
      '#df6c4f',
      '#22d3ee',
    ]) {
      const contrast = storefrontBrandContrast(brand, 'light');
      expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
      expect(contrast.foreground).toMatch(/^#(?:000000|ffffff)$/u);
    }

    expect(storefrontBrandContrast('var(--external-brand)', 'dark')).toEqual({
      foreground: 'var(--page-bg)',
      ratio: null,
    });
  });
});
