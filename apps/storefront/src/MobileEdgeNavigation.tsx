import { useEffect, useState, type CSSProperties } from 'react';
import {
  canNavigateStorefrontBack,
  canNavigateStorefrontForward,
  ensureStorefrontHistoryState,
  navigateStorefrontBack,
  navigateStorefrontForward,
  recordStorefrontHistoryPush,
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

export function MobileEdgeNavigation() {
  const [gesture, setGesture] = useState<EdgeGesture | null>(null);

  useEffect(() => {
    ensureStorefrontHistoryState();
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    let tracking: TrackingGesture | null = null;

    const clearGesture = () => {
      tracking = null;
      setGesture(null);
    };

    const handleStorefrontNavigation = () => {
      recordStorefrontHistoryPush();
    };

    const handlePopState = (event: PopStateEvent) => {
      syncStorefrontHistoryFromPopState(event.state);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!mobileQuery.matches || event.touches.length !== 1 || shouldIgnoreTarget(event.target)) return;
      const touch = event.touches[0];
      if (!touch) return;

      if (touch.clientX <= EDGE_WIDTH && canNavigateStorefrontBack()) {
        tracking = {
          direction: 'back',
          startX: touch.clientX,
          startY: touch.clientY,
          distance: 0,
          locked: false,
        };
        return;
      }

      if (touch.clientX >= window.innerWidth - EDGE_WIDTH && canNavigateStorefrontForward()) {
        tracking = {
          direction: 'forward',
          startX: touch.clientX,
          startY: touch.clientY,
          distance: 0,
          locked: false,
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - tracking.startX;
      const deltaY = touch.clientY - tracking.startY;
      const horizontalDistance = tracking.direction === 'back' ? deltaX : -deltaX;
      const verticalDistance = Math.abs(deltaY);

      if (!tracking.locked) {
        if (verticalDistance > VERTICAL_CANCEL_DISTANCE && verticalDistance > Math.abs(deltaX)) {
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
    };

    const finishGesture = () => {
      if (!tracking) return;
      const { direction, distance, locked } = tracking;
      clearGesture();
      if (!locked || distance < TRIGGER_DISTANCE) return;
      if (direction === 'back') navigateStorefrontBack();
      else navigateStorefrontForward();
    };

    window.addEventListener(NAVIGATION_EVENT, handleStorefrontNavigation);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', finishGesture, { passive: true });
    document.addEventListener('touchcancel', clearGesture, { passive: true });

    return () => {
      window.removeEventListener(NAVIGATION_EVENT, handleStorefrontNavigation);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', finishGesture);
      document.removeEventListener('touchcancel', clearGesture);
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
