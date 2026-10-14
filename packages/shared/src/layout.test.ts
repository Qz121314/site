import { describe, expect, it } from 'vitest';
import { defaultStorefrontLayoutConfig, resolveStorefrontLayoutConfig } from './layout';

describe('storefront layout configuration', () => {
  it('keeps the product default and accepts landing page template A', () => {
    expect(resolveStorefrontLayoutConfig(defaultStorefrontLayoutConfig).product).toBe(
      'current',
    );
    expect(
      resolveStorefrontLayoutConfig({
        ...defaultStorefrontLayoutConfig,
        product: 'template-a',
      }),
    ).toEqual({ ...defaultStorefrontLayoutConfig, product: 'template-a' });
  });
});
