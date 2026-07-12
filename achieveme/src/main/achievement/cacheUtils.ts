/** Returns true when a cache entry timestamp is still within the TTL window. */
export function isFresh(cachedAt: number, ttlSeconds: number): boolean {
  return Math.floor(Date.now() / 1000) - cachedAt < ttlSeconds
}
