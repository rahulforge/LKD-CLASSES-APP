import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { noticeService } from "../services/noticeService";
import { pushNotificationService } from "../services/pushNotificationService";
import type { TeacherNotice } from "../types/teacher";
import { CACHE_TTL_MS } from "../utils/constants";
import { STORAGE_KEYS } from "../utils/storageKeys";

type CachePayload = {
  time: number;
  data: TeacherNotice[];
};

export function useNotices(limit?: number) {
  const [notices, setNotices] = useState<TeacherNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const loadServer = useCallback(async () => {
    const data = await noticeService.getNotices(limit);
    if (!mounted.current) return;

    setNotices(data);
    await AsyncStorage.setItem(
      STORAGE_KEYS.teacherNotices,
      JSON.stringify({ time: Date.now(), data } satisfies CachePayload)
    );

    setLoading(false);
    setRefreshing(false);
  }, [limit]);

  useEffect(() => {
    mounted.current = true;

    const bootstrap = async () => {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.teacherNotices);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as CachePayload;
          setNotices(parsed.data.slice(0, limit ?? parsed.data.length));
          setLoading(false);

          if (Date.now() - parsed.time < CACHE_TTL_MS) {
            void loadServer();
            return;
          }
        } catch {
          // ignore parse errors
        }
      }

      await loadServer();
    };

    void bootstrap();

    const unsubscribe = noticeService.subscribe(() => {
      void loadServer();
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [limit, loadServer]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadServer();
  }, [loadServer]);

  const createNotice = useCallback(
    async (input: { title: string; message: string; createdBy: string }) => {
      const created = await noticeService.createNotice(input);
      try {
        await pushNotificationService.sendToStudents({
          title: `Notice: ${created.title}`,
          body: created.message,
          audience: { scope: "all" },
          data: {
            type: "notice",
            noticeId: created.id,
            createdAt: created.created_at,
          },
        });
      } catch {
        // Notice creation should not fail if push dispatch fails.
      }
      await loadServer();
    },
    [loadServer]
  );

  const updateNotice = useCallback(
    async (id: string, input: { title?: string; message?: string }) => {
      await noticeService.updateNotice(id, input);
      await loadServer();
    },
    [loadServer]
  );

  const deleteNotice = useCallback(
    async (id: string) => {
      await noticeService.deleteNotice(id);
      await loadServer();
    },
    [loadServer]
  );

  return {
    notices,
    loading,
    refreshing,
    refresh,
    createNotice,
    updateNotice,
    deleteNotice,
  };
}
