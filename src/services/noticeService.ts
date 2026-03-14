import { supabase } from "../../lib/supabase";
import type { TeacherNotice } from "../types/teacher";

type CreateNoticeInput = {
  title: string;
  message: string;
  createdBy?: string;
};

type UpdateNoticeInput = {
  title?: string;
  message?: string;
};

const noticeSelect =
  "id, title, message, created_at, created_by";

const normalizeNotice = (row: any): TeacherNotice => ({
  id: row.id,
  title: row.title ?? "Notice",
  message: row.message ?? "",
  created_at: row.created_at,
  created_by: row.created_by ?? null,
});

export const noticeService = {
  async getNotices(limit?: number): Promise<TeacherNotice[]> {
    let query = supabase
      .from("notices")
      .select(noticeSelect)
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error || !data) {
      let fallbackQuery = supabase
        .from("notices")
        .select("id, massage, created_at")
        .order("created_at", { ascending: false });
      if (limit) {
        fallbackQuery = fallbackQuery.limit(limit);
      }

      const fallback = await fallbackQuery;
      if (fallback.error || !fallback.data) {
        return [];
      }

      return fallback.data.map((row: any) =>
        normalizeNotice({
          ...row,
          title: "Notice",
          created_by: null,
        })
      );
    }

    return data.map(normalizeNotice);
  },

  async createNotice(
    input: CreateNoticeInput | string
  ): Promise<TeacherNotice> {
    const payload =
      typeof input === "string"
        ? { title: "Notice", message: input, createdBy: undefined }
        : input;

    const title = payload.title.trim();
    const message = payload.message.trim();

    if (!title || !message) {
      throw new Error("Notice title and message are required");
    }

    const { data, error } = await supabase
      .from("notices")
      .insert({
        title,
        message,
        created_by: payload.createdBy ?? null,
      })
      .select(noticeSelect)
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to create notice");
    }

    return normalizeNotice(data);
  },

  async updateNotice(
    id: string,
    updates: UpdateNoticeInput
  ): Promise<void> {
    const payload: Record<string, string> = {};

    if (updates.title !== undefined) {
      payload.title = updates.title.trim();
    }
    if (updates.message !== undefined) {
      const message = updates.message.trim();
      payload.message = message;
    }

    const { error } = await supabase
      .from("notices")
      .update(payload)
      .eq("id", id);

    if (error) {
      throw new Error(error.message || "Unable to update notice");
    }
  },

  async deleteNotice(id: string): Promise<void> {
    const { error } = await supabase
      .from("notices")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message || "Unable to delete notice");
    }
  },

  subscribe(onChange: () => void): () => void {
    const channel = supabase
      .channel("teacher_notices_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notices",
        },
        onChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
