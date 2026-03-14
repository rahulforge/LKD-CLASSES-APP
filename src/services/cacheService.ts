import AsyncStorage from "@react-native-async-storage/async-storage";

type CacheEntry<T> = {
  time: number;
  data: T;
};

const inFlight = new Map<string, Promise<unknown>>();

async function readEntry<T>(key: string): Promise<CacheEntry<T> | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.time !== "number") {
      return null;
    }
    return parsed;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export const cacheService = {
  async get<T>(key: string, ttlMs: number): Promise<T | null> {
    const parsed = await readEntry<T>(key);
    if (!parsed) return null;
    if (Date.now() - parsed.time > ttlMs) return null;
    return parsed.data;
  },

  async set<T>(key: string, data: T): Promise<void> {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        time: Date.now(),
        data,
      } as CacheEntry<T>)
    );
  },

  async refresh<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (!inFlight.has(key)) {
      inFlight.set(
        key,
        (async () => {
          const data = await fetcher();
          await this.set(key, data);
          return data;
        })()
      );
    }

    try {
      return (await inFlight.get(key)) as T;
    } finally {
      inFlight.delete(key);
    }
  },

  async getOrFetch<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
    opts?: { revalidate?: boolean }
  ): Promise<T> {
    const cached = await this.get<T>(key, ttlMs);
    if (cached) {
      if (opts?.revalidate !== false) {
        void this.refresh(key, fetcher);
      }
      return cached;
    }
    return this.refresh(key, fetcher);
  },
};

