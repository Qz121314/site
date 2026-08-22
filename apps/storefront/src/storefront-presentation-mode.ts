import { parseStorefrontRoute } from './routing';

export type StorefrontPresentationMode = 'root' | 'push';

export function storefrontPresentationMode(pathname: string): StorefrontPresentationMode {
  const route = parseStorefrontRoute(pathname);
  switch (route.type) {
    case 'section':
    case 'product':
    case 'faq-article':
    case 'message':
    case 'message-compose':
      return 'push';
    default:
      return 'root';
  }
}
