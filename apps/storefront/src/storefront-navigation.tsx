import type { StorefrontNavigationItem } from '@site/storefront-ui';
import type { IconComponent } from 'reicon-react/createIcon';
import Home from 'reicon-react/icons/Home';
import Message from 'reicon-react/icons/Message';
import Search from 'reicon-react/icons/Search';
import { Bell, CircleHelp, Grid2X2, Heart, Map, Menu, Star, User } from 'lucide-react';
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

function navigationIcon(Icon: IconComponent): ReactNode {
  return <Icon className="storefront-nav-svg" aria-hidden="true" weight="Outline" />;
}

function lucideNavigationIcon(Icon: typeof Bell): ReactNode {
  return <Icon className="storefront-nav-svg" aria-hidden="true" />;
}

function builtinIcon(name: BottomNavigationBuiltinIcon | string | null): ReactNode {
  switch (name) {
    case 'compass':
      return navigationIcon(Search);
    case 'messages':
      return navigationIcon(Message);
    case 'help':
      return lucideNavigationIcon(CircleHelp);
    case 'grid':
      return lucideNavigationIcon(Grid2X2);
    case 'search':
      return navigationIcon(Search);
    case 'star':
      return lucideNavigationIcon(Star);
    case 'heart':
      return lucideNavigationIcon(Heart);
    case 'user':
      return lucideNavigationIcon(User);
    case 'menu':
      return lucideNavigationIcon(Menu);
    case 'bell':
      return lucideNavigationIcon(Bell);
    case 'map':
      return lucideNavigationIcon(Map);
    case 'home':
    default:
      return navigationIcon(Home);
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
