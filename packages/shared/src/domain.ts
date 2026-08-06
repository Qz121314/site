export const listingKinds = ['store_service', 'online_service'] as const;
export type ListingKind = (typeof listingKinds)[number];

export const conversionTypes = ['support', 'tracked_link', 'direct_link'] as const;
export type ConversionType = (typeof conversionTypes)[number];

export const contentStatuses = ['draft', 'review', 'approved', 'published', 'archived'] as const;
export type ContentStatus = (typeof contentStatuses)[number];

export const adminStatuses = ['active', 'disabled'] as const;
export type AdminStatus = (typeof adminStatuses)[number];

export const permissions = [
  'admin.session.read',
  'admin.users.read',
  'admin.users.write',
  'admin.roles.read',
  'admin.roles.write',
  'audit.read',
  'content.read',
  'content.write',
  'content.publish',
  'media.read',
  'media.write',
  'settings.read',
  'settings.write',
] as const;

export type Permission = (typeof permissions)[number];

export function isPermission(value: string): value is Permission {
  return permissions.includes(value as Permission);
}

export type AdminIdentity = {
  id: string;
  email: string;
  displayName: string;
  status: AdminStatus;
  roleKeys: string[];
  permissions: Permission[];
};
