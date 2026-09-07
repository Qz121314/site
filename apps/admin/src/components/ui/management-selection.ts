export function toggleSelection(current: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function toggleVisibleSelection(
  current: ReadonlySet<string>,
  visibleIds: readonly string[],
  allVisibleSelected: boolean,
): Set<string> {
  const next = new Set(current);
  for (const id of visibleIds) {
    if (allVisibleSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}
