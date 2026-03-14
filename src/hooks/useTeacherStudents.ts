import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { studentService } from "../services/studentService";
import type { StudentFilter, TeacherStudent } from "../types/teacher";
import {
  CACHE_TTL_MS,
  DEFAULT_PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
} from "../utils/constants";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { useDebouncedValue } from "./useDebouncedValue";

type CachePayload = {
  time: number;
  data: {
    rows: TeacherStudent[];
    total: number;
  };
};

const inFlight = new Map<string, Promise<void>>();

export function useTeacherStudents(input?: { classId?: string }) {
  const classId = input?.classId ?? "";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StudentFilter>("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TeacherStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const cacheKey = useMemo(
    () =>
      `${STORAGE_KEYS.teacherStudents}_${classId}_${filter}_${debouncedSearch}_${page}_${DEFAULT_PAGE_SIZE}`,
    [classId, debouncedSearch, filter, page]
  );

  const sync = useCallback(async () => {
    const key = cacheKey;
    if (!inFlight.has(key)) {
      inFlight.set(
        key,
        (async () => {
          const result = await studentService.getStudents({
            search: debouncedSearch,
            filter,
            class_id: classId || undefined,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
          });

          if (!mounted.current) return;

          setRows(result.rows);
          setTotal(result.total);
          await AsyncStorage.setItem(
            key,
            JSON.stringify({
              time: Date.now(),
              data: { rows: result.rows, total: result.total },
            } satisfies CachePayload)
          );
        })()
      );
    }

    try {
      await inFlight.get(key);
    } finally {
      inFlight.delete(key);
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [cacheKey, classId, debouncedSearch, filter, page]);

  useEffect(() => {
    mounted.current = true;

    const load = async () => {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as CachePayload;
          setRows(parsed.data.rows);
          setTotal(parsed.data.total);
          setLoading(false);

          if (Date.now() - parsed.time < CACHE_TTL_MS) {
            void sync();
            return;
          }
        } catch {
          // ignore invalid cache
        }
      }

      await sync();
    };

    void load();

    return () => {
      mounted.current = false;
    };
  }, [cacheKey, sync]);

  useEffect(() => {
    setPage(1);
  }, [classId, debouncedSearch, filter]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
  }, [sync]);

  const updateStudent = useCallback(
    async (
      id: string,
      input: {
        name?: string;
        roll_number?: string | null;
        phone?: string | null;
        class_id?: string | null;
        category?: "school" | "competitive";
        student_type?: "online" | "offline";
        admission_paid?: boolean;
      }
    ) => {
      await studentService.updateStudent(id, input);
      await sync();
    },
    [sync]
  );

  const addStudent = useCallback(
    async (input: {
      name: string;
      phone?: string | null;
      class_id: string;
      category: "school" | "competitive";
      student_type: "online" | "offline";
      admission_paid?: boolean;
      roll_number?: string | null;
    }) => {
      await studentService.createStudent(input);
      setPage(1);
      await sync();
    },
    [sync]
  );

  const deleteStudent = useCallback(
    async (id: string) => {
      await studentService.deleteStudent(id);
      await sync();
    },
    [sync]
  );

  const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  const getStudentAccess = useCallback(
    async (input: { studentId: string; userId?: string | null }) =>
      studentService.getStudentAccess(input),
    []
  );

  const setStudentAccess = useCallback(
    async (input: {
      studentId: string;
      userId?: string | null;
      isActive: boolean;
      expiresAt: string | null;
    }) => {
      await studentService.setStudentAccess(input);
      await sync();
    },
    [sync]
  );

  return {
    search,
    setSearch,
    filter,
    setFilter,
    page,
    setPage,
    rows,
    total,
    pageCount,
    loading,
    refreshing,
    refresh,
    updateStudent,
    addStudent,
    deleteStudent,
    getStudentAccess,
    setStudentAccess,
  };
}
