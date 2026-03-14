import { useCallback, useEffect, useRef, useState } from "react";
import { teacherDashboardService } from "../services/teacherDashboardService";
import { cacheService } from "../services/cacheService";
import type { TeacherDashboardSummary } from "../types/teacher";
import { CACHE_TTL_MS } from "../utils/constants";
import { STORAGE_KEYS } from "../utils/storageKeys";

export function useTeacherDashboard() {
  const [data, setData] = useState<TeacherDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const sync = useCallback(async () => {
    const key = STORAGE_KEYS.teacherDashboard;

    try {
      const fresh = await cacheService.refresh<TeacherDashboardSummary>(
        key,
        teacherDashboardService.getSummary
      );
      if (!mounted.current) return;
      setData(fresh);
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    const load = async () => {
      const cached = await cacheService.get<TeacherDashboardSummary>(
        STORAGE_KEYS.teacherDashboard,
        CACHE_TTL_MS
      );
      if (cached) {
        setData(cached);
        setLoading(false);
        void sync();
        return;
      }

      await sync();
    };

    void load();

    return () => {
      mounted.current = false;
    };
  }, [sync]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
  }, [sync]);

  return {
    data,
    loading,
    refreshing,
    refresh,
  };
}
