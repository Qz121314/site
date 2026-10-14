import { describe, expect, it } from 'vitest';
import { defaultStorefrontLayoutConfig, resolveStorefrontLayoutConfig } from './layout';

describe('storefront layout configuration', () => {
  it('keeps product templates out of site-wide page layout configuration', () => {
    expect(
      resolveStorefrontLayoutConfig({
        ...defaultStorefrontLayoutConfig,
        product: 'template-a',
      }),
    ).toEqual(defaultStorefrontLayoutConfig);
  });
});
