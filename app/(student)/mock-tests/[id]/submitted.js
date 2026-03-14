import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useAuth from "../../../../src/hooks/useAuth";
import { mockTestService } from "../../../../src/services/mockTestService";

export default function MockTestSubmittedScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.id || !id) return;
      setPayload(null);
      const local = await mockTestService.getLocalAttempt(user.id, String(id));
      if (mounted && local) {
        setPayload(local);
        return;
      }

      const data = await mockTestService.getTestWithQuestions(String(id));
      const result = await mockTestService.getLatestResult(String(id), user.id);
      if (!mounted || !data || !result) return;

      const attemptMap = result.attempt_id
        ? await mockTestService.getAttemptAnswersByAttemptId(String(result.attempt_id))
        : await mockTestService.getLatestAttemptAnswersFallback(
            String(id),
            user.id,
            data.questions.length
          );
      const answers = attemptMap.map((a) => ({
        question_id: a.question_id,
        selected_index: a.selected_index,
      }));

      const fallbackPayload = {
        result,
        answers,
        questions: data.questions,
        submittedAt: result.submitted_at || result.created_at || new Date().toISOString(),
      };
      setPayload(fallbackPayload);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [id, user?.id]);

  const result = payload?.result;
  const questions = payload?.questions || [];
  const answers = payload?.answers || [];
  const answerMap = answers.reduce((acc, a) => {
    acc[String(a.question_id)] = a.selected_index;
    return acc;
  }, {});

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        padding: 16,
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 110 + insets.bottom,
      }}
    >
      <Text style={styles.heading}>Test Submitted</Text>
      {result ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Score Card</Text>
          <Text style={styles.summaryText}>Score: {result.score}</Text>
          <Text style={styles.summaryText}>Correct: {result.correct}</Text>
          <Text style={styles.summaryText}>Wrong: {result.wrong}</Text>
          <Text style={styles.summaryMeta}>Total: {result.total}</Text>
        </View>
      ) : (
        <Text style={styles.empty}>Loading result...</Text>
      )}

      {questions.length > 0 ? (
        <View style={styles.reviewWrap}>
          <Text style={styles.reviewTitle}>Answer Review</Text>
          {questions.map((q, idx) => {
            const selectedIndex =
              typeof answerMap[String(q.id)] === "number" ? answerMap[String(q.id)] : -1;
            const correctIndex = Number(q.correct_index ?? -1);
            return (
              <View key={q.id} style={styles.reviewCard}>
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
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace("/(student)/home")}
        >
          <Text style={styles.secondaryText}>Back to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() =>
            router.replace(`/(student)/mock-tests/${String(id)}/attempt?session=${Date.now()}`)
          }
        >
          <Text style={styles.primaryText}>Retake Test</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1220" },
  heading: { color: "#E5E7EB", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  summaryCard: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
  },
  summaryTitle: { color: "#E5E7EB", fontSize: 13, fontWeight: "800", marginBottom: 4 },
  summaryText: { color: "#94A3B8", fontSize: 12, marginBottom: 2 },
  summaryMeta: { color: "#38BDF8", fontSize: 12, fontWeight: "700", marginTop: 2 },
  reviewWrap: { marginTop: 6 },
  reviewTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800", marginBottom: 8 },
  reviewCard: { backgroundColor: "#020617", borderRadius: 12, padding: 12, marginBottom: 10 },
  qText: { color: "#E5E7EB", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  option: { backgroundColor: "#0B1220", borderRadius: 10, padding: 10, marginBottom: 6 },
  optionText: { color: "#94A3B8", fontSize: 12 },
  optionCorrect: { backgroundColor: "rgba(34,197,94,0.16)", borderWidth: 1, borderColor: "#22C55E" },
  optionWrong: { backgroundColor: "rgba(248,113,113,0.16)", borderWidth: 1, borderColor: "#F87171" },
  optionCorrectText: { color: "#22C55E", fontWeight: "700" },
  optionWrongText: { color: "#FCA5A5", fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 16 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.2)",
  },
  secondaryText: { color: "#E5E7EB", fontWeight: "700", fontSize: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#020617", fontWeight: "800", fontSize: 12 },
  empty: { color: "#94A3B8", fontSize: 12 },
});
