import { supabase } from "../../lib/supabase";
import { classService } from "./classService";
import type { TeacherLectureInput } from "../types/teacher";

export type ParsedYouTube = {
  kind: "youtube_video" | "youtube_playlist" | "unknown";
  normalizedUrl: string;
  playlistId?: string;
};

function extractVideoId(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watchMatch?.[1]) return watchMatch[1];

  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (shortMatch?.[1]) return shortMatch[1];

  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (embedMatch?.[1]) return embedMatch[1];

  return null;
}

function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export const lectureService = {
  parseYouTubeInput(inputUrl: string): ParsedYouTube {
    const url = inputUrl.trim();
    const playlistId = extractPlaylistId(url);

    if (playlistId) {
      return {
        kind: "youtube_playlist",
        playlistId,
        normalizedUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      };
    }

    const videoId = extractVideoId(url);
    if (videoId) {
      return {
        kind: "youtube_video",
        normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }

    return {
      kind: "unknown",
      normalizedUrl: url,
    };
  },

  async createLecture(input: TeacherLectureInput): Promise<void> {
    const firstTry = await supabase.from("lectures").insert({
      title: input.title,
      class_id: input.class_id,
      subject_id: input.subject_id,
      chapter_id: input.chapter_id,
      video_url: input.video_url,
      video_type: input.video_type,
      playlist_id: input.playlist_id ?? null,
      is_free: Boolean(input.is_free),
    });

    if (!firstTry.error) {
      await classService.clearCache();
      return;
    }

    const fallback = await supabase.from("lectures").insert({
      title: input.title,
      class: input.class_id,
      subject: input.subject_id,
      chapter: input.chapter_id,
      video_url: input.video_url,
      is_free: Boolean(input.is_free),
    });

    if (fallback.error) {
      throw new Error(
        fallback.error.message || firstTry.error.message || "Unable to create lecture"
      );
    }
    await classService.clearCache();
  },

  async updateLecture(input: {
    id: string;
    title: string;
    video_url: string;
    is_free?: boolean;
  }): Promise<void> {
    const primary = await supabase
      .from("lectures")
      .update({
        title: input.title.trim(),
        video_url: input.video_url.trim(),
        ...(input.is_free !== undefined ? { is_free: Boolean(input.is_free) } : {}),
      })
      .eq("id", input.id);

    if (!primary.error) {
      await classService.clearCache();
      return;
    }

    const fallback = await supabase
      .from("lectures")
      .update({
        title: input.title.trim(),
        video_url: input.video_url.trim(),
        ...(input.is_free !== undefined ? { is_free: Boolean(input.is_free) } : {}),
      })
      .eq("id", input.id);

    if (fallback.error) {
      throw new Error(fallback.error.message || primary.error.message || "Unable to update lecture");
    }
    await classService.clearCache();
  },

  async deleteLecture(id: string): Promise<void> {
    const { error } = await supabase.from("lectures").delete().eq("id", id);
    if (error) {
      throw new Error(error.message || "Unable to delete lecture");
    }
    await classService.clearCache();
  },
};
