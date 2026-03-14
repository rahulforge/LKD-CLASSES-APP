import { noticeService } from "./noticeService";
import { studentService } from "./studentService";
import type { TeacherDashboardSummary } from "../types/teacher";
import { supabase } from "../../lib/supabase";

async function getRecentUploadCounts() {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [lecturesRes, materialsRes] = await Promise.all([
    supabase
      .from("lectures")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceIso),
  ]);

  return {
    lectures: lecturesRes.count ?? 0,
    materials: materialsRes.count ?? 0,
  };
}

export const teacherDashboardService = {
  async getSummary(): Promise<TeacherDashboardSummary> {
    const [counts, uploads, notices] = await Promise.all([
      studentService.getStudentCounts(),
      getRecentUploadCounts(),
      noticeService.getNotices(5),
    ]);

    return {
      totalStudents: counts.total,
      onlineStudents: counts.online,
      offlineStudents: counts.offline,
      recentUploads: uploads,
      recentNotices: notices,
    };
  },
};
