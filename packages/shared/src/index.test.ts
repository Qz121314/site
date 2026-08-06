import { describe, expect, it } from 'vitest';
import { appVersion, publicLanguage } from './index';

describe('shared platform constants', () => {
  it('uses English as the only public language', () => {
    expect(publicLanguage).toBe('en');
  });

  it('exposes the application version', () => {
    expect(appVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
