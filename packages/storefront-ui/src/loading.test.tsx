import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadingHalo, LoadingHaloOverlay } from './loading';

describe('shared Halo Loading', () => {
  it('renders reusable size variants without announcing decorative halos', () => {
    const html = renderToStaticMarkup(<LoadingHalo size="small" />);
    expect(html).toContain('class="loading-halo is-small"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('announces blocking overlays once while keeping the inner halo decorative', () => {
    const html = renderToStaticMarkup(<LoadingHaloOverlay label="Loading" />);
    expect(html).toContain('class="loading-halo-overlay"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Loading"');
    expect(html).toContain('class="loading-halo is-large"');
  });
});
