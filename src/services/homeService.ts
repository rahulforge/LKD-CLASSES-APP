import { supabase } from "../../lib/supabase";
import { noticeService } from "./noticeService";
import { offerService } from "./offerService";

const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

export type StudentHomeData = {
  meta: any | null;
  todos: any[];
  notices: any[];
  offers: any[];
  liveToday: { id: string; title: string; starts_at: string; youtube_unlisted_url: string; status?: string | null } | null;
  liveNow: { id: string; title: string; starts_at: string; youtube_unlisted_url: string; status?: string | null } | null;
  todayLives: { id: string; title: string; starts_at: string; youtube_unlisted_url: string; status?: string | null }[];
  tomorrowLives: { id: string; title: string; starts_at: string; youtube_unlisted_url?: string | null; status?: string | null }[];
};

export const homeService = {
  async getStudentHome(userId: string): Promise<StudentHomeData> {
    const [todos, notices, offers, liveRes] = await Promise.all([
      supabase
        .from("student_todos")
        .select("id, text, due_date, created_at")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      noticeService.getNotices(5),
      offerService.getActiveOffers(3),
      supabase
        .from("live_sessions")
        .select("id, title, starts_at, youtube_unlisted_url, status")
        .in("status", ["scheduled", "live"])
        .order("starts_at", { ascending: true })
        .limit(80),
    ]);

    let liveTodos: any[] = [];
    let taskTodos: any[] = [];
    let liveToday: any = null;
    let liveNow: any = null;
    let todayLives: any[] = [];
    let tomorrowLives: any[] = [];
    const liveRows = (liveRes.data ?? []) as any[];
    if (liveRows.length) {
      const now = Date.now();
      const allFiltered = liveRows.filter((row) => {
        const startsAt = new Date(row.starts_at).getTime();
        if (Number.isNaN(startsAt)) return true;
        return String(row.status ?? "").toLowerCase() === "live" || startsAt >= now;
      });
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setHours(23, 59, 59, 999);

      const todayFiltered = allFiltered.filter((item: any) => {
        const t = new Date(item.starts_at).getTime();
        return !Number.isNaN(t) && t >= todayStart.getTime() && t <= todayEnd.getTime();
      });
      todayLives = todayFiltered;
      liveNow =
        allFiltered.find(
          (item: any) => String(item.status ?? "").toLowerCase() === "live"
        ) ??
        allFiltered.find((item: any) => {
          const startsAt = new Date(item.starts_at).getTime();
          if (Number.isNaN(startsAt)) return false;
          const elapsed = now - startsAt;
          return elapsed >= 0 && elapsed <= 3 * 60 * 60 * 1000;
        }) ??
        null;

      const filtered = allFiltered.filter((item: any) => {
        const t = new Date(item.starts_at).getTime();
        return !Number.isNaN(t) && t >= tomorrowStart.getTime() && t <= tomorrowEnd.getTime();
      });
      tomorrowLives = filtered;
      liveToday = liveNow ?? todayFiltered[0] ?? filtered[0] ?? null;

      liveTodos =
        filtered.map((item: any) => ({
          id: `live-${item.id}`,
          text: `Tomorrow Live: ${item.title} at ${new Date(item.starts_at).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        })) ?? [];
    }

    const todoRows = (todos.data ?? []) as any[];
    if (todoRows.length) {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowKey = toLocalDateKey(tomorrow);

      const dueTomorrow = todoRows.filter(
        (row) => String(row.due_date ?? "").slice(0, 10) === tomorrowKey
      );
      const selectedTasks = (dueTomorrow.length ? dueTomorrow : todoRows).slice(0, 12);

      taskTodos = selectedTasks.map((row) => ({
        id: String(row.id),
        text: String(row.text ?? "").trim(),
        due_date: row.due_date ?? null,
        created_at: row.created_at ?? null,
      }));
    }

    return {
      meta: null,
      todos: [...(liveTodos || []), ...(taskTodos || [])],
      notices: notices || [],
      offers: offers || [],
      liveToday: liveToday || null,
      liveNow: liveNow || null,
      todayLives: todayLives || [],
      tomorrowLives: tomorrowLives || [],
    };
  },
};
