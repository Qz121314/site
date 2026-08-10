import { useEffect, useState, type CSSProperties } from 'react';
import {
  canNavigateStorefrontBack,
  canNavigateStorefrontForward,
  ensureStorefrontHistoryState,
  navigateStorefrontBack,
  navigateStorefrontForward,
  recordStorefrontHistoryPush,
  saveCurrentStorefrontScrollPosition,
  syncStorefrontHistoryFromPopState,
  type StorefrontNavigationDirection,
} from './storefront-history';

type EdgeGesture = {
  direction: StorefrontNavigationDirection;
  progress: number;
};

type TrackingGesture = {
  direction: StorefrontNavigationDirection;
  startX: number;
  startY: number;
  distance: number;
  locked: boolean;
};

type StandaloneNavigator = Navigator & { standalone?: boolean };

const NAVIGATION_EVENT = 'storefront:navigate';
const EDGE_WIDTH = 26;
const LOCK_DISTANCE = 10;
const TRIGGER_DISTANCE = 76;
const VERTICAL_CANCEL_DISTANCE = 34;
const IGNORE_GESTURE_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '.hero-carousel-viewport',
  '.home-product-rail',
  '.section-tag-filter',
  '.detail-gallery',
].join(',');

function shouldIgnoreTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(IGNORE_GESTURE_SELECTOR));
}

function isStandaloneApp(standaloneQuery: MediaQueryList): boolean {
  return (
    standaloneQuery.matches ||
    (window.navigator as StandaloneNavigator).standalone === true
  );
}

function shouldCaptureInternalNavigation(event: MouseEvent): boolean {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return false;
  const anchor =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>('a[href]')
      : null;
  if (!anchor) return false;
  const href = anchor.getAttribute('href') ?? '';
  return href.startsWith('/') && !href.startsWith('/go/');
}

export function MobileEdgeNavigation() {
  const [gesture, setGesture] = useState<EdgeGesture | null>(null);

  useEffect(() => {
    ensureStorefrontHistoryState();
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    let tracking: TrackingGesture | null = null;

    function detachTrackingListeners() {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', finishGesture);
      document.removeEventListener('touchcancel', cancelGesture);
    }

    function clearGesture() {
      detachTrackingListeners();
      tracking = null;
      setGesture(null);
    }

    function beginGesture(direction: StorefrontNavigationDirection, touch: Touch) {
      tracking = {
        direction,
        startX: touch.clientX,
        startY: touch.clientY,
        distance: 0,
        locked: false,
      };
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', finishGesture, { passive: true });
      document.addEventListener('touchcancel', cancelGesture, { passive: true });
    }

    function handleStorefrontNavigation() {
      recordStorefrontHistoryPush();
    }

    function handlePopState(event: PopStateEvent) {
      syncStorefrontHistoryFromPopState(event.state);
    }

    function handleClickCapture(event: MouseEvent) {
      if (shouldCaptureInternalNavigation(event)) saveCurrentStorefrontScrollPosition();
    }

    function handleTouchStart(event: TouchEvent) {
      if (
        !mobileQuery.matches ||
        !isStandaloneApp(standaloneQuery) ||
        event.touches.length !== 1 ||
        shouldIgnoreTarget(event.target)
      )
        return;
      const touch = event.touches[0];
      if (!touch) return;

      if (touch.clientX <= EDGE_WIDTH && canNavigateStorefrontBack()) {
        beginGesture('back', touch);
        return;
      }

      if (
        touch.clientX >= window.innerWidth - EDGE_WIDTH &&
        canNavigateStorefrontForward()
      ) {
        beginGesture('forward', touch);
      }
    }

    function handleTouchMove(event: TouchEvent) {
      if (!tracking || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - tracking.startX;
      const deltaY = touch.clientY - tracking.startY;
      const horizontalDistance = tracking.direction === 'back' ? deltaX : -deltaX;
      const verticalDistance = Math.abs(deltaY);

      if (!tracking.locked) {
        if (
          verticalDistance > VERTICAL_CANCEL_DISTANCE &&
          verticalDistance > Math.abs(deltaX)
        ) {
          clearGesture();
          return;
        }
        if (horizontalDistance < LOCK_DISTANCE) return;
        if (verticalDistance > horizontalDistance * 0.8) {
          clearGesture();
          return;
        }
        tracking.locked = true;
      }

      if (horizontalDistance <= 0) {
        clearGesture();
        return;
      }

      event.preventDefault();
      tracking.distance = horizontalDistance;
      setGesture({
        direction: tracking.direction,
        progress: Math.min(horizontalDistance / TRIGGER_DISTANCE, 1),
      });
    }

    function finishGesture() {
      if (!tracking) return;
      const { direction, distance, locked } = tracking;
      clearGesture();
      if (!locked || distance < TRIGGER_DISTANCE) return;
      if (direction === 'back') navigateStorefrontBack();
      else navigateStorefrontForward();
    }

    function cancelGesture() {
      clearGesture();
    }

    window.addEventListener(NAVIGATION_EVENT, handleStorefrontNavigation);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClickCapture, true);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      window.removeEventListener(NAVIGATION_EVENT, handleStorefrontNavigation);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClickCapture, true);
      document.removeEventListener('touchstart', handleTouchStart);
      detachTrackingListeners();
      tracking = null;
    };
  }, []);

  if (!gesture) return null;

  const distance = 8 + gesture.progress * 18;
  const style = {
    opacity: 0.45 + gesture.progress * 0.55,
    transform: `translate3d(${gesture.direction === 'back' ? distance : -distance}px, -50%, 0) scale(${0.88 + gesture.progress * 0.12})`,
  } satisfies CSSProperties;

  return (
    <div
      className={`mobile-edge-navigation is-${gesture.direction}${gesture.progress >= 1 ? ' is-ready' : ''}`}
      style={style}
      aria-hidden="true"
    >
      <span>{gesture.direction === 'back' ? '‹' : '›'}</span>
    </div>
  );
}
