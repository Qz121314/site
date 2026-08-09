import type { ReactNode } from 'react';
import type { StorefrontNavigationItem } from '@site/storefront-ui';
import type { StorefrontCopy } from './storefront-copy';

function navigationIcon(children: ReactNode) {
  return (
    <svg
      className="storefront-nav-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const homeIcon = navigationIcon(
  <>
    <path d="M3.5 10.8 12 3.8l8.5 7" />
    <path d="M5.7 9.4v10.1h12.6V9.4" />
    <path d="M9.5 19.5v-5.8h5v5.8" />
  </>,
);

const browseIcon = navigationIcon(
  <>
    <circle cx="12" cy="12" r="8.7" />
    <path d="m14.9 9.1-1.8 4-4 1.8 1.8-4 4-1.8Z" />
  </>,
);

const messagesIcon = navigationIcon(
  <>
    <path d="M20 11.6a7.6 7.6 0 0 1-8 7.2 8.8 8.8 0 0 1-3.2-.7L4 19.5l1.4-4.2a7 7 0 0 1-1.1-3.7 7.6 7.6 0 0 1 8-7.2 7.6 7.6 0 0 1 7.7 7.2Z" />
    <path d="M8.5 11.7h.01M12 11.7h.01M15.5 11.7h.01" />
  </>,
);

const faqIcon = navigationIcon(
  <>
    <circle cx="12" cy="12" r="8.7" />
    <path d="M9.7 9.4a2.5 2.5 0 0 1 4.8 1c0 1.8-2.5 2-2.5 3.8" />
    <path d="M12 17.3h.01" />
  </>,
);

export function primaryNavigationItems(
  labels: StorefrontCopy['navigation'],
  unreadMessages = 0,
): StorefrontNavigationItem[] {
  return [
    { href: '/', label: labels.home, icon: homeIcon },
    { href: '/browse/', label: labels.browse, icon: browseIcon },
    {
      href: '/messages/',
      label: labels.messages,
      icon: messagesIcon,
      ...(unreadMessages > 0 ? { badgeCount: unreadMessages } : {}),
    },
    { href: '/faq/', label: labels.faq, icon: faqIcon },
  ];
}
