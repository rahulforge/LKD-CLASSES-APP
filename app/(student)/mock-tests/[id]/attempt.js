import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useAuth from "../../../../src/hooks/useAuth";
import useScreenGuard from "../../../../src/hooks/useScreenGuard";
import { mockTestService } from "../../../../src/services/mockTestService";
import { toastService } from "../../../../src/services/toastService";
import { useAccessGuard } from "../../../../src/hooks/useAccessGuard";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MockTestAttemptScreen() {
  const { id, session } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const guard = useAccessGuard("mock_test");
  const [test, setTest] = useState(null);
  const [testLoading, setTestLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [summary, setSummary] = useState(null);
  const [timeUpSubmitting, setTimeUpSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paidForTest, setPaidForTest] = useState(false);
  const { appHidden } = useScreenGuard({ enabled: true });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setTestLoading(true);
      const data = await mockTestService.getTestWithQuestions(String(id));
      if (!mounted) return;
      if (data) {
        setTest(data.test);
        setQuestions(data.questions);
        const mins = Math.max(1, Number(data.test?.duration_minutes ?? 60));
        setRemainingSec(mins * 60);
        setTimerReady(true);
        setAnswers({});
        setCurrentIndex(0);
        setSummary(null);
      } else {
        setTimerReady(false);
      }
      if (user?.id) {
        const paid = await mockTestService.getPaidTestIds(user.id, [String(id)]);
        if (mounted) setPaidForTest(paid.has(String(id)));
      } else if (mounted) {
        setPaidForTest(false);
      }
      setTestLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [id, session, user?.id]);

  const price = Math.max(0, Number(test?.price ?? 0));
  const isFree =
    test?.is_free === true ||
    test?.is_free === 1 ||
    String(test?.is_free ?? "").toLowerCase() === "true";
  const needsSubscription = !testLoading && !isFree && !guard.allowed;
  const needsTestPay = price > 0 && !paidForTest;
  const locked = !testLoading && (needsSubscription || needsTestPay);

  useEffect(() => {
    if (!testLoading && locked) {
      toastService.info("Access Required", "Please unlock this test first.");
      router.replace(`/(student)/mock-tests/${String(id)}`);
    }
  }, [locked, router, testLoading, id]);

  const canSubmit = useMemo(
    () => questions.length > 0 && Object.keys(answers).length === questions.length,
    [answers, questions.length]
  );

  const timeLabel = useMemo(() => {
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remainingSec]);

  useEffect(() => {
    if (!timerReady || submitting || timeUpSubmitting || summary) return;
    if (remainingSec <= 0 || questions.length === 0) return;
    const t = setInterval(() => setRemainingSec((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [remainingSec, questions.length, submitting, summary, timeUpSubmitting, timerReady]);

  useEffect(() => {
    if (summary) return;
    const onBack = () => true;
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [summary]);

  const submit = useCallback(async (forced = false) => {
    if (!user?.id) return;
    if (!forced && !canSubmit) {
      toastService.info("Incomplete", "Answer all questions first.");
      return;
    }
    if (forced) {
      setTimeUpSubmitting(true);
    } else {
      setSubmitting(true);
    }
    try {
      const payload = questions.map((q) => {
        const selected = typeof answers[q.id] === "number" ? answers[q.id] : -1;
        return {
          question_id: q.id,
          selected_index: selected,
        };
      });
      const result = await mockTestService.submitAttempt({
        testId: String(id),
        studentId: user.id,
        answers: payload,
      });
      const submittedAt = new Date().toISOString();
      await mockTestService.saveLocalAttempt({
        userId: user.id,
        testId: String(id),
        payload: {
          result,
          answers: payload,
          questions: questions.map((q) => ({
            id: q.id,
            question: q.question,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_index: q.correct_index,
          })),
          submittedAt,
        },
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSummary({ ...result, answers: payload });
      toastService.success("Submitted", `Score: ${result.score}`);
      router.replace(`/(student)/mock-tests/${String(id)}/submitted`);
    } catch (error) {
      toastService.error("Failed", error?.message ?? "Unable to submit");
    } finally {
      setSubmitting(false);
      setTimeUpSubmitting(false);
    }
  }, [answers, canSubmit, id, questions, user?.id]);

  useEffect(() => {
    if (!appHidden || submitting || timeUpSubmitting || summary) return;
    toastService.info("Exam Mode", "App switched. Submitting your test.");
    void submit(true);
  }, [appHidden, submitting, submit, summary, timeUpSubmitting]);

  useEffect(() => {
    if (!timerReady || questions.length === 0) return;
    if (remainingSec > 0 || submitting || timeUpSubmitting || summary) return;
    toastService.info("Time Up", "Submitting test automatically.");
    void submit(true);
  }, [remainingSec, questions.length, submitting, submit, summary, timeUpSubmitting, timerReady]);

  const question = questions[currentIndex];

  const goNext = () => {
    if (currentIndex >= questions.length - 1) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentIndex((v) => Math.min(questions.length - 1, v + 1));
  };

  const goPrev = () => {
    if (currentIndex <= 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentIndex((v) => Math.max(0, v - 1));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        padding: 16,
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 24 + insets.bottom,
      }}
    >
      <Text style={styles.heading}>{test?.title ?? "Mock Test"}</Text>
      <View style={styles.timerWrap}>
        <Text style={styles.timerText}>Time Left: {timeLabel}</Text>
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          Question {questions.length ? currentIndex + 1 : 0}/{questions.length}
        </Text>
        <Text style={styles.progressText}>
          Answered {Object.keys(answers).length}/{questions.length}
        </Text>
      </View>

      {question ? (
        <View style={styles.card}>
          <Text style={styles.qText}>{currentIndex + 1}. {question.question}</Text>
          {[question.option_a, question.option_b, question.option_c, question.option_d].map(
            (opt, i) => (
              <TouchableOpacity
                key={`${question.id}-${i}`}
                style={[styles.option, answers[question.id] === i && styles.optionActive]}
                onPress={() => {
                  if (summary) return;
                  setAnswers((prev) => ({ ...prev, [question.id]: i }));
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    answers[question.id] === i && styles.optionTextActive,
                  ]}
                >
                  {String.fromCharCode(65 + i)}. {opt}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      ) : (
        <Text style={styles.empty}>{testLoading ? "Loading questions..." : "No questions"}</Text>
      )}

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          disabled={currentIndex === 0}
          onPress={goPrev}
        >
          <Text style={styles.navText}>Previous</Text>
        </TouchableOpacity>
        {currentIndex < questions.length - 1 ? (
          <TouchableOpacity style={styles.navBtn} onPress={goNext}>
            <Text style={styles.navText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, styles.submitBtn]}
            onPress={() => submit(false)}
            disabled={submitting || !!summary}
          >
            <Text style={styles.navText}>{submitting ? "Submitting..." : "Submit"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!summary && null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1220" },
  heading: { color: "#E5E7EB", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  timerWrap: {
    backgroundColor: "rgba(250,204,21,0.18)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  timerText: { color: "#FACC15", fontSize: 13, fontWeight: "800", textAlign: "center" },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  card: { backgroundColor: "#020617", borderRadius: 12, padding: 12, marginBottom: 12 },
  qText: { color: "#E5E7EB", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  option: { backgroundColor: "#0B1220", borderRadius: 10, padding: 10, marginBottom: 6 },
  optionActive: { backgroundColor: "rgba(56,189,248,0.2)" },
  optionText: { color: "#94A3B8", fontSize: 12 },
  optionTextActive: { color: "#38BDF8", fontWeight: "700" },
  navRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  navBtn: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
  },
  navBtnDisabled: { opacity: 0.5 },
  submitBtn: { backgroundColor: "#38BDF8", borderColor: "#38BDF8" },
  navText: { color: "#E5E7EB", fontWeight: "700", fontSize: 13 },
  empty: { color: "#94A3B8", fontSize: 12 },
  summaryCard: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
  },
  summaryTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  summaryText: { color: "#94A3B8", fontSize: 12, marginBottom: 4 },
  summaryScore: { color: "#38BDF8", fontSize: 14, fontWeight: "800", marginTop: 4 },
  backBtn: { backgroundColor: "#0F172A", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  backText: { color: "#E5E7EB", fontWeight: "700", fontSize: 12 },
  reviewWrap: { marginTop: 12 },
  reviewTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800", marginBottom: 8 },
  reviewCard: { backgroundColor: "#020617", borderRadius: 12, padding: 12, marginBottom: 10 },
  optionCorrect: { backgroundColor: "rgba(34,197,94,0.16)", borderWidth: 1, borderColor: "#22C55E" },
  optionWrong: { backgroundColor: "rgba(248,113,113,0.16)", borderWidth: 1, borderColor: "#F87171" },
  optionCorrectText: { color: "#22C55E", fontWeight: "700" },
  optionWrongText: { color: "#FCA5A5", fontWeight: "700" },
});
