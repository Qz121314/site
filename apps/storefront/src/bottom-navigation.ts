export type BottomNavigationKey = 'home' | 'browse' | 'messages' | 'faq';
export type BottomNavigationBuiltinIcon =
  | 'home'
  | 'compass'
  | 'messages'
  | 'help'
  | 'grid'
  | 'search'
  | 'star'
  | 'heart'
  | 'user'
  | 'menu'
  | 'bell'
  | 'map';

export type BottomNavigationItemConfig = {
  key: BottomNavigationKey;
  label: string;
  enabled: boolean;
  icon: {
    type: 'builtin' | 'emoji' | 'image';
    value: string | null;
  };
};
