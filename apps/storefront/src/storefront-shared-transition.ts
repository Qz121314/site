const productLinkSelector =
  '.product-card, .section-product-card, .home-product-tile, .browse-search-product-card';

function clearSharedTransition() {
  const root = document.documentElement;
  delete root.dataset.storefrontSharedTransition;
  root.style.removeProperty('--shared-delta-x');
  root.style.removeProperty('--shared-delta-y');
  root.style.removeProperty('--shared-scale-x');
  root.style.removeProperty('--shared-scale-y');
}

export function captureStorefrontSharedElement(
  currentTarget: EventTarget | null,
  href: string,
) {
  if (!href.includes('/products/')) return;
  const source = (currentTarget as HTMLElement | null)?.closest<HTMLElement>(
    productLinkSelector,
  );
  const media = source?.querySelector<HTMLElement>(
    '.product-card-media, .section-product-cover, .home-product-cover, .browse-search-product-cover',
  );
  if (!media) return;

  const rect = media.getBoundingClientRect();
  const root = document.documentElement;
  root.dataset.storefrontSharedTransition = 'product-pending';
  root.style.setProperty('--shared-origin-x', `${rect.left}px`);
  root.style.setProperty('--shared-origin-y', `${rect.top}px`);
  root.style.setProperty('--shared-origin-width', `${rect.width}px`);
  root.style.setProperty('--shared-origin-height', `${rect.height}px`);
}

export function startStorefrontSharedElementTransition() {
  const root = document.documentElement;
  if (root.dataset.storefrontSharedTransition !== 'product-pending') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    clearSharedTransition();
    return;
  }

  window.requestAnimationFrame(() => {
    const target = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.detail-media-stage, .detail-mobile-media-stage',
      ),
    ).find((element) => element.getBoundingClientRect().width > 0);
    if (!target) {
      clearSharedTransition();
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const originX = Number.parseFloat(root.style.getPropertyValue('--shared-origin-x'));
    const originY = Number.parseFloat(root.style.getPropertyValue('--shared-origin-y'));
    const originWidth = Number.parseFloat(
      root.style.getPropertyValue('--shared-origin-width'),
    );
    const originHeight = Number.parseFloat(
      root.style.getPropertyValue('--shared-origin-height'),
    );
    if (![originX, originY, originWidth, originHeight].every(Number.isFinite)) {
      clearSharedTransition();
      return;
    }

    root.style.setProperty('--shared-delta-x', `${originX - targetRect.left}px`);
    root.style.setProperty('--shared-delta-y', `${originY - targetRect.top}px`);
    root.style.setProperty('--shared-scale-x', `${originWidth / targetRect.width}`);
    root.style.setProperty('--shared-scale-y', `${originHeight / targetRect.height}`);
    root.dataset.storefrontSharedTransition = 'product-active';
    window.setTimeout(clearSharedTransition, 720);
  });
}
