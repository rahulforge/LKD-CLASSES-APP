import { supabase } from "../../lib/supabase";

export type LivePoll = {
  id: string;
  live_session_id: string;
  question: string;
  options: string[];
  status: "active" | "closed";
  expires_at: string | null;
  created_at: string;
};

const normalizeOptions = (options: string[]) =>
  Array.from(
    new Set(
      (Array.isArray(options) ? options : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  ).slice(0, 4);

const parseOptions = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 4);
};

const isFuture = (value: string | null | undefined) => {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return true;
  return time > Date.now();
};

const toPoll = (row: any): LivePoll => ({
  id: String(row.id),
  live_session_id: String(row.live_session_id),
  question: String(row.question ?? "").trim(),
  options: parseOptions(row.options),
  status: String(row.status ?? "active").toLowerCase() === "closed" ? "closed" : "active",
  expires_at: row.expires_at ? String(row.expires_at) : null,
  created_at: String(row.created_at ?? new Date().toISOString()),
});

const getCurrentUserId = async (): Promise<string> => {
  const auth = await supabase.auth.getUser();
  const uid = String(auth.data.user?.id ?? "").trim();
  if (!uid) throw new Error("Session expired. Please login again.");
  return uid;
};

export const livePollService = {
  async listPollsForSession(liveSessionId: string, limit = 20): Promise<LivePoll[]> {
    const sessionId = String(liveSessionId ?? "").trim();
    if (!sessionId) return [];
    const { data, error } = await supabase
      .from("live_polls")
      .select("id, live_session_id, question, options, status, expires_at, created_at")
      .eq("live_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(100, Number(limit || 20))));

    if (error || !data) {
      throw new Error(error?.message || "Unable to load polls");
    }
    return (data as any[]).map(toPoll);
  },

  async getActivePollForSession(liveSessionId: string): Promise<LivePoll | null> {
    const rows = await this.listPollsForSession(liveSessionId, 8);
    const active = rows.find((row) => row.status === "active" && isFuture(row.expires_at));
    return active ?? null;
  },

  async createPoll(input: {
    liveSessionId: string;
    question: string;
    options: string[];
    durationMinutes?: number;
  }): Promise<void> {
    const sessionId = String(input.liveSessionId ?? "").trim();
    const question = String(input.question ?? "").trim().slice(0, 220);
    const options = normalizeOptions(input.options);
    if (!sessionId) throw new Error("Live session required.");
    if (!question) throw new Error("Poll question is required.");
    if (options.length < 2) throw new Error("Add at least 2 options.");
    const duration = Math.max(0, Math.min(60, Number(input.durationMinutes ?? 5)));
    const expiresAt =
      duration > 0 ? new Date(Date.now() + duration * 60 * 1000).toISOString() : null;
    const userId = await getCurrentUserId();

    const payload = {
      live_session_id: sessionId,
      question,
      options,
      status: "active",
      expires_at: expiresAt,
      created_by: userId,
    };

    await supabase
      .from("live_polls")
      .update({ status: "closed", expires_at: new Date().toISOString() })
      .eq("live_session_id", sessionId)
      .eq("status", "active");

    const insert = await supabase.from("live_polls").insert(payload);
    if (insert.error) {
      throw new Error(insert.error.message || "Unable to create poll");
    }
  },

  async closePoll(pollId: string): Promise<void> {
    const id = String(pollId ?? "").trim();
    if (!id) return;
    const { error } = await supabase
      .from("live_polls")
      .update({ status: "closed", expires_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      throw new Error(error.message || "Unable to close poll");
    }
  },

  async getMyVote(pollId: string): Promise<number | null> {
    const id = String(pollId ?? "").trim();
    if (!id) return null;
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("live_poll_votes")
      .select("option_index")
      .eq("poll_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || "Unable to load your vote");
    }
    if (!data) return null;
    const index = Number((data as any).option_index);
    return Number.isFinite(index) ? index : null;
  },

  async submitVote(input: { pollId: string; optionIndex: number }): Promise<void> {
    const pollId = String(input.pollId ?? "").trim();
    const optionIndex = Number(input.optionIndex);
    if (!pollId) throw new Error("Poll not found.");
    if (!Number.isInteger(optionIndex) || optionIndex < 0) {
      throw new Error("Invalid poll option.");
    }
    const userId = await getCurrentUserId();
    const payload = {
      poll_id: pollId,
      user_id: userId,
      option_index: optionIndex,
    };

    const upsert = await supabase
      .from("live_poll_votes")
      .upsert(payload, { onConflict: "poll_id,user_id" });
    if (!upsert.error) return;

    const message = String(upsert.error.message ?? "").toLowerCase();
    if (
      message.includes("no unique or exclusion constraint matching the on conflict specification")
    ) {
      const existing = await supabase
        .from("live_poll_votes")
        .select("id")
        .eq("poll_id", pollId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing.error) {
        throw new Error(existing.error.message || "Unable to save vote");
      }
      if (existing.data?.id) {
        const updated = await supabase
          .from("live_poll_votes")
          .update({ option_index: optionIndex })
          .eq("id", existing.data.id);
        if (updated.error) {
          throw new Error(updated.error.message || "Unable to save vote");
        }
        return;
      }
      const inserted = await supabase.from("live_poll_votes").insert(payload);
      if (inserted.error) {
        throw new Error(inserted.error.message || "Unable to save vote");
      }
      return;
    }

    throw new Error(upsert.error.message || "Unable to save vote");
  },

  async getVoteCounts(pollId: string): Promise<Record<string, number>> {
    const id = String(pollId ?? "").trim();
    if (!id) return {};
    const { data, error } = await supabase
      .from("live_poll_votes")
      .select("option_index")
      .eq("poll_id", id)
      .limit(2000);
    if (error || !data) {
      throw new Error(error?.message || "Unable to load poll results");
    }
    return (data as any[]).reduce((acc, row) => {
      const key = String(Number(row.option_index));
      if (!Number.isFinite(Number(key))) return acc;
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  },
};
