/**
 * TTL cache for Drive JSON. Local storage is cache only, not source of truth.
 */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const PREFIX = 'famplan_cache_';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function cacheGet<T>(key: string): T | null {
  const raw = localStorage.getItem(PREFIX + key);
  if (!raw) return null;
  try {
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  localStorage.setItem(PREFIX + key, JSON.stringify(entry));
}

export function cacheClear(): void {
  const keys: string[] = [];
  const keepKey = PREFIX + CACHE_KEYS.people_last_ok;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX) && k !== keepKey) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

export const CACHE_KEYS = {
  family: 'family',
  people: 'people',
  appointments: 'appointments',
  attachments_index: 'attachments_index',
  /** Persistent fallback - no TTL, updated only on successful Drive load */
  people_last_ok: 'people_last_ok',
} as const;

/** Persistent cache for people fallback. No TTL. */
export function cacheGetPeopleFallback(): unknown[] | null {
  const raw = localStorage.getItem(PREFIX + CACHE_KEYS.people_last_ok);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

export function cacheSetPeopleFallback(people: unknown[]): void {
  localStorage.setItem(PREFIX + CACHE_KEYS.people_last_ok, JSON.stringify(people));
}
