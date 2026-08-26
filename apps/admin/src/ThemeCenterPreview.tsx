import {
  StorefrontBottomNavigation,
  StorefrontBrandBar,
  StorefrontHero,
  StorefrontHomeProductTile,
  StorefrontHomeShortcut,
  type StorefrontHeroSlide,
} from '@site/storefront-ui';
import { storefrontThemeStyle } from '@site/storefront-ui/theme';
import type { AnchorHTMLAttributes, MouseEvent as ReactMouseEvent } from 'react';
import { themeDiagnostics } from './theme-center/diagnostics';
import type { ThemePreset } from './theme-center/api';

function PreviewLink({ onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  );
}

function PreviewIcon({ children }: { children: string }) {
  return <span className="theme-preview-icon-mark">{children}</span>;
}

export function ThemeCenterPreview({
  accent,
  textColor,
  theme,
}: {
  accent: string | null;
  textColor: string | null;
  theme: ThemePreset;
}) {
  const diagnostics = themeDiagnostics(theme, accent, textColor);
  const heroSlides: StorefrontHeroSlide[] = [
    {
      id: 'theme-preview-hero',
      media: <span className="theme-preview-hero-media" aria-hidden="true" />,
      title: 'Theme preview',
      description: '真实复用前端 Header、快捷入口、产品卡、CTA 与底部导航。',
      cta: { label: 'CTA preview', href: '#' },
    },
  ];
  const style = storefrontThemeStyle(
    {
      ...theme.tokens,
      ...(textColor ? { text: textColor } : {}),
    },
    accent,
    theme.colorScheme,
  );

  return (
    <div className="theme-preview-layout">
      <div className="theme-preview-shell" aria-label={`${theme.label} 真实前端预览`}>
        <div
          className="storefront-ui-preview storefront-theme-root theme-preview-device"
          data-theme={theme.key}
          data-color-scheme={theme.colorScheme}
          data-density={theme.density}
          data-button-style={theme.recipe.buttonStyle}
          data-media-style={theme.recipe.mediaStyle}
          data-motion-style={theme.recipe.motionStyle}
          data-navigation-style={theme.recipe.navigationStyle}
          style={style}
        >
          <StorefrontBrandBar
            locationLabel={theme.label}
            logo={<PreviewIcon>◆</PreviewIcon>}
            siteName="Storefront"
            LinkComponent={PreviewLink}
          />

          <div className="theme-preview-content">
            <StorefrontHero
              ariaLabel="Theme preview"
              autoAdvance={false}
              LinkComponent={PreviewLink}
              slides={heroSlides}
            />

            <nav
              className="home-shortcuts theme-preview-shortcuts"
              aria-label="快捷入口预览"
            >
              <StorefrontHomeShortcut
                href="#"
                icon={<PreviewIcon>01</PreviewIcon>}
                label="Explore"
                LinkComponent={PreviewLink}
              />
              <StorefrontHomeShortcut
                href="#"
                icon={<PreviewIcon>02</PreviewIcon>}
                label="Live"
                LinkComponent={PreviewLink}
              />
              <StorefrontHomeShortcut
                href="#"
                icon={<PreviewIcon>03</PreviewIcon>}
                label="Popular"
                LinkComponent={PreviewLink}
              />
              <StorefrontHomeShortcut
                href="#"
                icon={<PreviewIcon>04</PreviewIcon>}
                label="More"
                LinkComponent={PreviewLink}
              />
            </nav>

            <section className="theme-preview-section" aria-label="分区与产品卡预览">
              <div className="home-recommendation-heading">
                <span className="home-recommendation-heading-copy">
                  <h2>Featured</h2>
                  <p>Section title</p>
                </span>
                <PreviewLink href="#" aria-label="More">
                  <span aria-hidden="true">›</span>
                </PreviewLink>
              </div>
              <div className="home-product-rail theme-preview-products">
                <StorefrontHomeProductTile
                  href="#"
                  LinkComponent={PreviewLink}
                  media={<span className="theme-preview-product-media is-primary" />}
                  title="Product name"
                />
                <StorefrontHomeProductTile
                  href="#"
                  LinkComponent={PreviewLink}
                  media={<span className="theme-preview-product-media is-secondary" />}
                  title="Centered title"
                />
              </div>
            </section>
          </div>

          <StorefrontBottomNavigation
            activeHref="/"
            items={[
              { href: '/', label: 'Home', icon: <PreviewIcon>⌂</PreviewIcon> },
              { href: '/browse/', label: 'Browse', icon: <PreviewIcon>◇</PreviewIcon> },
              { href: '/faq/', label: 'FAQ', icon: <PreviewIcon>?</PreviewIcon> },
              {
                href: '/messages/',
                label: 'Messages',
                icon: <PreviewIcon>○</PreviewIcon>,
              },
            ]}
            LinkComponent={PreviewLink}
          />
        </div>
      </div>

      <div className="theme-diagnostics" aria-label="主题自动检查">
        <div className="theme-section-title">
          <strong>自动检查</strong>
          <span>直接基于当前主题 token 与颜色自定义计算。</span>
        </div>
        <div className="theme-diagnostic-list">
          {diagnostics.map((diagnostic) => (
            <div
              className="theme-diagnostic-item"
              data-status={diagnostic.status}
              key={diagnostic.id}
            >
              <span className="theme-diagnostic-mark" aria-hidden="true">
                {diagnostic.status === 'pass' ? '✓' : '!'}
              </span>
              <span>
                <strong>{diagnostic.label}</strong>
                <small>{diagnostic.detail}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
