import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { classService } from "./classService";
import type { TeacherMaterialInput } from "../types/teacher";

export type MaterialItem = {
  id: string;
  title: string;
  subject: string | null;
  chapter: string | null;
  class: string | null;
  file_url: string;
  pdf_url: string | null;
  is_preview: boolean;
  updated_at: string;
};

type FetchOptions = {
  studentClass: string;
  subject: string;
  chapter: string;
  canAccessPaid: boolean;
};

const CACHE_PREFIX = "material_cache_v2";
const TTL_MS = 1000 * 60 * 30;

const getCacheKey = (
  studentClass: string,
  subject: string,
  chapter: string,
  canAccessPaid: boolean
) =>
  `${CACHE_PREFIX}_${studentClass}_${subject}_${chapter}_${canAccessPaid ? "full" : "preview"}`;

const isFresh = (time: number) =>
  Date.now() - time < TTL_MS;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );

const normalizeText = (value: string) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeLoose = (value: string) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

async function resolveClassId(input: string): Promise<string | null> {
  if (!input) return null;
  if (isUuid(input)) return input;
  const target = normalizeText(input);
  const rows = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(300);
  if (rows.error || !rows.data?.length) return null;
  const match = rows.data.find((row: any) => {
    const name = normalizeText(row.name);
    return (
      name === target ||
      name.endsWith(target) ||
      target.endsWith(name)
    );
  });
  return match?.id ? String(match.id) : null;
}

async function resolveSubjectId(
  classId: string | null,
  input: string
): Promise<string | null> {
  if (!input) return null;
  if (isUuid(input)) return input;
  if (!classId) return null;
  const target = normalizeText(input);
  const bySlug = await supabase
    .from("subjects")
    .select("id")
    .eq("class_id", classId)
    .eq("slug", input)
    .maybeSingle();
  if (!bySlug.error && bySlug.data?.id) {
    return String(bySlug.data.id);
  }
  const byName = await supabase
    .from("subjects")
    .select("id, name")
    .eq("class_id", classId)
    .order("name", { ascending: true })
    .limit(300);
  if (byName.error || !byName.data?.length) return null;
  const looseTarget = normalizeLoose(input);
  const match = byName.data.find((row: any) => {
    const name = normalizeText(row.name);
    const looseName = normalizeLoose(row.name);
    return (
      name === target ||
      looseName === looseTarget
    );
  });
  return match?.id ? String(match.id) : null;
}

async function resolveChapterId(
  subjectId: string | null,
  input: string
): Promise<string | null> {
  if (!input) return null;
  if (isUuid(input)) return input;
  if (!subjectId) return null;
  const target = normalizeText(input);
  const bySlug = await supabase
    .from("chapters")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("slug", input)
    .maybeSingle();
  if (!bySlug.error && bySlug.data?.id) {
    return String(bySlug.data.id);
  }
  const byName = await supabase
    .from("chapters")
    .select("id, name")
    .eq("subject_id", subjectId)
    .order("name", { ascending: true })
    .limit(500);
  if (byName.error || !byName.data?.length) return null;
  const looseTarget = normalizeLoose(input);
  const match = byName.data.find((row: any) => {
    const name = normalizeText(row.name);
    const looseName = normalizeLoose(row.name);
    return (
      name === target ||
      looseName === looseTarget
    );
  });
  return match?.id ? String(match.id) : null;
}

export const materialService = {
  async getMaterialsByChapterId(
    chapterId: string,
    canAccessPaid = true
  ): Promise<MaterialItem[]> {
    const resolvedChapterId = String(chapterId ?? "").trim();
    if (!resolvedChapterId) {
      return [];
    }
    const cacheKey = `${CACHE_PREFIX}_chapter_${resolvedChapterId}_${canAccessPaid ? "full" : "preview"}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (isFresh(parsed?.time) && Array.isArray(parsed?.data)) {
          return parsed.data as MaterialItem[];
        }
      } catch {
        // ignore
      }
    }

    const primary = supabase
      .from("materials")
      .select(
        "id, title, subject, chapter, class, file_url, pdf_url, is_preview, updated_at, class_id, subject_id, chapter_id"
      )
      .eq("chapter_id", resolvedChapterId)
      .order("updated_at", { ascending: false });

    if (!canAccessPaid) {
      primary.eq("is_preview", true);
    }

    const primaryRes = await primary;
    if (!primaryRes.error && primaryRes.data) {
      const mapped = (primaryRes.data as any[]).map((item) => ({
        id: item.id,
        title: item.title,
        subject: item.subject ?? item.subject_id ?? null,
        chapter: item.chapter ?? item.chapter_id ?? null,
        class: item.class ?? item.class_id ?? null,
        file_url: item.file_url ?? item.pdf_url ?? "",
        pdf_url: item.pdf_url ?? null,
        is_preview: Boolean(item.is_preview),
        updated_at: item.updated_at,
      })) as MaterialItem[];
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ time: Date.now(), data: mapped })
      );
      return mapped;
    }

    const fallback = supabase
      .from("materials")
      .select("id, title, subject, chapter, class, file_url, pdf_url, is_preview, updated_at")
      .eq("chapter", resolvedChapterId)
      .order("updated_at", { ascending: false });

    if (!canAccessPaid) {
      fallback.eq("is_preview", true);
    }

    const fallbackRes = await fallback;
    if (fallbackRes.error || !fallbackRes.data) {
      return [];
    }

    const mapped = (fallbackRes.data as any[]).map((item) => ({
      id: item.id,
      title: item.title,
      subject: item.subject ?? null,
      chapter: item.chapter ?? null,
      class: item.class ?? null,
      file_url: item.file_url ?? item.pdf_url ?? "",
      pdf_url: item.pdf_url ?? null,
      is_preview: Boolean(item.is_preview),
      updated_at: item.updated_at,
    })) as MaterialItem[];
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ time: Date.now(), data: mapped })
    );
    return mapped;
  },

  async getMaterials(
    options: FetchOptions
  ): Promise<MaterialItem[]> {
    const {
      studentClass,
      subject,
      chapter,
      canAccessPaid,
    } = options;

    const cacheKey = getCacheKey(
      studentClass,
      subject,
      chapter,
      canAccessPaid
    );
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasRows = Array.isArray(parsed?.data) && parsed.data.length > 0;
        if (isFresh(parsed.time) && hasRows) {
          return parsed.data as MaterialItem[];
        }
      } catch {
        // ignored
      }
    }

    const resolvedClassId = await resolveClassId(studentClass);
    const resolvedSubjectId = await resolveSubjectId(resolvedClassId, subject);
    const resolvedChapterId = await resolveChapterId(resolvedSubjectId, chapter);

    const classCandidates = Array.from(
      new Set([resolvedClassId, studentClass].filter(Boolean).map((value) => String(value)))
    );
    const subjectCandidates = Array.from(
      new Set([resolvedSubjectId, subject].filter(Boolean).map((value) => String(value)))
    );
    const chapterCandidates = Array.from(
      new Set([resolvedChapterId, chapter].filter(Boolean).map((value) => String(value)))
    );

    const query = supabase
      .from("materials")
      .select(
        "id, title, subject, chapter, class, file_url, pdf_url, is_preview, updated_at, class_id, subject_id, chapter_id"
      )
      .order("updated_at", { ascending: false });

    if (classCandidates.length === 1) {
      query.eq("class_id", classCandidates[0]);
    } else if (classCandidates.length > 1) {
      query.in("class_id", classCandidates);
    }
    if (subjectCandidates.length === 1) {
      query.eq("subject_id", subjectCandidates[0]);
    } else if (subjectCandidates.length > 1) {
      query.in("subject_id", subjectCandidates);
    }
    if (chapterCandidates.length === 1) {
      query.eq("chapter_id", chapterCandidates[0]);
    } else if (chapterCandidates.length > 1) {
      query.in("chapter_id", chapterCandidates);
    }

    if (!canAccessPaid) {
      query.eq("is_preview", true);
    }

    const { data, error } = await query;
    if (!error && data) {
      const mapped = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        subject: item.subject ?? item.subject_id ?? null,
        chapter: item.chapter ?? item.chapter_id ?? null,
        class: item.class ?? item.class_id ?? null,
        file_url: item.file_url ?? item.pdf_url ?? "",
        pdf_url: item.pdf_url ?? null,
        is_preview: Boolean(item.is_preview),
        updated_at: item.updated_at,
      })) as MaterialItem[];

      if (mapped.length) {
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ time: Date.now(), data: mapped })
        );
      }

      return mapped;
    }

    const chapterOnlyQuery = supabase
      .from("materials")
      .select(
        "id, title, subject, chapter, class, file_url, pdf_url, is_preview, updated_at, class_id, subject_id, chapter_id"
      )
      .order("updated_at", { ascending: false });

    if (chapterCandidates.length === 1) {
      chapterOnlyQuery.eq("chapter_id", chapterCandidates[0]);
    } else if (chapterCandidates.length > 1) {
      chapterOnlyQuery.in("chapter_id", chapterCandidates);
    }

    if (!canAccessPaid) {
      chapterOnlyQuery.eq("is_preview", true);
    }

    const chapterOnly = await chapterOnlyQuery;
    if (!chapterOnly.error && chapterOnly.data?.length) {
      const mapped = chapterOnly.data.map((item: any) => ({
        id: item.id,
        title: item.title,
        subject: item.subject ?? item.subject_id ?? null,
        chapter: item.chapter ?? item.chapter_id ?? null,
        class: item.class ?? item.class_id ?? null,
        file_url: item.file_url ?? item.pdf_url ?? "",
        pdf_url: item.pdf_url ?? null,
        is_preview: Boolean(item.is_preview),
        updated_at: item.updated_at,
      })) as MaterialItem[];

      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ time: Date.now(), data: mapped })
      );
      return mapped;
    }

    const fallbackQuery = supabase
      .from("materials")
      .select(
        "id, title, subject, chapter, class, file_url, pdf_url, is_preview, updated_at"
      )
      .order("updated_at", { ascending: false });

    if (classCandidates.length === 1) {
      fallbackQuery.eq("class", classCandidates[0]);
    } else if (classCandidates.length > 1) {
      fallbackQuery.in("class", classCandidates);
    }
    if (subjectCandidates.length === 1) {
      fallbackQuery.eq("subject", subjectCandidates[0]);
    } else if (subjectCandidates.length > 1) {
      fallbackQuery.in("subject", subjectCandidates);
    }
    if (chapterCandidates.length === 1) {
      fallbackQuery.eq("chapter", chapterCandidates[0]);
    } else if (chapterCandidates.length > 1) {
      fallbackQuery.in("chapter", chapterCandidates);
    }

    if (!canAccessPaid) {
      fallbackQuery.eq("is_preview", true);
    }

    const fallback = await fallbackQuery;
    if (fallback.error || !fallback.data) {
      const legacyChapterOnlyQuery = supabase
        .from("materials")
        .select(
          "id, title, subject, chapter, class, file_url, pdf_url, is_preview, updated_at"
        )
        .order("updated_at", { ascending: false });

      if (chapterCandidates.length === 1) {
        legacyChapterOnlyQuery.eq("chapter", chapterCandidates[0]);
      } else if (chapterCandidates.length > 1) {
        legacyChapterOnlyQuery.in("chapter", chapterCandidates);
      }
      if (!canAccessPaid) {
        legacyChapterOnlyQuery.eq("is_preview", true);
      }

      const legacyChapterOnly = await legacyChapterOnlyQuery;
      if (legacyChapterOnly.error || !legacyChapterOnly.data) {
        return [];
      }

      const mappedLegacyChapterOnly = legacyChapterOnly.data.map((item: any) => ({
        id: item.id,
        title: item.title,
        subject: item.subject ?? null,
        chapter: item.chapter ?? null,
        class: item.class ?? null,
        file_url: item.file_url ?? item.pdf_url ?? "",
        pdf_url: item.pdf_url ?? null,
        is_preview: Boolean(item.is_preview),
        updated_at: item.updated_at,
      })) as MaterialItem[];

      if (mappedLegacyChapterOnly.length) {
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({ time: Date.now(), data: mappedLegacyChapterOnly })
        );
      }
      return mappedLegacyChapterOnly;
    }

    const legacyMapped = fallback.data.map((item: any) => ({
      id: item.id,
      title: item.title,
      subject: item.subject ?? null,
      chapter: item.chapter ?? null,
      class: item.class ?? null,
      file_url: item.file_url ?? item.pdf_url ?? "",
      pdf_url: item.pdf_url ?? null,
      is_preview: Boolean(item.is_preview),
      updated_at: item.updated_at,
    })) as MaterialItem[];

    if (legacyMapped.length) {
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ time: Date.now(), data: legacyMapped })
      );
    }

    return legacyMapped;
  },

  async clearMaterialCache() {
    const keys = await AsyncStorage.getAllKeys();
    const materialKeys = keys.filter((k) =>
      k.startsWith(CACHE_PREFIX)
    );
    if (materialKeys.length) {
      await AsyncStorage.multiRemove(materialKeys);
    }
  },

  async createMaterial(
    input: TeacherMaterialInput
  ): Promise<void> {
    const primaryInsert = await supabase
      .from("materials")
      .insert({
        title: input.title,
        class_id: input.class_id,
        subject_id: input.subject_id,
        chapter_id: input.chapter_id,
        file_url: input.file_url,
        is_preview: Boolean(input.is_preview),
      });

    if (!primaryInsert.error) {
      await this.clearMaterialCache();
      await classService.clearCache();
      return;
    }

    const fallbackInsert = await supabase
      .from("materials")
      .insert({
        title: input.title,
        class: input.class_id,
        subject: input.subject_id,
        chapter: input.chapter_id,
        file_url: input.file_url,
        pdf_url: input.file_url,
        is_preview: Boolean(input.is_preview),
      });

    if (fallbackInsert.error) {
      throw new Error(
        fallbackInsert.error.message ||
          primaryInsert.error.message ||
          "Unable to create material"
      );
    }
    await this.clearMaterialCache();
    await classService.clearCache();
  },

  async updateMaterial(input: {
    id: string;
    title: string;
    file_url: string;
    is_preview?: boolean;
  }): Promise<void> {
    const primary = await supabase
      .from("materials")
      .update({
        title: input.title.trim(),
        file_url: input.file_url.trim(),
        ...(input.is_preview !== undefined ? { is_preview: Boolean(input.is_preview) } : {}),
      })
      .eq("id", input.id);

    if (!primary.error) {
      await this.clearMaterialCache();
      await classService.clearCache();
      return;
    }

    const fallback = await supabase
      .from("materials")
      .update({
        title: input.title.trim(),
        file_url: input.file_url.trim(),
        pdf_url: input.file_url.trim(),
        ...(input.is_preview !== undefined ? { is_preview: Boolean(input.is_preview) } : {}),
      })
      .eq("id", input.id);

    if (fallback.error) {
      throw new Error(fallback.error.message || primary.error.message || "Unable to update material");
    }
    await this.clearMaterialCache();
    await classService.clearCache();
  },

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) {
      throw new Error(error.message || "Unable to delete material");
    }
    await this.clearMaterialCache();
    await classService.clearCache();
  },
};
