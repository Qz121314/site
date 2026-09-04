import type { StorefrontNavigationItem } from '@site/storefront-ui';
import {
  Bell,
  CircleHelp,
  Compass,
  Grid2X2,
  Heart,
  House,
  Map,
  Menu,
  MessageCircle,
  Search,
  Star,
  User,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  BottomNavigationBuiltinIcon,
  BottomNavigationItemConfig,
  BottomNavigationKey,
} from './bottom-navigation';
import { ResilientImage } from './ResilientMedia';

const HREFS: Record<BottomNavigationKey, string> = {
  home: '/',
  browse: '/browse/',
  messages: '/messages/',
  faq: '/faq/',
};

function navigationIcon(Icon: typeof House): ReactNode {
  return <Icon className="storefront-nav-svg" aria-hidden="true" />;
}

function builtinIcon(name: BottomNavigationBuiltinIcon | string | null): ReactNode {
  switch (name) {
    case 'compass':
      return navigationIcon(Compass);
    case 'messages':
      return navigationIcon(MessageCircle);
    case 'help':
      return navigationIcon(CircleHelp);
    case 'grid':
      return navigationIcon(Grid2X2);
    case 'search':
      return navigationIcon(Search);
    case 'star':
      return navigationIcon(Star);
    case 'heart':
      return navigationIcon(Heart);
    case 'user':
      return navigationIcon(User);
    case 'menu':
      return navigationIcon(Menu);
    case 'bell':
      return navigationIcon(Bell);
    case 'map':
      return navigationIcon(Map);
    case 'home':
    default:
      return navigationIcon(House);
  }
}

function itemIcon(item: BottomNavigationItemConfig): ReactNode {
  if (item.icon.type === 'emoji') {
    return (
      <span className="storefront-nav-emoji" aria-hidden="true">
        {item.icon.value || '•'}
      </span>
    );
  }
  if (item.icon.type === 'image' && item.icon.value) {
    return (
      <ResilientImage
        aria-hidden="true"
        alt=""
        className="storefront-nav-image"
        decoding="async"
        fallback={builtinIcon(item.key === 'faq' ? 'help' : item.key)}
        fetchPriority="low"
        src={item.icon.value}
      />
    );
  }
  return builtinIcon(item.icon.value);
}

export function primaryNavigationItems(
  navigationItems: BottomNavigationItemConfig[],
  unreadMessages = 0,
): StorefrontNavigationItem[] {
  return navigationItems
    .filter((item) => item.enabled)
    .map((item) => ({
      href: HREFS[item.key],
      label: item.label,
      icon: itemIcon(item),
      ...(item.key === 'messages' && unreadMessages > 0
        ? { badgeCount: unreadMessages }
        : {}),
    }));
}
