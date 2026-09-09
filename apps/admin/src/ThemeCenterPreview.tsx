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
  viewport,
  previewSize,
}: {
  accent: string | null;
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
                locationLabel={theme.label}
                logo={<PreviewIcon>◆</PreviewIcon>}
                siteName="Storefront"
                LinkComponent={PreviewLink}
              />
              <div className="theme-preview-content">
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
                <section
                  className="theme-preview-section"
                  aria-label="推荐分区与产品卡预览"
                >
                  <div className="home-recommendation-heading">
                    <span className="home-recommendation-heading-copy">
                      <h2>Featured</h2>
                      <p>Recommended for you</p>
                    </span>
                    <PreviewLink href="#" aria-label="查看全部">
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
                      media={
                        <span className="theme-preview-product-media is-secondary" />
                      }
                      title="New arrival"
                    />
                  </div>
                </section>
              </div>
              {viewport === 'mobile' ? (
                <StorefrontBottomNavigation
                  activeHref="/"
                  items={[
                    { href: '/', label: 'Home', icon: <PreviewIcon>⌂</PreviewIcon> },
                    {
                      href: '/browse/',
                      label: 'Browse',
                      icon: <PreviewIcon>◇</PreviewIcon>,
                    },
                    { href: '/faq/', label: 'FAQ', icon: <PreviewIcon>?</PreviewIcon> },
                    {
                      href: '/messages/',
                      label: 'Messages',
                      icon: <PreviewIcon>○</PreviewIcon>,
                    },
                  ]}
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
