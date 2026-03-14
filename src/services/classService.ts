import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import type {
  Chapter,
  Lecture,
  Subject,
} from "../types/class";
import type { TeacherClassHierarchy } from "../types/teacher";

const TTL_MS = 1000 * 60 * 30;
const CACHE_PREFIX = "lkd_class_v2";

type CachePayload<T> = {
  time: number;
  data: T;
};

const getCacheKey = (...parts: string[]) =>
  `${CACHE_PREFIX}_${parts.join("_")}`;

const isFresh = (time: number) =>
  Date.now() - time < TTL_MS;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );

const normalizeClassValue = (value: string) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

async function resolveClassCandidates(
  rawClass: string
): Promise<string[]> {
  const raw = String(rawClass ?? "").trim();
  if (!raw) return [];
  if (isUuid(raw)) return [raw];

  const rows = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(300);

  if (rows.error || !rows.data?.length) {
    return [raw];
  }

  const normalizedRaw = normalizeClassValue(raw);
  const match = (rows.data as any[]).find((row) => {
    const normalizedName = normalizeClassValue(row.name);
    return (
      normalizedName === normalizedRaw ||
      normalizedName.endsWith(normalizedRaw) ||
      normalizedRaw.endsWith(normalizedName)
    );
  });

  if (match?.id) {
    return [String(match.id), raw];
  }
  return [raw];
}

async function getCached<T>(
  key: string
): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachePayload<T>;
    if (!isFresh(parsed.time)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function setCached<T>(key: string, data: T) {
  const payload: CachePayload<T> = {
    time: Date.now(),
    data,
  };
  await AsyncStorage.setItem(key, JSON.stringify(payload));
}

export const classService = {
  getYouTubeVideoId(lecture: Lecture): string | null {
    const rawUrl = String(lecture.video_url ?? "");
    return (
      lecture.video_id ??
      rawUrl.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1] ??
      rawUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)?.[1] ??
      rawUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/)?.[1] ??
      null
    );
  },

  async getSubjects(studentClass: string): Promise<Subject[]> {
    const cacheKey = getCacheKey(
      "subjects",
      studentClass
    );
    const cached = await getCached<Subject[]>(cacheKey);
    if (cached) {
      void this.refreshSubjects(studentClass);
      return cached;
    }

    return this.refreshSubjects(studentClass);
  },

  async refreshSubjects(
    studentClass: string
  ): Promise<Subject[]> {
    const classCandidates = await resolveClassCandidates(studentClass);
    const classFilter = Array.from(
      new Set(classCandidates.filter(Boolean).map((value) => String(value)))
    );
    if (!classFilter.length) {
      return [];
    }

    const query = supabase
      .from("subjects")
      .select(
        "id, name, slug, order_index, chapters:chapters(count)"
      )
      .order("order_index", { ascending: true });

    if (classFilter.length === 1) {
      query.eq("class_id", classFilter[0]);
    } else {
      query.in("class_id", classFilter);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    const subjects = data.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      order_index: item.order_index,
      chapter_count: item.chapters?.[0]?.count ?? 0,
    })) as Subject[];

    await setCached(
      getCacheKey("subjects", studentClass),
      subjects
    );
    return subjects;
  },

  async getChapters(
    studentClass: string,
    subjectSlug: string
  ): Promise<Chapter[]> {
    const cacheKey = getCacheKey(
      "chapters",
      studentClass,
      subjectSlug
    );
    const cached = await getCached<Chapter[]>(cacheKey);
    if (cached) {
      void this.refreshChapters(studentClass, subjectSlug);
      return cached;
    }

    return this.refreshChapters(studentClass, subjectSlug);
  },

  async refreshChapters(
    studentClass: string,
    subjectSlug: string
  ): Promise<Chapter[]> {
    const classCandidates = await resolveClassCandidates(studentClass);
    const classFilter = Array.from(
      new Set(classCandidates.filter(Boolean).map((value) => String(value)))
    );
    if (!classFilter.length) {
      return [];
    }

    const subjectQuery = supabase
      .from("subjects")
      .select("id")
      .eq("slug", subjectSlug);

    if (classFilter.length === 1) {
      subjectQuery.eq("class_id", classFilter[0]);
    } else {
      subjectQuery.in("class_id", classFilter);
    }

    const { data: subject, error: subjectError } = await subjectQuery.maybeSingle();

    if (subjectError || !subject?.id) return [];

    const { data, error } = await supabase
      .from("chapters")
      .select("id, name, slug, order_index")
      .eq("subject_id", subject.id)
      .order("order_index", { ascending: true });

    if (error || !data) return [];

    const chapters = data as Chapter[];
    await setCached(
      getCacheKey("chapters", studentClass, subjectSlug),
      chapters
    );
    return chapters;
  },

  async getLectures(
    studentClass: string,
    subjectSlug: string,
    chapterSlug: string
  ): Promise<Lecture[]> {
    const cacheKey = getCacheKey(
      "lectures",
      studentClass,
      subjectSlug,
      chapterSlug
    );
    const cached = await getCached<Lecture[]>(cacheKey);
    if (cached) {
      void this.refreshLectures(
        studentClass,
        subjectSlug,
        chapterSlug
      );
      return cached;
    }

    return this.refreshLectures(
      studentClass,
      subjectSlug,
      chapterSlug
    );
  },

  async refreshLectures(
    studentClass: string,
    subjectSlug: string,
    chapterSlug: string
  ): Promise<Lecture[]> {
    const chapters = await this.refreshChapters(
      studentClass,
      subjectSlug
    );
    const chapter = chapters.find(
      (item) => item.slug === chapterSlug
    );

    if (!chapter?.id) return [];

    const { data, error } = await supabase
      .from("lectures")
      .select(
        "id, title, duration, is_free, video_provider, video_id, secure_embed_url, video_url, video_type, class_id, subject_id, chapter_id, created_at"
      )
      .eq("chapter_id", chapter.id)
      .order("created_at", { ascending: true });

    if (error || !data) {
      const fallback = await supabase
        .from("lectures")
        .select("id, title, duration, is_free, video_provider, video_id, secure_embed_url, chapter_id, created_at")
        .eq("chapter_id", chapter.id)
        .order("created_at", { ascending: true });
      if (fallback.error || !fallback.data) return [];
      const legacy = (fallback.data as any[]).map((row) => ({
        ...row,
        video_url: null,
        video_type: null,
      })) as Lecture[];
      await setCached(
        getCacheKey("lectures", studentClass, subjectSlug, chapterSlug),
        legacy
      );
      return legacy;
    }

    const lectures = data as Lecture[];
    await setCached(
      getCacheKey(
        "lectures",
        studentClass,
        subjectSlug,
        chapterSlug
      ),
      lectures
    );
    return lectures;
  },

  async getLectureById(
    lectureId: string
  ): Promise<Lecture | null> {
    const cacheKey = getCacheKey("lecture_by_id", lectureId);
    const cached = await getCached<Lecture>(cacheKey);
    if (cached) {
      return cached;
    }

    const { data, error } = await supabase
      .from("lectures")
      .select(
        "id, title, duration, is_free, video_provider, video_id, secure_embed_url, video_url, video_type, class_id, subject_id, chapter_id, created_at"
      )
      .eq("id", lectureId)
      .single();

    if (error || !data) {
      const fallback = await supabase
        .from("lectures")
        .select("id, title, duration, is_free, video_provider, video_id, secure_embed_url, chapter_id, created_at")
        .eq("id", lectureId)
        .single();
      if (fallback.error || !fallback.data) return null;
      const lecture = {
        ...(fallback.data as any),
        video_url: null,
        video_type: null,
      } as Lecture;
      await setCached(cacheKey, lecture);
      return lecture;
    }
    const lecture = data as Lecture;
    await setCached(cacheKey, lecture);
    return lecture;
  },

  async getLecturesByChapterId(
    chapterId: string,
    excludeLectureId?: string
  ): Promise<Lecture[]> {
    const cacheKey = getCacheKey("lectures_by_chapter", chapterId);
    const cached = await getCached<Lecture[]>(cacheKey);
    if (cached) {
      const filtered = excludeLectureId
        ? cached.filter((row) => row.id !== excludeLectureId)
        : cached;
      void this.refreshLecturesByChapterId(chapterId);
      return filtered;
    }

    const fresh = await this.refreshLecturesByChapterId(chapterId);
    return excludeLectureId
      ? fresh.filter((row) => row.id !== excludeLectureId)
      : fresh;
  },

  async refreshLecturesByChapterId(chapterId: string): Promise<Lecture[]> {
    const primary = await supabase
      .from("lectures")
      .select(
        "id, title, duration, is_free, video_provider, video_id, secure_embed_url, video_url, video_type, class_id, subject_id, chapter_id, created_at"
      )
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: true });

    if (!primary.error && primary.data) {
      const rows = primary.data as Lecture[];
      await setCached(getCacheKey("lectures_by_chapter", chapterId), rows);
      return rows;
    }

    const fallback = await supabase
      .from("lectures")
      .select("id, title, duration, is_free, video_provider, video_id, secure_embed_url, chapter_id, created_at")
      .eq("chapter", chapterId)
      .order("created_at", { ascending: true });

    if (fallback.error || !fallback.data) {
      return [];
    }

    const rows = (fallback.data as any[]).map((row) => ({
      ...row,
      chapter_id: row.chapter_id ?? chapterId,
      video_url: null,
      video_type: null,
      class_id: null,
      subject_id: null,
    })) as Lecture[];
    await setCached(getCacheKey("lectures_by_chapter", chapterId), rows);
    return rows;
  },

  async getYouTubeMeta(lecture: Lecture): Promise<{
    title: string | null;
    author: string | null;
    thumbnail: string | null;
  }> {
    const extractedVideoId = this.getYouTubeVideoId(lecture);
    const videoId =
      lecture.video_provider === "youtube" || String(lecture.video_url ?? "").includes("youtu")
        ? extractedVideoId
        : null;
    if (!videoId) {
      return { title: null, author: null, thumbnail: null };
    }
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      );
      if (!res.ok) {
        return { title: null, author: null, thumbnail: null };
      }
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      return {
        title: data.title?.trim() || null,
        author: data.author_name?.trim() || null,
        thumbnail: data.thumbnail_url?.trim() || null,
      };
    } catch {
      return { title: null, author: null, thumbnail: null };
    }
  },

  getYouTubeEmbedUrl(lecture: Lecture): string | null {
    const rawUrl = String(lecture.video_url ?? "").trim();
    if (lecture.secure_embed_url) {
      return lecture.secure_embed_url
        .replace("https://www.youtube.com/embed/", "https://www.youtube-nocookie.com/embed/")
        .replace("https://youtube.com/embed/", "https://www.youtube-nocookie.com/embed/");
    }

    if (lecture.video_provider !== "youtube" && !rawUrl.includes("youtu")) {
      return rawUrl || null;
    }

    const videoId = this.getYouTubeVideoId(lecture);
    if (!videoId) {
      return rawUrl || null;
    }

    const params =
      "playsinline=1&autoplay=0&mute=0&modestbranding=1&rel=0&iv_load_policy=3&disablekb=1&controls=1&fs=1&enablejsapi=1";
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
  },

  async clearCache() {
    const keys = await AsyncStorage.getAllKeys();
    const classKeys = keys.filter((key) =>
      key.startsWith(CACHE_PREFIX)
    );
    if (classKeys.length) {
      await AsyncStorage.multiRemove(classKeys);
    }
  },

  async getClassHierarchy(): Promise<TeacherClassHierarchy[]> {
    const cacheKey = getCacheKey("teacher_hierarchy");
    const cached = await getCached<TeacherClassHierarchy[]>(
      cacheKey
    );
    if (cached) {
      void this.refreshClassHierarchy();
      return cached;
    }

    return this.refreshClassHierarchy();
  },

  async refreshClassHierarchy(): Promise<TeacherClassHierarchy[]> {
    const { data, error } = await supabase
      .from("classes")
      .select(
        `
        id,
        name,
        subjects (
          id,
          name,
          chapters (
            id,
            name
          )
        )
      `
      )
      .order("name", { ascending: true });

    if (!error && data) {
      const hierarchy = (data as any[]).map((row) => ({
        id: row.id,
        name: row.name ?? "Class",
        subjects: (row.subjects ?? []).map((subject: any) => ({
          id: subject.id,
          name: subject.name ?? "Subject",
          chapters: (subject.chapters ?? []).map((chapter: any) => ({
            id: chapter.id,
            name: chapter.name ?? "Chapter",
          })),
        })),
      }));
      await setCached(getCacheKey("teacher_hierarchy"), hierarchy);
      return hierarchy;
    }

    const fallback = await supabase
      .from("subjects")
      .select("id, name, class_id, chapters(id, name)")
      .order("name", { ascending: true });

    if (fallback.error || !fallback.data) {
      return [];
    }

    const grouped = new Map<string, TeacherClassHierarchy>();
    for (const subject of fallback.data as any[]) {
      const classId = String(subject.class_id ?? "");
      if (!classId) continue;

      if (!grouped.has(classId)) {
        grouped.set(classId, {
          id: classId,
          name: classId,
          subjects: [],
        });
      }

      grouped.get(classId)!.subjects.push({
        id: subject.id,
        name: subject.name ?? "Subject",
        chapters: (subject.chapters ?? []).map((chapter: any) => ({
          id: chapter.id,
          name: chapter.name ?? "Chapter",
        })),
      });
    }

    const hierarchy = Array.from(grouped.values());
    await setCached(getCacheKey("teacher_hierarchy"), hierarchy);
    return hierarchy;
  },

  async getTeacherClasses(): Promise<{ id: string; name: string }[]> {
    const hierarchy = await this.getClassHierarchy();
    return hierarchy.map((item) => ({
      id: item.id,
      name: item.name,
    }));
  },

  async getTeacherSubjects(classId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("class_id", classId)
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as { id: string; name: string }[];
  },

  async getTeacherChapters(subjectId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from("chapters")
      .select("id, name")
      .eq("subject_id", subjectId)
      .order("name", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data as { id: string; name: string }[];
  },

  async createSubject(input: { classId: string; name: string }): Promise<void> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Subject name is required");
    }
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const primary = await supabase
      .from("subjects")
      .insert({ class_id: input.classId, name, slug });

    if (!primary.error) {
      await this.refreshClassHierarchy();
      return;
    }

    const fallback = await supabase
      .from("subjects")
      .insert({ class_id: input.classId, name });

    if (fallback.error) {
      throw new Error(fallback.error.message || primary.error.message || "Unable to create subject");
    }

    await this.refreshClassHierarchy();
  },

  async createChapter(input: {
    subjectId: string;
    name: string;
  }): Promise<void> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Chapter name is required");
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const primary = await supabase
      .from("chapters")
      .insert({
        subject_id: input.subjectId,
        name,
      });

    if (primary.error) {
      let fallbackError = primary.error;
      if ((primary.error.message ?? "").toLowerCase().includes("slug")) {
        const fallback = await supabase
          .from("chapters")
          .insert({
            subject_id: input.subjectId,
            name,
            slug: slug || `chapter-${Date.now()}`,
          });
        fallbackError = fallback.error ?? primary.error;
        if (!fallback.error) {
          await this.refreshClassHierarchy();
          return;
        }
      }

      if (fallbackError.code === "23505") {
        throw new Error("Chapter with same name already exists");
      }
      throw new Error(fallbackError.message || "Unable to create chapter");
    }

    await this.refreshClassHierarchy();
  },

  async updateChapter(input: {
    chapterId: string;
    name: string;
  }): Promise<void> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Chapter name is required");
    }

    const { error } = await supabase
      .from("chapters")
      .update({ name })
      .eq("id", input.chapterId);

    if (error) {
      throw new Error(error.message || "Unable to update chapter");
    }

    await this.refreshClassHierarchy();
  },

  async deleteChapter(input: { chapterId: string }): Promise<void> {
    const { error } = await supabase
      .from("chapters")
      .delete()
      .eq("id", input.chapterId);

    if (error) {
      throw new Error(error.message || "Unable to delete chapter");
    }

    await this.refreshClassHierarchy();
  },

  async getTeacherChapterUploads(input: {
    classId: string;
    subjectId: string;
    chapterId: string;
    limit?: number;
  }): Promise<{
    lectures: {
      id: string;
      title: string;
      video_url: string;
      is_free?: boolean;
      created_at: string;
    }[];
    materials: {
      id: string;
      title: string;
      file_url: string;
      is_preview?: boolean;
      created_at: string;
    }[];
  }> {
    const limit = Math.max(1, Math.min(500, input.limit ?? 20));
    const [lecturesRes, materialsRes] = await Promise.all([
      supabase
        .from("lectures")
        .select("id, title, video_url, is_free, created_at")
        .eq("class_id", input.classId)
        .eq("subject_id", input.subjectId)
        .eq("chapter_id", input.chapterId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("materials")
        .select("id, title, file_url, is_preview, created_at")
        .eq("class_id", input.classId)
        .eq("subject_id", input.subjectId)
        .eq("chapter_id", input.chapterId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);
    if (!lecturesRes.error || !materialsRes.error) {
      return {
        lectures: (lecturesRes.data ?? []) as any[],
        materials: (materialsRes.data ?? []) as any[],
      };
    }

    const [legacyLectures, legacyMaterials] = await Promise.all([
      supabase
        .from("lectures")
        .select("id, title, video_url, is_free, created_at")
        .eq("class", input.classId)
        .eq("subject", input.subjectId)
        .eq("chapter", input.chapterId)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("materials")
        .select("id, title, file_url, is_preview, created_at")
        .eq("class", input.classId)
        .eq("subject", input.subjectId)
        .eq("chapter", input.chapterId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    return {
      lectures: (legacyLectures.data ?? []) as any[],
      materials: (legacyMaterials.data ?? []) as any[],
    };
  },

  async getSubjectChapterContentSummary(input: {
    classId: string;
    subjectId: string;
  }): Promise<Record<string, { lectures: number; materials: number }>> {
    const [lecturesRes, materialsRes] = await Promise.all([
      supabase
        .from("lectures")
        .select("chapter_id")
        .eq("class_id", input.classId)
        .eq("subject_id", input.subjectId),
      supabase
        .from("materials")
        .select("chapter_id")
        .eq("class_id", input.classId)
        .eq("subject_id", input.subjectId),
    ]);

    if (!lecturesRes.error || !materialsRes.error) {
      const summary: Record<
        string,
        { lectures: number; materials: number }
      > = {};
      for (const row of lecturesRes.data ?? []) {
        const key = String((row as any).chapter_id ?? "");
        if (!key) continue;
        if (!summary[key]) summary[key] = { lectures: 0, materials: 0 };
        summary[key].lectures += 1;
      }
      for (const row of materialsRes.data ?? []) {
        const key = String((row as any).chapter_id ?? "");
        if (!key) continue;
        if (!summary[key]) summary[key] = { lectures: 0, materials: 0 };
        summary[key].materials += 1;
      }
      return summary;
    }

    const [legacyLectures, legacyMaterials] = await Promise.all([
      supabase
        .from("lectures")
        .select("chapter")
        .eq("class", input.classId)
        .eq("subject", input.subjectId),
      supabase
        .from("materials")
        .select("chapter")
        .eq("class", input.classId)
        .eq("subject", input.subjectId),
    ]);

    const legacySummary: Record<
      string,
      { lectures: number; materials: number }
    > = {};
    for (const row of legacyLectures.data ?? []) {
      const key = String((row as any).chapter ?? "");
      if (!key) continue;
      if (!legacySummary[key]) {
        legacySummary[key] = { lectures: 0, materials: 0 };
      }
      legacySummary[key].lectures += 1;
    }
    for (const row of legacyMaterials.data ?? []) {
      const key = String((row as any).chapter ?? "");
      if (!key) continue;
      if (!legacySummary[key]) {
        legacySummary[key] = { lectures: 0, materials: 0 };
      }
      legacySummary[key].materials += 1;
    }
    return legacySummary;
  },
};
