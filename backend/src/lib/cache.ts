/**
 * Simple In-Memory TTL Cache
 * Used to avoid repetitive database lookups for static or semi-static configuration
 * like tenant resolution from phone_number_id.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Set a value in the cache with a Time-To-Live
   * @param key Cache key
   * @param value Data to cache
   * @param ttlSeconds How long the data is valid
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get a value from the cache if it exists and has not expired
   * @param key Cache key
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  /**
   * Remove a specific key from the cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Export a singleton instance for application-wide use
export const appCache = new TTLMemoryCache();
