import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  StorefrontBottomNavigation,
  StorefrontHero,
  StorefrontProductCard,
} from './index';
import { storefrontThemeStyle } from './theme';

describe('shared storefront UI', () => {
  it('renders the same product-card contract for storefront and theme preview consumers', () => {
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

  it('renders shared hero and navigation landmarks', () => {
    const html = renderToStaticMarkup(
      <>
        <StorefrontHero description="Description" eyebrow="Explore" locationLabel="Global" title="Title" />
        <StorefrontBottomNavigation items={[{ href: '/', icon: '⌂', label: 'Home' }]} />
      </>,
    );
    expect(html).toContain('class="hero-panel"');
    expect(html).toContain('class="bottom-nav"');
    expect(html).toContain('aria-label="Primary navigation"');
  });

  it('applies an optional accent without changing the remaining resolved tokens', () => {
    const style = storefrontThemeStyle({
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
    }, '#ff0000') as Record<string, string>;
    expect(style['--brand']).toBe('#ff0000');
    expect(style['--brand-strong']).toBe('#ff0000');
    expect(style['--page-bg']).toBe('#888888');
  });
});
