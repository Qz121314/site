import {
  defaultStorefrontLayoutConfig,
  resolveStorefrontLayoutConfig,
  type StorefrontLayoutPage,
} from '@site/shared';
import type { StorefrontBootstrap } from './content';

export function layoutForPage(
  bootstrap: StorefrontBootstrap,
  page: StorefrontLayoutPage,
): 'current' {
  return resolveStorefrontLayoutConfig(
    bootstrap.site.site.storefrontLayout ?? defaultStorefrontLayoutConfig,
  )[page];
}
