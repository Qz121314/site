import { describe, expect, it } from 'vitest';
import { isPermission, listingKinds, permissions } from './domain';

describe('domain contracts', () => {
  it('keeps listing kinds stable', () => {
    expect(listingKinds).toEqual(['store_service', 'online_service']);
  });

  it('recognizes only declared permissions', () => {
    expect(isPermission('content.publish')).toBe(true);
    expect(isPermission('root.everything')).toBe(false);
    expect(new Set(permissions).size).toBe(permissions.length);
  });
});
