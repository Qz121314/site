import {
  StorefrontBottomNavigation,
  StorefrontBrandBar,
  StorefrontHomeProductTile,
  StorefrontHomeShortcut,
} from '@site/storefront-ui';
import { storefrontThemeStyle } from '@site/storefront-ui/theme';
import {
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { ThemePreset, ThemePreviewContent } from './theme-center/api';

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
  content,
  textColor,
  theme,
  viewport,
  previewSize,
}: {
  accent: string | null;
  content: ThemePreviewContent;
  textColor: string | null;
  theme: ThemePreset;
  viewport: 'desktop' | 'mobile';
  previewSize: { width: number; height: number };
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [availableSize, setAvailableSize] = useState({ width: 0, height: 0 });
  const style = storefrontThemeStyle(
    { ...theme.tokens, ...(textColor ? { text: textColor } : {}) },
    accent,
    theme.colorScheme,
  );
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const updateAvailableSize = () => {
      setAvailableSize({ width: shell.clientWidth, height: shell.clientHeight });
    };
    updateAvailableSize();
    const observer = new ResizeObserver(updateAvailableSize);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);
  const previewScale =
    availableSize.width > 0 && availableSize.height > 0
      ? Math.min(
          1,
          (availableSize.width - 32) / previewSize.width,
          (availableSize.height - 32) / previewSize.height,
        )
      : 1;
  const scaleBoxStyle = {
    width: `${previewSize.width * previewScale}px`,
    height: `${previewSize.height * previewScale}px`,
  } satisfies CSSProperties;
  const frameStyle = {
    width: `${previewSize.width}px`,
    height: `${previewSize.height}px`,
    transform: `scale(${previewScale})`,
  } satisfies CSSProperties;
  const primarySection = content.sections[0] ?? null;
  const primaryProducts = primarySection
    ? content.products.filter((product) => product.sectionId === primarySection.id)
    : content.products;
  const visibleProducts = primaryProducts.length > 0 ? primaryProducts : content.products;
  const logo = content.logoUrl ? (
    <img alt="" src={content.logoUrl} />
  ) : (
    <PreviewIcon>◆</PreviewIcon>
  );
  return (
    <div className="theme-preview-shell" data-viewport={viewport} ref={shellRef}>
      <div className="theme-preview-stage">
        <div className="theme-preview-scale-box" style={scaleBoxStyle}>
          <div
            className="theme-preview-frame"
            data-template={viewport}
            style={frameStyle}
          >
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
                locationLabel={content.locationLabel}
                logo={logo}
                siteName={content.siteName}
                LinkComponent={PreviewLink}
              />
              <div className="theme-preview-content">
                <nav
                  className="home-shortcuts theme-preview-shortcuts"
                  aria-label="快捷入口预览"
                >
                  {content.sections.map((section) => (
                    <StorefrontHomeShortcut
                      href={`/sections/${encodeURIComponent(section.slug)}/`}
                      icon={
                        section.iconUrl ? (
                          <img alt="" src={section.iconUrl} />
                        ) : (
                          <PreviewIcon>{Array.from(section.name)[0] ?? '•'}</PreviewIcon>
                        )
                      }
                      key={section.id}
                      label={section.name}
                      LinkComponent={PreviewLink}
                    />
                  ))}
                </nav>
                <section
                  className="theme-preview-section"
                  aria-label="推荐分区与产品卡预览"
                >
                  <div className="home-recommendation-heading">
                    <span className="home-recommendation-heading-copy">
                      <h2>{primarySection?.name ?? content.siteName}</h2>
                      {primarySection?.description ? (
                        <p>{primarySection.description}</p>
                      ) : null}
                    </span>
                    <PreviewLink href="#" aria-label="查看全部">
                      <span aria-hidden="true">›</span>
                    </PreviewLink>
                  </div>
                  <div className="home-product-rail theme-preview-products">
                    {visibleProducts.map((product) => (
                      <StorefrontHomeProductTile
                        href={`/sections/${encodeURIComponent(primarySection?.slug ?? '')}/products/${encodeURIComponent(product.slug)}/`}
                        key={product.id}
                        LinkComponent={PreviewLink}
                        media={
                          product.coverUrl ? (
                            <img alt="" src={product.coverUrl} />
                          ) : (
                            <span className="theme-preview-product-media" />
                          )
                        }
                        title={product.title}
                      />
                    ))}
                  </div>
                </section>
              </div>
              {viewport === 'mobile' && content.navigation.length > 0 ? (
                <StorefrontBottomNavigation
                  activeHref={content.navigation[0]?.href ?? '/'}
                  items={content.navigation.map((item) => ({
                    ...item,
                    icon: <PreviewIcon>{Array.from(item.label)[0] ?? '•'}</PreviewIcon>,
                  }))}
                  LinkComponent={PreviewLink}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
