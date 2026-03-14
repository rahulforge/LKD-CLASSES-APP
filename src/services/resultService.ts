import { useCallback, useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { authService } from "./authService";
import type { ResultRecord, StudentResult } from "../types/result";

type Performance = {
  label: string;
  color: string;
};

const estimateCounts = (
  totalMarks: number | null,
  obtainedMarks: number | null,
  plusMark = 1,
  negativeMark = 0
): { correct: number; wrong: number } | null => {
  if (totalMarks === null || obtainedMarks === null) return null;
  if (plusMark <= 0 || negativeMark !== 0) return null;
  const totalRaw = totalMarks / plusMark;
  const obtainedRaw = obtainedMarks / plusMark;
  if (!Number.isFinite(totalRaw) || !Number.isFinite(obtainedRaw)) return null;
  const correct = Math.max(0, Math.round(obtainedRaw));
  const wrong = Math.max(0, Math.round(totalRaw) - correct);
  return { correct, wrong };
};

const normalizeResultRow = (row: ResultRecord): StudentResult => {
  const total = Math.max(
    0,
    Number(row.total_marks) || Number(row.marks) || 100
  );
  const obtained = Math.max(
    0,
    Number(row.obtained_marks) || Number(row.marks) || 0
  );
  const rawCorrect = Number(row.correct ?? NaN);
  const rawWrong = Number(row.wrong ?? NaN);
  let correct = Number.isFinite(rawCorrect) ? Math.max(0, rawCorrect) : null;
  let wrong = Number.isFinite(rawWrong) ? Math.max(0, rawWrong) : null;
  if (correct === null && wrong === null) {
    const estimated = estimateCounts(total, obtained, 1, 0);
    if (estimated) {
      correct = estimated.correct;
      wrong = estimated.wrong;
    }
  }
  const percentage =
    total > 0
      ? Math.round((Math.min(obtained, total) / total) * 100)
      : 0;

  return {
    id: row.id,
    name: row.test_name ?? row.exam ?? "Result",
    subject: row.subject ?? "General",
    total,
    obtained: Math.min(obtained, total),
    correct: correct ?? 0,
    wrong: wrong ?? 0,
    date: (row.test_date as string) ?? row.created_at,
    percentage,
  };
};

async function getCurrentStudentRoll(userId: string): Promise<string | null> {
  const fromStudents = await supabase
    .from("students")
    .select("roll_number")
    .eq("user_id", userId)
    .maybeSingle();

  if (!fromStudents.error && fromStudents.data?.roll_number) {
    return String(fromStudents.data.roll_number);
  }

  const fromProfiles = await supabase
    .from("profiles")
    .select("roll_number")
    .eq("id", userId)
    .maybeSingle();

  if (!fromProfiles.error && fromProfiles.data?.roll_number) {
    return String(fromProfiles.data.roll_number);
  }

  return null;
}

function parseExcelRows(rows: Record<string, any>[]) {
  return rows
    .map((row) => {
      const rawCorrect = Number(row.correct ?? row.correct_count ?? row.right ?? NaN);
      const rawWrong = Number(row.wrong ?? row.wrong_count ?? row.incorrect ?? NaN);
      let correct = Number.isFinite(rawCorrect) ? Math.max(0, rawCorrect) : null;
      let wrong = Number.isFinite(rawWrong) ? Math.max(0, rawWrong) : null;
      const plusMark = Math.max(
        0,
        Number(row.plus_mark ?? row.positive_mark ?? row.marks_per_correct ?? 1) || 1
      );
      const negativeMark = Math.max(
        0,
        Number(row.negative_mark ?? row.minus_mark ?? row.negative_marks ?? 0) || 0
      );

      const explicitObtained =
        Number(row.obtained_marks ?? row.marks ?? row.score ?? NaN);
      const computedObtained =
        correct > 0 || wrong > 0
          ? Number((correct * plusMark - wrong * negativeMark).toFixed(2))
          : null;
      const obtainedMarks = Number.isFinite(explicitObtained)
        ? explicitObtained
        : computedObtained;
      const totalMarksRaw = Number(row.total_marks ?? row.total ?? row.max_marks ?? NaN);
      const totalMarks = Number.isFinite(totalMarksRaw)
        ? totalMarksRaw
        : correct > 0 || wrong > 0
          ? Number(((correct + wrong) * plusMark).toFixed(2))
          : null;

      if (correct === null && wrong === null) {
        const estimated = estimateCounts(totalMarks, obtainedMarks, plusMark, negativeMark);
        if (estimated) {
          correct = estimated.correct;
          wrong = estimated.wrong;
        }
      }

      return {
        roll_number: String(
          row.roll_number ?? row.RollNumber ?? row.roll ?? ""
        ).trim(),
        student_name: String(
          row.student_name ?? row.name ?? row.StudentName ?? ""
        ).trim(),
        exam: String(row.exam ?? row.Exam ?? row.test_name ?? row.test ?? "").trim(),
        test_name: String(row.test_name ?? row.test ?? row.exam ?? "").trim(),
        subject: String(row.subject ?? row.Subject ?? "").trim(),
        total_marks: totalMarks,
        obtained_marks: obtainedMarks,
        marks:
          obtainedMarks !== null && obtainedMarks !== undefined
            ? String(obtainedMarks)
            : "",
        correct: correct ?? null,
        wrong: wrong ?? null,
        year: Number(row.year ?? new Date().getFullYear()),
        photo_url: row.photo_url ? String(row.photo_url) : null,
      };
    })
    .filter(
      (row) =>
        row.roll_number &&
        row.exam &&
        (row.marks || row.correct !== null || row.wrong !== null)
    );
}

export const resultService = {
  async getMyResults(userId: string): Promise<StudentResult[]> {
    const rollNumber = await getCurrentStudentRoll(userId);
    if (!rollNumber) {
      return [];
    }

    const byRoll = await supabase
      .from("results")
      .select("*")
      .eq("roll_number", rollNumber)
      .order("created_at", { ascending: false });

    if (!byRoll.error && byRoll.data) {
      return (byRoll.data as ResultRecord[]).map(normalizeResultRow);
    }

    const legacy = await supabase
      .from("results")
      .select("*")
      .eq("student_id", userId)
      .order("test_date", { ascending: false });

    if (legacy.error || !legacy.data) {
      return [];
    }

    return (legacy.data as ResultRecord[]).map(normalizeResultRow);
  },

  async importResultsFromExcel(): Promise<{ imported: number }> {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      throw new Error("File selection cancelled");
    }

    const file = result.assets[0];
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: "base64",
    });

    const workbook = XLSX.read(base64, { type: "base64" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      defval: "",
      raw: false,
    }) as Record<string, any>[];

    const parsed = parseExcelRows(rows);
    if (!parsed.length) {
      throw new Error("No valid result rows found in file");
    }

    const chunkSize = 200;
    for (let i = 0; i < parsed.length; i += chunkSize) {
      const chunk = parsed.slice(i, i + chunkSize);
      const advanced = await supabase
        .from("results")
        .upsert(chunk, {
          onConflict: "roll_number,exam,year",
        });

      if (!advanced.error) {
        continue;
      }

      const fallbackRows = chunk.map((row) => ({
        roll_number: row.roll_number,
        student_name: row.student_name,
        exam: row.exam,
        marks: row.marks,
        correct: row.correct,
        wrong: row.wrong,
        year: row.year,
        photo_url: row.photo_url,
      }));
      const { error } = await supabase
        .from("results")
        .upsert(fallbackRows, {
          onConflict: "roll_number,exam,year",
        });

      if (error) {
        const legacyRows = chunk.map((row) => ({
          roll_number: row.roll_number,
          student_name: row.student_name,
          exam: row.exam,
          marks: row.marks,
          year: row.year,
          photo_url: row.photo_url,
        }));
        const legacy = await supabase
          .from("results")
          .upsert(legacyRows, {
            onConflict: "roll_number,exam,year",
          });
        if (legacy.error) {
          throw new Error(legacy.error.message || error.message || "Result import failed");
        }
      }
    }

    return { imported: parsed.length };
  },

  calculatePercentage(obtained: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round(
      (Math.min(Math.max(obtained, 0), total) / total) * 100
    );
  },

  getPerformanceLabel(percent: number): Performance {
    if (percent >= 75) {
      return { label: "Excellent", color: "#22C55E" };
    }
    if (percent >= 50) {
      return { label: "Good", color: "#38BDF8" };
    }
    return { label: "Needs Improvement", color: "#EF4444" };
  },
};

export default function useResults() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadResults = useCallback(async () => {
    try {
      const session = await authService.getSession();
      const user = session?.user;

      if (!user?.id) {
        setResults([]);
        return;
      }

      const data = await resultService.getMyResults(user.id);
      setResults(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadResults();
  }, [loadResults]);

  return {
    results,
    loading,
    refreshing,
    refresh,
  };
}
