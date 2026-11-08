/**
 * Temporary, conservative route authorization for scoped identities.
 * Only Health is enabled while other domain RLS/API contracts are under audit.
 * This function is NOT a replacement for database RLS.
 */
export function scopedRouteAllowed(pathname: string, modules: readonly string[]): boolean {
  return modules.includes("saude") && (pathname === "/saude" || pathname.startsWith("/saude/"));
}
