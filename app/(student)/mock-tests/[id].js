import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useAuth from "../../../src/hooks/useAuth";
import { mockTestService } from "../../../src/services/mockTestService";
import { useAccessGuard } from "../../../src/hooks/useAccessGuard";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const toBool = (value) =>
  value === true || value === 1 || String(value ?? "").toLowerCase() === "true";

export default function MockTestDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const guard = useAccessGuard("mock_test");
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paidForTest, setPaidForTest] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [attemptHistory, setAttemptHistory] = useState([]);
  const [answerMap, setAnswerMap] = useState({});
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLastResult(null);
      setAttemptHistory([]);
      setAnswerMap({});
      setShowReview(false);
      const data = await mockTestService.getTestWithQuestions(String(id));
      if (!mounted) return;
      if (data) {
        setTest(data.test);
        setQuestions(data.questions);
      }

      if (user?.id) {
        const paid = await mockTestService.getPaidTestIds(user.id, [String(id)]);
        if (mounted) setPaidForTest(paid.has(String(id)));

        const localHistory = await mockTestService.getLocalAttemptHistory(user.id, String(id));
        if (mounted) setAttemptHistory((localHistory || []).filter((item) => item && item.result));
        const local = await mockTestService.getLocalAttempt(user.id, String(id));
        if (mounted && local?.result) {
          setLastResult({
            score: local.result.score,
            correct: local.result.correct,
            wrong: local.result.wrong,
            total: local.result.total,
          });
        } else {
          const result = await mockTestService.getLatestResult(String(id), user.id);
          if (mounted) setLastResult(result ?? null);
        }

        if (result?.attempt_id) {
          const attempts = await mockTestService.getAttemptAnswersByAttemptId(
            String(result.attempt_id)
          );
          if (mounted) {
            const map = {};
            attempts.forEach((a) => {
              map[String(a.question_id)] = a;
            });
            setAnswerMap(map);
          }
        } else if (local?.answers?.length) {
          const map = {};
          local.answers.forEach((a) => {
            map[String(a.question_id)] = a;
          });
          if (mounted) setAnswerMap(map);
        } else if (data?.questions?.length) {
          const attempts = await mockTestService.getLatestAttemptAnswersFallback(
            String(id),
            user.id,
            data.questions.length
          );
          if (mounted) {
            const map = {};
            attempts.forEach((a) => {
              map[String(a.question_id)] = a;
            });
            setAnswerMap(map);
          }
        }
      }

      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
    let mounted = true;
    const refresh = async () => {
      if (!user?.id || !id) return;
      setAttemptHistory([]);
      setAnswerMap({});
      setShowReview(false);
      const localHistory = await mockTestService.getLocalAttemptHistory(user.id, String(id));
      if (mounted) setAttemptHistory((localHistory || []).filter((item) => item && item.result));
      const local = await mockTestService.getLocalAttempt(user.id, String(id));
      if (mounted && local?.result) {
        setLastResult({
          score: local.result.score,
          correct: local.result.correct,
          wrong: local.result.wrong,
          total: local.result.total,
        });
      } else {
        const result = await mockTestService.getLatestResult(String(id), user.id);
        if (mounted) setLastResult(result ?? null);
      }
    };
    void refresh();
    return () => {
      mounted = false;
    };
  }, [id, user?.id]));

  const price = Math.max(0, Number(test?.price ?? 0));
  const isFree = toBool(test?.is_free);
  const needsSubscription = !loading && !isFree && !guard.allowed;
  const needsTestPay = price > 0 && !paidForTest;
  const locked = !loading && (needsSubscription || needsTestPay);

  const hasReview = useMemo(() => {
    if (!lastResult) return false;
    return questions.length > 0 && Object.keys(answerMap).length > 0;
  }, [answerMap, lastResult, questions.length]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        padding: 16,
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 110 + insets.bottom,
      }}
    >
      <Text style={styles.heading}>{test?.title ?? "Mock Test"}</Text>
      <Text style={styles.meta}>Duration: {test?.duration_minutes || 60} min</Text>
      <Text style={styles.meta}>
        Marking: +{Number(test?.marks_per_question ?? 1)} / -{Number(test?.negative_marks ?? 0)}
      </Text>

      <View style={styles.startCard}>
        {!loading ? (
          <>
            <Text style={styles.startText}>Total Questions: {questions.length}</Text>
            <Text style={styles.startText}>
              Total Marks: {Number((questions.length * Number(test?.marks_per_question ?? 1)).toFixed(2))}
            </Text>
            <Text style={styles.startText}>
              Negative Mark: {Number(test?.negative_marks ?? 0)} per wrong
            </Text>
          </>
        ) : null}
        {locked ? (
          <View style={styles.lockBox}>
            {needsSubscription && (
              <>
                <Text style={styles.lockText}>Subscription required for paid tests.</Text>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => router.push("/(student)/subscription")}
                >
                  <Text style={styles.btnText}>Buy Subscription</Text>
                </TouchableOpacity>
              </>
            )}
            {needsTestPay && (
              <>
                <Text style={styles.lockText}>Extra paid test access required.</Text>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() =>
                    router.push({
                      pathname: "/(student)/checkout",
                      params: {
                        flow: "mock_test",
                        amount: String(price),
                        mock_test_id: String(id),
                        title: encodeURIComponent(`Mock Test: ${String(test?.title || "Test")}`),
                      },
                    })
                  }
                >
                  <Text style={styles.btnText}>Pay Rs.{price}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.btn}
            onPress={() =>
              router.push(`/(student)/mock-tests/${String(id)}/attempt?session=${Date.now()}`)
            }
          >
            <Text style={styles.btnText}>Start Test</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Attempts</Text>
        {attemptHistory.length ? (
          attemptHistory.filter((item) => item && item.result).map((item, idx) => (
            <View key={`attempt-${idx}`} style={styles.attemptRow}>
              <View style={styles.attemptHeader}>
                <Text style={styles.summaryText}>
                  #{idx + 1} Score: {item?.result?.score ?? "-"}
                </Text>
                <TouchableOpacity
                  style={styles.attemptBtn}
                  onPress={() => {
                    setAnswerMap(() => {
                      const map = {};
                      if (item?.answers && Array.isArray(item.answers)) {
                        item.answers.forEach((a) => {
                          map[String(a.question_id)] = a;
                        });
                      }
                      return map;
                    });
                    setShowReview(true);
                  }}
                >
                  <Text style={styles.attemptBtnText}>View</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.summaryText}>
                Correct: {item?.result?.correct ?? "-"} | Wrong: {item?.result?.wrong ?? "-"}
              </Text>
              <Text style={styles.summaryMeta}>Total: {item?.result?.total ?? "-"}</Text>
            </View>
          ))
        ) : lastResult ? (
          <>
            <Text style={styles.summaryText}>Score: {lastResult.score}</Text>
            <Text style={styles.summaryText}>
              Correct: {lastResult.correct} | Wrong: {lastResult.wrong}
            </Text>
            <Text style={styles.summaryMeta}>Total: {lastResult.total}</Text>
          </>
        ) : (
          <Text style={styles.summaryText}>No attempts yet.</Text>
        )}
        {hasReview ? (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => setShowReview((v) => !v)}
          >
            <Text style={styles.reviewBtnText}>
              {showReview ? "Hide Answers" : "View Answers"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {hasReview && showReview ? (
        <View style={styles.reviewWrap}>
          <Text style={styles.reviewTitle}>Answer Review</Text>
          {questions.map((q, idx) => {
            const attempt = answerMap[String(q.id)];
            const selectedIndex =
              typeof attempt?.selected_index === "number" ? attempt.selected_index : -1;
            const correctIndex = Number(q.correct_index ?? -1);
            return (
              <View key={q.id} style={styles.card}>
                <Text style={styles.qText}>
                  {idx + 1}. {q.question}
                </Text>
                {[q.option_a, q.option_b, q.option_c, q.option_d].map((opt, i) => {
                  const isSelected = selectedIndex === i;
                  const isCorrect = correctIndex === i;
                  const rowStyle = [styles.option];
                  const textStyle = [styles.optionText];
                  if (isCorrect) {
                    rowStyle.push(styles.optionCorrect);
                    textStyle.push(styles.optionCorrectText);
                  } else if (isSelected) {
                    rowStyle.push(styles.optionWrong);
                    textStyle.push(styles.optionWrongText);
                  }
                  return (
                    <View key={`${q.id}-${i}`} style={rowStyle}>
                      <Text style={textStyle}>
                        {String.fromCharCode(65 + i)}. {opt}
                      </Text>
                    </View>
                  );
                })}
                {selectedIndex >= 0 ? (
                  <Text style={styles.reviewMeta}>
                    Your answer: {String.fromCharCode(65 + selectedIndex)}
                  </Text>
                ) : (
                  <Text style={styles.reviewMeta}>No answer selected.</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {!loading && !questions.length ? (
        <Text style={styles.empty}>No questions found for this test.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1220" },
  heading: { color: "#E5E7EB", fontSize: 20, fontWeight: "800", marginBottom: 6 },
  meta: { color: "#94A3B8", fontSize: 12, marginBottom: 2 },
  startCard: { backgroundColor: "#020617", borderRadius: 12, padding: 14, marginTop: 10, marginBottom: 12 },
  startMeta: { color: "#94A3B8", fontSize: 12, marginBottom: 10 },
  startText: { color: "#E5E7EB", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  lockBox: { marginTop: 6, gap: 8 },
  lockText: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  btn: { backgroundColor: "#38BDF8", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  btnText: { color: "#020617", fontWeight: "800", fontSize: 13 },
  summaryCard: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
  },
  summaryTitle: { color: "#E5E7EB", fontSize: 13, fontWeight: "800", marginBottom: 4 },
  summaryText: { color: "#94A3B8", fontSize: 12, marginBottom: 2 },
  summaryMeta: { color: "#38BDF8", fontSize: 12, fontWeight: "700", marginTop: 2 },
  attemptRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
  },
  attemptHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  attemptBtn: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
  },
  attemptBtnText: { color: "#E5E7EB", fontSize: 11, fontWeight: "700" },
  reviewBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#0F172A",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
  },
  reviewBtnText: { color: "#E5E7EB", fontSize: 12, fontWeight: "700" },
  reviewWrap: { marginTop: 6 },
  reviewTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800", marginBottom: 8 },
  card: { backgroundColor: "#020617", borderRadius: 12, padding: 12, marginBottom: 10 },
  qText: { color: "#E5E7EB", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  option: { backgroundColor: "#0B1220", borderRadius: 10, padding: 10, marginBottom: 6 },
  optionText: { color: "#94A3B8", fontSize: 12 },
  optionCorrect: { backgroundColor: "rgba(34,197,94,0.16)", borderWidth: 1, borderColor: "#22C55E" },
  optionWrong: { backgroundColor: "rgba(248,113,113,0.16)", borderWidth: 1, borderColor: "#F87171" },
  optionCorrectText: { color: "#22C55E", fontWeight: "700" },
  optionWrongText: { color: "#FCA5A5", fontWeight: "700" },
  reviewMeta: { color: "#94A3B8", fontSize: 11, marginTop: 4 },
  empty: { color: "#94A3B8", fontSize: 12 },
});
