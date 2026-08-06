import { describe, expect, it } from 'vitest';
import { isLocale, resolveLocale } from './index';

describe('locale helpers', () => {
  it('recognizes supported locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });

  it('resolves a locale from the first path segment', () => {
    expect(resolveLocale('/es/services')).toBe('es');
    expect(resolveLocale('/en/')).toBe('en');
    expect(resolveLocale('/')).toBe('en');
  });
});
