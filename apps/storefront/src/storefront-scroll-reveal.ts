const revealSelector = [
  '.home-recommendation',
  '.home-shortcut',
  '.home-product-tile',
  '.browse-section-card',
  '.browse-search-product-card',
  '.product-card',
  '.section-product-card',
  '.faq-article-row',
  '.messages-article-row',
  '.product-detail-summary',
  '.product-detail-body',
].join(',');

export function installStorefrontScrollReveal() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReducedMotion.matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  const scan = () => {
    document.querySelectorAll<HTMLElement>(revealSelector).forEach((element) => {
      if (element.classList.contains('is-revealed')) return;
      element.classList.add('storefront-scroll-reveal');
      observer.observe(element);
    });
  };

  scan();
  const mutationObserver = new MutationObserver(scan);
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  window.addEventListener(
    'pagehide',
    () => {
      mutationObserver.disconnect();
      observer.disconnect();
    },
    { once: true },
  );
}
