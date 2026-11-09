/**
 * Comparison for admin module permissions. Ordering and duplicate labels must
 * not make an already-applied grant set look like a failed write.
 */
export function sameModuleGrants(current: readonly string[], desired: readonly string[]): boolean {
  const a = [...new Set(current)].sort();
  const b = [...new Set(desired)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
