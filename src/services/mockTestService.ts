import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";

export type MockQuestion = {
  question: string;
  options: string[];
  correct_index: number;
};

const toBool = (value: unknown) =>
  value === true || value === 1 || String(value ?? "").toLowerCase() === "true";

const normalizeTest = (row: any) => ({
  ...row,
  is_free: toBool(row?.is_free),
  price: Math.max(0, Number(row?.price ?? 0)),
  duration_minutes: Math.max(1, Number(row?.duration_minutes ?? 60)),
  marks_per_question: Math.max(0.25, Number(row?.marks_per_question ?? 1)),
  negative_marks: Math.max(0, Number(row?.negative_marks ?? 0)),
});

const generateUuid = (): string => {
  // Lightweight RFC4122 v4 generator (no dependency).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const mockTestService = {
  localAttemptKey(userId: string, testId: string) {
    return `mock_test_attempt_${String(userId)}_${String(testId)}`;
  },
  localAttemptHistoryKey(userId: string, testId: string) {
    return `mock_test_attempts_${String(userId)}_${String(testId)}`;
  },
  async saveLocalAttempt(input: {
    userId: string;
    testId: string;
    payload: {
      result: {
        score: number;
        total: number;
        correct: number;
        wrong: number;
        marksPerQuestion: number;
        negativeMarks: number;
      };
      answers: { question_id: string; selected_index: number }[];
      questions: {
        id: string;
        question: string;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        correct_index: number;
      }[];
      submittedAt: string;
    };
  }) {
    const key = this.localAttemptKey(input.userId, input.testId);
    await AsyncStorage.setItem(key, JSON.stringify(input.payload));

    const historyKey = this.localAttemptHistoryKey(input.userId, input.testId);
    const rawHistory = await AsyncStorage.getItem(historyKey);
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    const nextHistory = Array.isArray(history) ? history : [];
    const payload = { ...input.payload, testId: String(input.testId) };
    nextHistory.unshift(payload);
    await AsyncStorage.setItem(historyKey, JSON.stringify(nextHistory.slice(0, 25)));
  },
  async getLocalAttempt(userId: string, testId: string) {
    const key = this.localAttemptKey(userId, testId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  async clearLocalAttempt(userId: string, testId: string) {
    const key = this.localAttemptKey(userId, testId);
    await AsyncStorage.removeItem(key);
  },
  async getLocalAttemptHistory(userId: string, testId: string) {
    const key = this.localAttemptHistoryKey(userId, testId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && item.result && String(item.testId) === String(testId));
    } catch {
      return [];
    }
  },
  async resolveClassCandidates(classValue?: string | null): Promise<string[]> {
    const raw = String(classValue ?? "").trim();
    if (!raw) return [];
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
    if (isUuid) return [raw];

    const rows = await supabase
      .from("classes")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(200);
    if (rows.error || !rows.data?.length) return [raw];

    const normalizedRaw = raw.toLowerCase().replace(/\s+/g, "");
    const match = (rows.data as any[]).find((row) => {
      const name = String(row.name ?? "").toLowerCase().replace(/\s+/g, "");
      return name === normalizedRaw || name.endsWith(normalizedRaw) || normalizedRaw.endsWith(name);
    });
    if (match?.id) return [String(match.id), raw];
    return [raw];
  },
  async createMockTest(input: {
    title: string;
    class_id?: string | null;
    program_type?: "all" | "school" | "competitive";
    scheduled_for?: string | null;
    duration_minutes?: number | null;
    marks_per_question?: number | null;
    negative_marks?: number | null;
    questions: MockQuestion[];
    teacher_id?: string;
    is_free?: boolean;
    price?: number | null;
  }): Promise<void> {
    const price = Math.max(0, Number(input.price ?? 0));
    const payload = {
      title: input.title.trim(),
      class_id: input.class_id ?? null,
      program_type: input.program_type ?? "all",
      scheduled_for: input.scheduled_for ?? null,
      duration_minutes: Math.max(1, Math.min(180, Number(input.duration_minutes ?? 60))),
      marks_per_question: Math.max(0.25, Math.min(20, Number(input.marks_per_question ?? 1))),
      negative_marks: Math.max(0, Math.min(20, Number(input.negative_marks ?? 0))),
      created_by: input.teacher_id ?? null,
      is_free: Boolean(input.is_free),
      price: price,
    };

    const primary = await supabase
      .from("mock_tests")
      .insert(payload)
      .select("id")
      .single();

    let data = primary.data;
    if (primary.error) {
      const fallback = await supabase
        .from("mock_tests")
        .insert({
          title: payload.title,
          class_id: payload.class_id,
          program_type: payload.program_type,
          scheduled_for: payload.scheduled_for,
          marks_per_question: payload.marks_per_question,
          negative_marks: payload.negative_marks,
          created_by: payload.created_by,
          is_free: payload.is_free,
          price: payload.price,
        })
        .select("id")
        .single();
      if (fallback.error) {
        const legacyFallback = await supabase
          .from("mock_tests")
          .insert({
            title: payload.title,
            class_id: payload.class_id,
            program_type: payload.program_type,
            scheduled_for: payload.scheduled_for,
            created_by: payload.created_by,
          })
          .select("id")
          .single();
        data = legacyFallback.data;
        if (legacyFallback.error || !data?.id) {
          throw new Error(
            legacyFallback.error?.message ||
              fallback.error?.message ||
              primary.error.message ||
              "Unable to create mock test"
          );
        }
      } else {
        data = fallback.data;
      }
    }
    if (!data?.id) {
      throw new Error("Unable to create mock test");
    }

    const rows = input.questions
      .filter((q) => q.question.trim() && q.options.length >= 2)
      .map((q, idx) => ({
        mock_test_id: data.id,
        order_no: idx + 1,
        question: q.question.trim(),
        option_a: q.options[0] ?? "",
        option_b: q.options[1] ?? "",
        option_c: q.options[2] ?? "",
        option_d: q.options[3] ?? "",
        correct_index: q.correct_index,
      }));

    if (!rows.length) {
      throw new Error("At least one valid question required");
    }

    const qInsert = await supabase.from("mock_test_questions").insert(rows);
    if (qInsert.error) {
      throw new Error(qInsert.error.message || "Unable to save questions");
    }
  },

  async getAvailableTestsForStudent(input: {
    class_id?: string | null;
    program_type?: string | null;
  }) {
    const classCandidates = await this.resolveClassCandidates(input.class_id ?? null);
    const res = await supabase
      .from("mock_tests")
      .select(
        "id, title, class_id, program_type, scheduled_for, duration_minutes, marks_per_question, negative_marks, is_free, price, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (res.error || !res.data) return [];

    const classSet = new Set(classCandidates.filter(Boolean).map((v) => String(v)));
    return (res.data as any[])
      .map(normalizeTest)
      .filter((row) => {
      const classOk =
        !row.class_id ||
        classSet.size === 0 ||
        classSet.has(String(row.class_id ?? ""));
      const programOk =
        row.program_type === "all" ||
        String(row.program_type ?? "").toLowerCase() === String(input.program_type ?? "").toLowerCase();
      return classOk && programOk;
      });
  },

  async getTestWithQuestions(testId: string) {
    const [testRes, qRes] = await Promise.all([
      supabase.from("mock_tests").select("*").eq("id", testId).maybeSingle(),
      supabase
        .from("mock_test_questions")
        .select("id, question, option_a, option_b, option_c, option_d, correct_index")
        .eq("mock_test_id", testId)
        .order("order_no", { ascending: true }),
    ]);

    if (testRes.error || !testRes.data || qRes.error || !qRes.data) {
      return null;
    }

    return {
      test: normalizeTest(testRes.data),
      questions: qRes.data as any[],
    };
  },

  async getPaidTestIds(userId: string, testIds: string[]): Promise<Set<string>> {
    const ids = Array.from(new Set(testIds.filter(Boolean)));
    if (!userId || !ids.length) return new Set();
    const { data, error } = await supabase
      .from("mock_test_payments")
      .select("mock_test_id")
      .eq("user_id", userId)
      .in("mock_test_id", ids);
    if (error || !data) return new Set();
    return new Set(data.map((row: any) => String(row.mock_test_id)));
  },

  async submitAttempt(input: {
    testId: string;
    studentId: string;
    answers: { question_id: string; selected_index: number }[];
  }): Promise<{
    score: number;
    total: number;
    correct: number;
    wrong: number;
    marksPerQuestion: number;
    negativeMarks: number;
  }> {
    const testMetaRes = await supabase
      .from("mock_tests")
      .select("id, marks_per_question, negative_marks")
      .eq("id", input.testId)
      .maybeSingle();
    const marksPerQuestion = Math.max(
      0.25,
      Number(testMetaRes.data?.marks_per_question ?? 1)
    );
    const negativeMarks = Math.max(
      0,
      Number(testMetaRes.data?.negative_marks ?? 0)
    );

    const questionIds = input.answers.map((a) => a.question_id);
    const correctRes = await supabase
      .from("mock_test_questions")
      .select("id, correct_index")
      .in("id", questionIds);

    if (correctRes.error || !correctRes.data) {
      throw new Error("Unable to verify answers");
    }

    const correctMap = new Map(correctRes.data.map((q: any) => [q.id, q.correct_index]));
    let attemptId: string | null = generateUuid();
    let attempts = input.answers.map((a) => {
      const correct = Number(correctMap.get(a.question_id) ?? -1);
      return {
        mock_test_id: input.testId,
        question_id: a.question_id,
        student_id: input.studentId,
        selected_index: a.selected_index,
        is_correct: correct === a.selected_index,
        attempt_id: attemptId,
      };
    });

    let insert = await supabase
      .from("mock_test_attempts")
      .upsert(attempts, { onConflict: "question_id,student_id" });
    if (insert.error && String(insert.error.message || "").includes("attempt_id")) {
      attemptId = null;
      attempts = attempts.map(({ attempt_id, ...rest }) => rest);
      insert = await supabase
        .from("mock_test_attempts")
        .upsert(attempts, { onConflict: "question_id,student_id" });
    }
    if (insert.error) {
      throw new Error(insert.error.message || "Unable to submit test");
    }

    const correct = attempts.filter((a) => a.is_correct).length;
    const total = attempts.length;
    const wrong = Math.max(0, total - correct);
    const score = Number(
      Math.max(0, correct * marksPerQuestion - wrong * negativeMarks).toFixed(2)
    );

    const resultCleanup = await supabase
      .from("mock_test_results")
      .delete()
      .eq("mock_test_id", input.testId)
      .eq("student_id", input.studentId);
    if (resultCleanup.error) {
      throw new Error(resultCleanup.error.message || "Unable to reset test result");
    }

    let resultInsert = await supabase.from("mock_test_results").insert({
      mock_test_id: input.testId,
      student_id: input.studentId,
      score,
      correct,
      wrong,
      total,
      attempt_id: attemptId,
      submitted_at: new Date().toISOString(),
    });
    if (resultInsert.error && String(resultInsert.error.message || "").includes("attempt_id")) {
      resultInsert = await supabase.from("mock_test_results").insert({
        mock_test_id: input.testId,
        student_id: input.studentId,
        score,
        correct,
        wrong,
        total,
        submitted_at: new Date().toISOString(),
      });
    }
    if (resultInsert.error) {
      throw new Error(resultInsert.error.message || "Unable to save test result");
    }

    return {
      score,
      total,
      correct,
      wrong,
      marksPerQuestion,
      negativeMarks,
    };
  },

  async getLatestResult(testId: string, studentId: string) {
    if (!testId || !studentId) return null;
    const baseSelect = "id, score, correct, wrong, total, submitted_at, attempt_id, created_at";
    const res = await supabase
      .from("mock_test_results")
      .select(baseSelect)
      .eq("mock_test_id", testId)
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!res.error) return res.data;

    if (String(res.error.message || "").includes("attempt_id")) {
      const fallback = await supabase
        .from("mock_test_results")
        .select("id, score, correct, wrong, total, submitted_at, created_at")
        .eq("mock_test_id", testId)
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return fallback.data ?? null;
    }

    return null;
  },

  async getAttemptAnswersByAttemptId(attemptId: string) {
    if (!attemptId) return [];
    const res = await supabase
      .from("mock_test_attempts")
      .select("question_id, selected_index, is_correct")
      .eq("attempt_id", attemptId);
    if (res.error || !res.data) return [];
    return res.data as any[];
  },

  async getLatestAttemptAnswersFallback(
    testId: string,
    studentId: string,
    questionCount: number
  ) {
    if (!testId || !studentId || !questionCount) return [];
    const res = await supabase
      .from("mock_test_attempts")
      .select("question_id, selected_index, is_correct, created_at")
      .eq("mock_test_id", testId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(questionCount);
    if (res.error || !res.data) return [];
    return res.data as any[];
  },
};
