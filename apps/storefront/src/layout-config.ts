import {
  defaultStorefrontLayoutConfig,
  resolveStorefrontLayoutConfig,
  type StorefrontLayoutKey,
  type StorefrontLayoutPage,
} from '@site/shared';
import type { StorefrontBootstrap } from './content';

export function layoutForPage(
  bootstrap: StorefrontBootstrap,
  page: StorefrontLayoutPage,
): StorefrontLayoutKey {
  return resolveStorefrontLayoutConfig(
    bootstrap.site.site.storefrontLayout ?? defaultStorefrontLayoutConfig,
  )[page];
}
