import { supabase } from "../../lib/supabase";

export type TopperSlot = {
  id: string;
  rank: number;
  name: string;
  class: string;
  marks: string;
  obtained_marks: number | null;
  total_marks: number | null;
  image_url: string;
  created_at: string;
};

export const topperService = {
  async getTop3(): Promise<TopperSlot[]> {
    const { data, error } = await supabase
      .from("toppers_top3")
      .select("id, rank, name, class, marks, obtained_marks, total_marks, image_url, created_at")
      .order("rank", { ascending: true });

    if (error || !data) return [];
    return data as TopperSlot[];
  },

  async upsertTopper(input: {
    rank: number;
    name: string;
    class: string;
    marks: string;
    image_url: string;
    obtained_marks?: number | null;
    total_marks?: number | null;
  }): Promise<void> {
    const payload = {
      rank: input.rank,
      name: input.name.trim(),
      class: input.class.trim(),
      marks: input.marks.trim(),
      image_url: input.image_url,
      obtained_marks: input.obtained_marks ?? null,
      total_marks: input.total_marks ?? null,
    };

    const updateByRank = await supabase
      .from("toppers_top3")
      .update(payload)
      .eq("rank", input.rank);

    if (!updateByRank.error && (updateByRank.count ?? 1) >= 0) {
      const existing = await supabase
        .from("toppers_top3")
        .select("id")
        .eq("rank", input.rank)
        .maybeSingle();
      if (!existing.error && existing.data?.id) return;
    }

    const { error } = await supabase.from("toppers_top3").upsert(payload, { onConflict: "rank" });
    if (error) {
      throw new Error(error.message || "Unable to save topper");
    }
  },
};
