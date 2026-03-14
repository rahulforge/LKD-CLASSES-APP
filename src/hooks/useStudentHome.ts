import { useEffect, useState, useCallback, useRef } from "react";
import { homeService, StudentHomeData } from "../services/homeService";
import useAuth from "./useAuth";
import { cacheService } from "../services/cacheService";

const CACHE_KEY_PREFIX = "student_home_v3";
const CACHE_TTL_MS = 5 * 60 * 1000;
const EMPTY_HOME_DATA: StudentHomeData = {
  meta: null,
  todos: [],
  notices: [],
  offers: [],
  liveToday: null,
  liveNow: null,
  todayLives: [],
  tomorrowLives: [],
};

type HomeCachePayload = {
  userId: string;
  time: number;
  data: StudentHomeData;
};

export default function useStudentHome() {
  const { user } = useAuth();
  const [data, setData] = useState<StudentHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialSetup, setInitialSetup] = useState(false);
  const mountedRef = useRef(true);

  const getCacheKey = useCallback((userId: string) => `${CACHE_KEY_PREFIX}_${userId}`, []);

  /* FETCH FROM SERVER */
  const sync = useCallback(async (userId: string) => {
    const cacheKey = getCacheKey(userId);
    try {
      const fresh = await cacheService.refresh<HomeCachePayload>(cacheKey, async () => ({
        userId,
        time: Date.now(),
        data: await homeService.getStudentHome(userId),
      }));
      if (!mountedRef.current) return;
      setData(fresh.data);
    } catch {
      // silent fail
    } finally {
      if (!mountedRef.current) return;
      setData((prev) => prev ?? EMPTY_HOME_DATA);
      setLoading(false);
      setRefreshing(false);
    }
  }, [getCacheKey]);

  const refresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    await sync(user.id);
  };

  useEffect(() => {
    mountedRef.current = true;
    const bootstrap = async () => {
      if (!user?.id) {
        setData(EMPTY_HOME_DATA);
        setLoading(false);
        setInitialSetup(false);
        return;
      }

      const cacheKey = getCacheKey(user.id);
      const cached = await cacheService.get<HomeCachePayload>(cacheKey, CACHE_TTL_MS);
      if (cached?.userId === user.id && cached?.data) {
        setData(cached.data);
        setLoading(false);
        setInitialSetup(false);
        void sync(user.id);
        return;
      }

      setInitialSetup(true);
      await sync(user.id);
      if (mountedRef.current) {
        setInitialSetup(false);
      }
    };
    void bootstrap();
    return () => {
      mountedRef.current = false;
    };
  }, [getCacheKey, sync, user?.id]);

  return {
    data,
    loading,
    initialSetup,
    refreshing,
    refresh,
  };
}
