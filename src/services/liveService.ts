import { supabase } from "../../lib/supabase";
import { classService } from "./classService";

function extractVideoId(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watchMatch?.[1]) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (shortMatch?.[1]) return shortMatch[1];
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (embedMatch?.[1]) return embedMatch[1];
  return null;
}

export const liveService = {
  async resolveYouTubeMeta(inputUrl: string): Promise<{
    normalizedUrl: string;
    suggestedTitle: string | null;
  }> {
    const raw = inputUrl.trim();
    if (!raw) {
      return { normalizedUrl: "", suggestedTitle: null };
    }

    const videoId = extractVideoId(raw);
    const normalizedUrl = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : raw;

    if (!videoId) {
      return { normalizedUrl, suggestedTitle: null };
    }

    try {
      const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        return { normalizedUrl, suggestedTitle: null };
      }
      const payload = (await response.json()) as { title?: string };
      return {
        normalizedUrl,
        suggestedTitle: payload.title?.trim() || null,
      };
    } catch {
      return { normalizedUrl, suggestedTitle: null };
    }
  },

  async goLive(input: {
    title: string;
    classId?: string;
    subjectId?: string;
    chapterId?: string;
    className?: string;
    youtubeUnlistedUrl: string;
    teacherId?: string;
    startsAt?: string | null;
    scope?: "class" | "all";
  }): Promise<void> {
    const url = input.youtubeUnlistedUrl.trim();
    if (!url.includes("youtube.com") && !url.includes("youtu.be")) {
      throw new Error("Enter valid YouTube unlisted URL");
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      throw new Error("Invalid schedule date/time");
    }
    const isScheduled = Boolean(startsAt && startsAt.getTime() > Date.now());

    const basePayload = {
      title: input.title.trim(),
      class_id: input.classId ?? null,
      youtube_unlisted_url: url,
      status: isScheduled ? "scheduled" : "live",
      starts_at: startsAt ? startsAt.toISOString() : new Date().toISOString(),
      created_by: input.teacherId ?? null,
      target_scope: input.scope ?? "class",
    };

    const enrichedInsert = await supabase
      .from("live_sessions")
      .insert({
        ...basePayload,
        subject_id: input.subjectId ?? null,
        chapter_id: input.chapterId ?? null,
      });

    if (!enrichedInsert.error) {
      return;
    }

    const fallbackInsert = await supabase
      .from("live_sessions")
      .insert(basePayload);

    if (fallbackInsert.error) {
      throw new Error(
        fallbackInsert.error.message ||
          enrichedInsert.error.message ||
          "Unable to start live class"
      );
    }
  },

  async getMyScheduled(teacherId?: string) {
    let primaryQuery = supabase
      .from("live_sessions")
      .select("id, title, class_id, subject_id, chapter_id, starts_at, status")
      .in("status", ["scheduled", "live"])
      .order("starts_at", { ascending: true })
      .limit(8);
    if (teacherId) {
      primaryQuery = primaryQuery.eq("created_by", teacherId);
    }
    const primary = await primaryQuery;
    if (!primary.error && primary.data) {
      const now = Date.now();
      return (primary.data as any[]).filter((row) => {
        const startsAt = new Date(row.starts_at).getTime();
        if (Number.isNaN(startsAt)) return true;
        return (
          String(row.status ?? "").toLowerCase() === "live" ||
          startsAt >= now
        );
      });
    }

    let fallbackQuery = supabase
      .from("live_sessions")
      .select("id, title, class_id, starts_at, status")
      .in("status", ["scheduled", "live"])
      .order("starts_at", { ascending: true })
      .limit(8);
    if (teacherId) {
      fallbackQuery = fallbackQuery.eq("created_by", teacherId);
    }
    const fallback = await fallbackQuery;
    if (fallback.error || !fallback.data) return [];
    const now = Date.now();
    return (fallback.data as any[]).filter((row) => {
      const startsAt = new Date(row.starts_at).getTime();
      if (Number.isNaN(startsAt)) return true;
      return (
        String(row.status ?? "").toLowerCase() === "live" ||
        startsAt >= now
      );
    });
  },

  async cancelSession(id: string): Promise<void> {
    const sessionRes = await supabase
      .from("live_sessions")
      .select("id, title, class_id, subject_id, chapter_id, youtube_unlisted_url, status")
      .eq("id", id)
      .maybeSingle();

    const session = !sessionRes.error && sessionRes.data ? (sessionRes.data as any) : null;

    if (
      session &&
      String(session.status ?? "").toLowerCase() === "live" &&
      session.class_id &&
      session.subject_id &&
      session.chapter_id &&
      session.youtube_unlisted_url
    ) {
      const lectureTitle = String(session.title ?? "Live Class Recording").trim();
      const videoUrl = String(session.youtube_unlisted_url).trim();
      const primaryInsert = await supabase.from("lectures").insert({
        title: lectureTitle,
        class_id: session.class_id,
        subject_id: session.subject_id,
        chapter_id: session.chapter_id,
        video_url: videoUrl,
        video_type: "youtube",
      });

      if (primaryInsert.error) {
        const fallbackInsert = await supabase.from("lectures").insert({
          title: lectureTitle,
          class: session.class_id,
          subject: session.subject_id,
          chapter: session.chapter_id,
          video_url: videoUrl,
        });
        if (fallbackInsert.error) {
          throw new Error(
            fallbackInsert.error.message ||
              primaryInsert.error.message ||
              "Unable to archive live recording"
          );
        }
      }
      await classService.clearCache();
    }

    const { error } = await supabase
      .from("live_sessions")
      .update({ status: "ended" })
      .eq("id", id);
    if (error) {
      throw new Error(error.message || "Unable to cancel session");
    }
  },
};
