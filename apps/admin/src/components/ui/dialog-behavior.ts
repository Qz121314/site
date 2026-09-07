export function shouldDismissAdminDialogKey(
  key: string,
  closeDisabled: boolean,
): boolean {
  return key === 'Escape' && !closeDisabled;
}

export function isAdminDialogFocusTraversalKey(key: string): boolean {
  return key === 'Tab';
}
