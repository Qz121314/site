import type { ReactNode } from 'react';
import type { StorefrontNavigationItem } from '@site/storefront-ui';
import type {
  BottomNavigationBuiltinIcon,
  BottomNavigationItemConfig,
  BottomNavigationKey,
} from './bottom-navigation';
import type { StorefrontCopy } from './storefront-copy';

const HREFS: Record<BottomNavigationKey, string> = {
  home: '/',
  browse: '/browse/',
  messages: '/messages/',
  faq: '/faq/',
};

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

function builtinIcon(name: BottomNavigationBuiltinIcon | string | null): ReactNode {
  switch (name) {
    case 'compass':
      return navigationIcon(<><circle cx="12" cy="12" r="8.7" /><path d="m14.9 9.1-1.8 4-4 1.8 1.8-4 4-1.8Z" /></>);
    case 'messages':
      return navigationIcon(<><path d="M20 11.6a7.6 7.6 0 0 1-8 7.2 8.8 8.8 0 0 1-3.2-.7L4 19.5l1.4-4.2a7 7 0 0 1-1.1-3.7 7.6 7.6 0 0 1 8-7.2 7.6 7.6 0 0 1 7.7 7.2Z" /><path d="M8.5 11.7h.01M12 11.7h.01M15.5 11.7h.01" /></>);
    case 'help':
      return navigationIcon(<><circle cx="12" cy="12" r="8.7" /><path d="M9.7 9.4a2.5 2.5 0 0 1 4.8 1c0 1.8-2.5 2-2.5 3.8" /><path d="M12 17.3h.01" /></>);
    case 'grid':
      return navigationIcon(<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>);
    case 'search':
      return navigationIcon(<><circle cx="10.5" cy="10.5" r="6.2" /><path d="m15.2 15.2 4.2 4.2" /></>);
    case 'star':
      return navigationIcon(<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />);
    case 'heart':
      return navigationIcon(<path d="M20 8.7c0 5.3-8 10.1-8 10.1S4 14 4 8.7A4.4 4.4 0 0 1 12 6a4.4 4.4 0 0 1 8 2.7Z" />);
    case 'user':
      return navigationIcon(<><circle cx="12" cy="8" r="3.4" /><path d="M5.7 20c.8-3.7 3-5.6 6.3-5.6s5.5 1.9 6.3 5.6" /></>);
    case 'menu':
      return navigationIcon(<path d="M5 7h14M5 12h14M5 17h14" />);
    case 'bell':
      return navigationIcon(<><path d="M6.7 16.5h10.6l-1.2-2V10a4.1 4.1 0 0 0-8.2 0v4.5l-1.2 2Z" /><path d="M10 18.5a2.1 2.1 0 0 0 4 0" /></>);
    case 'map':
      return navigationIcon(<><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z" /><path d="M9 4v14M15 6v14" /></>);
    case 'home':
    default:
      return navigationIcon(<><path d="M3.5 10.8 12 3.8l8.5 7" /><path d="M5.7 9.4v10.1h12.6V9.4" /><path d="M9.5 19.5v-5.8h5v5.8" /></>);
  }
}

function itemIcon(item: BottomNavigationItemConfig): ReactNode {
  if (item.icon.type === 'emoji') {
    return <span className="storefront-nav-emoji" aria-hidden="true">{item.icon.value || '•'}</span>;
  }
  if (item.icon.type === 'image' && item.icon.value) {
    return <img className="storefront-nav-image" src={item.icon.value} alt="" aria-hidden="true" />;
  }
  return builtinIcon(item.icon.value);
}

export function primaryNavigationItems(
  navigation: StorefrontCopy['navigation'],
  unreadMessages = 0,
): StorefrontNavigationItem[] {
  return navigation.items
    .filter((item) => item.enabled)
    .map((item) => ({
      href: HREFS[item.key],
      label: item.label,
      icon: itemIcon(item),
      ...(item.key === 'messages' && unreadMessages > 0 ? { badgeCount: unreadMessages } : {}),
    }));
}
