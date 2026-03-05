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
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

export const CACHE_KEYS = {
  family: 'family',
  people: 'people',
  appointments: 'appointments',
  attachments_index: 'attachments_index',
} as const;
