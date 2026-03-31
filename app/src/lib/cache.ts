import { supabase } from './supabase';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL = 5 * 60 * 1000;
const SHORT_TTL = 60 * 1000;

const MAX_CACHE_SIZE = 500;

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, Promise<unknown>>();

  get<T>(key: string, ttl = DEFAULT_TTL): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttl) {
      this.store.delete(key);
      return null;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, { data, timestamp: Date.now() });
    while (this.store.size > MAX_CACHE_SIZE) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
      else break;
    }
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
    this.pendingRequests.clear();
  }

  has(key: string, ttl = DEFAULT_TTL): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > ttl) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async dedupe<T>(key: string, fn: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
    if (this.has(key, ttl)) {
      return this.get<T>(key, ttl) as T;
    }

    const pending = this.pendingRequests.get(key);
    if (pending) return pending as Promise<T>;

    const promise = fn().then(result => {
      this.set(key, result);
      this.pendingRequests.delete(key);
      return result;
    }).catch(err => {
      this.pendingRequests.delete(key);
      throw err;
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}

export const cache = new InMemoryCache();

let cachedSession: { token: string; timestamp: number } | null = null;
let pendingSessionRequest: Promise<string | null> | null = null;
const SESSION_TTL = 30 * 1000;

export async function getCachedSession() {
  if (cachedSession && Date.now() - cachedSession.timestamp < SESSION_TTL) {
    return cachedSession.token;
  }

  if (pendingSessionRequest) return pendingSessionRequest;

  pendingSessionRequest = supabase.auth.getSession().then(({ data, error }) => {
    if (error) return null;
    const token = data.session?.access_token ?? null;
    if (token) {
      cachedSession = { token, timestamp: Date.now() };
    }
    return token;
  }).catch(() => {
    return null;
  }).finally(() => {
    pendingSessionRequest = null;
  });

  return pendingSessionRequest;
}

export function clearSessionCache() {
  cachedSession = null;
  pendingSessionRequest = null;
}

export async function getCachedUser() {
  return cache.dedupe('auth:user', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }, SHORT_TTL);
}

export { DEFAULT_TTL, SHORT_TTL };
