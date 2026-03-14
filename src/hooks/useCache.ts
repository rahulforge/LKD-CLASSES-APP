import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import useNetwork from "./useNetwork";

type CacheState<T> = {
  data: T | null;
  loading: boolean;
  error: boolean;
};

type Fetcher<T> = () => Promise<T>;

export default function useCache<T>(
  key: string,
  fetcher: Fetcher<T>,
  options?: {
    ttlMinutes?: number;
    skip?: boolean;
  }
) {
  const { isOnline } = useNetwork();

  const [state, setState] = useState<CacheState<T>>({
    data: null,
    loading: true,
    error: false,
  });

  const ttl = (options?.ttlMinutes || 30) * 60 * 1000;

  const load = useCallback(async () => {
    if (options?.skip) return;
    try {
      const cachedRaw = await AsyncStorage.getItem(key);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        setState({
          data: cached.data,
          loading: false,
          error: false,
        });

        if (Date.now() - cached.time < ttl) {
          return;
        }
      }

      if (!isOnline) return;

      const fresh = await fetcher();
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          data: fresh,
          time: Date.now(),
        })
      );

      setState({
        data: fresh,
        loading: false,
        error: false,
      });
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: true,
      }));
    }
  }, [fetcher, isOnline, key, options?.skip, ttl]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    if (!isOnline) return;
    setState((p) => ({ ...p, loading: true }));
    try {
      const fresh = await fetcher();
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          data: fresh,
          time: Date.now(),
        })
      );
      setState({ data: fresh, loading: false, error: false });
    } catch {
      setState((p) => ({ ...p, loading: false, error: true }));
    }
  };

  return {
    ...state,
    refresh,
  };
}

