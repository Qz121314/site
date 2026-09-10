export function installStorefrontScrollChrome() {
  if (typeof window === 'undefined') return;

  let frame = 0;
  const sync = () => {
    frame = 0;
    document.documentElement.toggleAttribute(
      'data-storefront-scrolled',
      window.scrollY > 10,
    );
  };
  const handleScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(sync);
  };

  sync();
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener(
    'pagehide',
    () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    },
    { once: true },
  );
}
