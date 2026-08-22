import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadingHalo } from './loading';

describe('shared Halo Loading', () => {
  it('renders reusable size variants without announcing decorative halos', () => {
    const html = renderToStaticMarkup(<LoadingHalo size="small" />);
    expect(html).toContain('class="loading-halo is-small"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('can announce a labeled connection state directly', () => {
    const html = renderToStaticMarkup(<LoadingHalo size="medium" label="Loading" />);
    expect(html).toContain('class="loading-halo is-medium"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading"');
  });
});
