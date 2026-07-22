function initializeHeroCarousel(root: HTMLElement): void {
  if (root.dataset.ready === "1") return;
  root.dataset.ready = "1";

  const track = root.querySelector<HTMLElement>("[data-hero-track]");
  const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-hero-slide]"));
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-hero-dot]"));
  if (!track || slides.length < 2) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dragStartThreshold = 6;
  let active = 0;
  let timer = 0;
  let pointerId: number | null = null;
  let pointerStart = 0;
  let scrollStart = 0;
  let startIndex = 0;
  let dragging = false;
  let suppressClick = false;

  const slideWidth = (): number => Math.max(track.clientWidth, 1);
  const updateDots = (): void => {
    dots.forEach((dot, index) => dot.setAttribute("aria-current", index === active ? "true" : "false"));
  };
  const goTo = (index: number, behavior: ScrollBehavior = "smooth"): void => {
    active = (index + slides.length) % slides.length;
    track.scrollTo({ left: active * slideWidth(), behavior });
    updateDots();
  };
  const stop = (): void => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };
  const shouldPause = (): boolean => (
    document.hidden || reducedMotion.matches || root.matches(":hover") || root.contains(document.activeElement)
  );
  const start = (): void => {
    stop();
    if (!shouldPause()) timer = window.setInterval(() => goTo(active + 1), 5000);
  };

  dots.forEach((dot, index) => dot.addEventListener("click", () => {
    goTo(index);
    start();
  }));

  let scrollTimer = 0;
  track.addEventListener("scroll", () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      active = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / slideWidth())));
      updateDots();
    }, 80);
  }, { passive: true });

  track.addEventListener("dragstart", (event) => event.preventDefault());
  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerId = event.pointerId;
    pointerStart = event.clientX;
    scrollStart = track.scrollLeft;
    startIndex = Math.round(scrollStart / slideWidth());
    dragging = false;
    suppressClick = false;
    stop();
  });
  track.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientX - pointerStart;
    if (!dragging && Math.abs(distance) >= dragStartThreshold) {
      dragging = true;
      suppressClick = true;
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
    }
    if (!dragging) return;
    event.preventDefault();
    track.scrollLeft = scrollStart - distance;
  }, { passive: false });

  const release = (event: PointerEvent, cancelled = false): void => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientX - pointerStart;
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    track.classList.remove("is-dragging");

    if (dragging && !cancelled) {
      const threshold = Math.min(96, Math.max(48, slideWidth() * 0.12));
      let nextIndex = Math.round(track.scrollLeft / slideWidth());
      if (Math.abs(distance) >= threshold) nextIndex = startIndex + (distance < 0 ? 1 : -1);
      goTo(nextIndex);
    } else if (cancelled) {
      goTo(startIndex);
    }
    dragging = false;
    pointerId = null;
    start();
  };

  track.addEventListener("pointerup", (event) => release(event));
  track.addEventListener("pointercancel", (event) => release(event, true));
  track.addEventListener("pointerleave", () => {
    if (pointerId === null || dragging) return;
    pointerId = null;
    start();
  });
  track.addEventListener("click", (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }, true);
  root.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    goTo(active + (event.key === "ArrowRight" ? 1 : -1));
  });
  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    start();
  });
  document.addEventListener("visibilitychange", start);
  reducedMotion.addEventListener("change", start);
  window.addEventListener("resize", () => goTo(active, "auto"));
  start();
}

document.querySelectorAll<HTMLElement>("[data-hero-carousel]").forEach(initializeHeroCarousel);
