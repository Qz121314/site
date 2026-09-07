import type { ManagedMediaAsset, MediaRole } from './api';

export type MediaPickerSelectionMode = 'assign-role' | 'reference-only';

type RoleAssignmentSelection = {
  mode?: 'assign-role';
  role: MediaRole;
};

type ReferenceOnlySelection = {
  mode: 'reference-only';
  role?: never;
};

export type MediaPickerSelection = RoleAssignmentSelection | ReferenceOnlySelection;

export async function prepareMediaPickerSelection(
  asset: ManagedMediaAsset,
  selection: MediaPickerSelection,
  assignRole: (assetId: string, role: MediaRole) => Promise<unknown>,
): Promise<ManagedMediaAsset> {
  if (selection.mode === 'reference-only') return asset;

  if (asset.roles.includes(selection.role)) return asset;
  await assignRole(asset.id, selection.role);
  return { ...asset, roles: [...asset.roles, selection.role] };
}
