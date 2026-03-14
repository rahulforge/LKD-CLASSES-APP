import { useEffect, useState, useCallback } from "react";
import { materialService, MaterialItem } from "../services/materialService";

/* ================================
   TYPES
================================ */

type UseMaterialsParams = {
  studentClass: string;
  subject: string;
  chapter: string;
  canAccessPaid: boolean;
};

type UseMaterialsResult = {
  materials: MaterialItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/* ================================
   HOOK
================================ */

export function useMaterials(
  params: UseMaterialsParams
): UseMaterialsResult {
  const {
    studentClass,
    subject,
    chapter,
    canAccessPaid,
  } = params;

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* --------------------------------
     FETCH LOGIC
  ---------------------------------*/
  const fetchMaterials = useCallback(async () => {
    // 🚫 Missing required data → do nothing
    if (!studentClass || !subject || !chapter) {
      setMaterials([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await materialService.getMaterials({
        studentClass,
        subject,
        chapter,
        canAccessPaid,
      });

      setMaterials(data);
    } catch {
      setError("Unable to load study material");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [
    studentClass,
    subject,
    chapter,
    canAccessPaid,
  ]);

  /* --------------------------------
     AUTO LOAD
  ---------------------------------*/
  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  /* --------------------------------
     PUBLIC API
  ---------------------------------*/
  return {
    materials,
    loading,
    error,
    refresh: fetchMaterials,
  };
}
