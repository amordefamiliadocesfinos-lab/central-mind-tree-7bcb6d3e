/**
 * M5 read-only request epoch. Invalidating an epoch prevents an earlier
 * asynchronous read from publishing stale authorized state after logout,
 * revocation simulation, tab reactivation or a new explicit refresh.
 * No network, browser API, secrets, database writes or privileges.
 */
export function createM5RequestGuard() {
  let epoch = 0;
  return {
    issue(): number { epoch += 1; return epoch; },
    invalidate(): void { epoch += 1; },
    isCurrent(token: number): boolean {
      return Number.isSafeInteger(token) && token > 0 && token === epoch;
    },
  };
}
