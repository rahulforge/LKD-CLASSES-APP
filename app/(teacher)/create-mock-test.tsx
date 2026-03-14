import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useAuth from "../../src/hooks/useAuth";
import { useTeacherClasses } from "../../src/hooks/useTeacherClasses";
import { mockTestService } from "../../src/services/mockTestService";
import { toastService } from "../../src/services/toastService";
import { APP_THEME } from "../../src/utils/constants";

const emptyQuestion = {
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_index: 0,
};

export default function CreateMockTestScreen() {
  const { user } = useAuth();
  const { classes } = useTeacherClasses();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [programType, setProgramType] = useState<"all" | "school" | "competitive">("all");
  const [dueDate, setDueDate] = useState("");
  const [duration, setDuration] = useState("60");
  const [marksPerQuestion, setMarksPerQuestion] = useState("1");
  const [negativeMarks, setNegativeMarks] = useState("0");
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState("0");
  const [questions, setQuestions] = useState([{ ...emptyQuestion }]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      toastService.error("Missing", "Enter test name");
      return;
    }
    const validQuestions = questions.filter(
      (item) => item.question.trim() && item.option_a.trim() && item.option_b.trim()
    );
    if (!validQuestions.length) {
      toastService.error("Missing", "Add at least one valid question with option A/B.");
      return;
    }
    setSaving(true);
    try {
      await mockTestService.createMockTest({
        title: title.trim(),
        class_id: classId || null,
        program_type: programType,
        scheduled_for: dueDate || null,
        duration_minutes: Number(duration || 60),
        marks_per_question: Number(marksPerQuestion || 1),
        negative_marks: Number(negativeMarks || 0),
        teacher_id: user?.id,
        is_free: isFree,
        price: Number(price || 0),
        questions: validQuestions.map((q) => ({
          question: q.question,
          options: [q.option_a, q.option_b, q.option_c, q.option_d],
          correct_index: q.correct_index,
        })),
      });
      toastService.success("Done", "Mock test created.");
      setTitle("");
      setClassId("");
      setProgramType("all");
      setDueDate("");
      setDuration("60");
      setMarksPerQuestion("1");
      setNegativeMarks("0");
      setIsFree(false);
      setPrice("0");
      setQuestions([{ ...emptyQuestion }]);
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to create mock test");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.heading}>Create Mock Test</Text>
      <Text style={styles.meta}>Add questions and set + / - marking scheme for final score.</Text>

      <Text style={styles.label}>Test Name</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={APP_THEME.muted} />

      <Text style={styles.label}>Program</Text>
      <View style={styles.row}>
        <Choice label="All" active={programType === "all"} onPress={() => setProgramType("all")} />
        <Choice label="School" active={programType === "school"} onPress={() => setProgramType("school")} />
        <Choice label="Competitive" active={programType === "competitive"} onPress={() => setProgramType("competitive")} />
      </View>

      <Text style={styles.label}>Class (optional)</Text>
      <View style={styles.chips}>
        {classes.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, classId === c.id && styles.chipActive]}
            onPress={() => setClassId(classId === c.id ? "" : c.id)}
          >
            <Text style={styles.chipText}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="2026-03-31" placeholderTextColor={APP_THEME.muted} />

      <Text style={styles.label}>Duration (minutes)</Text>
      <TextInput
        style={styles.input}
        value={duration}
        onChangeText={setDuration}
        keyboardType="numeric"
        placeholder="60"
        placeholderTextColor={APP_THEME.muted}
      />

      <Text style={styles.label}>Marks per Correct Answer (+)</Text>
      <TextInput
        style={styles.input}
        value={marksPerQuestion}
        onChangeText={setMarksPerQuestion}
        keyboardType="decimal-pad"
        placeholder="1"
        placeholderTextColor={APP_THEME.muted}
      />

      <Text style={styles.label}>Negative Mark per Wrong Answer (-)</Text>
      <TextInput
        style={styles.input}
        value={negativeMarks}
        onChangeText={setNegativeMarks}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={APP_THEME.muted}
      />

      <Text style={styles.label}>Availability</Text>
      <View style={styles.row}>
        <Choice label="Paid" active={!isFree} onPress={() => setIsFree(false)} />
        <Choice label="Free" active={isFree} onPress={() => setIsFree(true)} />
      </View>

      <>
        <Text style={styles.label}>Extra Price for This Test (optional)</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={APP_THEME.muted}
        />
        <Text style={styles.helpText}>
          Keep 0 for normal access. Set amount for special paid test.
        </Text>
      </>

      {questions.map((q, qIndex) => (
        <View key={`q-${qIndex}`} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Question {qIndex + 1}</Text>
            {questions.length > 1 && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => setQuestions((prev) => prev.filter((_, idx) => idx !== qIndex))}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.input}
            value={q.question}
            onChangeText={(v) =>
              setQuestions((prev) =>
                prev.map((item, idx) => (idx === qIndex ? { ...item, question: v } : item))
              )
            }
            placeholder="Enter question"
            placeholderTextColor={APP_THEME.muted}
          />
          <TextInput
            style={styles.input}
            value={q.option_a}
            onChangeText={(v) =>
              setQuestions((prev) =>
                prev.map((item, idx) => (idx === qIndex ? { ...item, option_a: v } : item))
              )
            }
            placeholder="Option A"
            placeholderTextColor={APP_THEME.muted}
          />
          <TextInput
            style={styles.input}
            value={q.option_b}
            onChangeText={(v) =>
              setQuestions((prev) =>
                prev.map((item, idx) => (idx === qIndex ? { ...item, option_b: v } : item))
              )
            }
            placeholder="Option B"
            placeholderTextColor={APP_THEME.muted}
          />
          <TextInput
            style={styles.input}
            value={q.option_c}
            onChangeText={(v) =>
              setQuestions((prev) =>
                prev.map((item, idx) => (idx === qIndex ? { ...item, option_c: v } : item))
              )
            }
            placeholder="Option C"
            placeholderTextColor={APP_THEME.muted}
          />
          <TextInput
            style={styles.input}
            value={q.option_d}
            onChangeText={(v) =>
              setQuestions((prev) =>
                prev.map((item, idx) => (idx === qIndex ? { ...item, option_d: v } : item))
              )
            }
            placeholder="Option D"
            placeholderTextColor={APP_THEME.muted}
          />

          <Text style={styles.label}>Correct Option</Text>
          <View style={styles.row}>
            {[0, 1, 2, 3].map((idx) => (
              <Choice
                key={idx}
                label={["A", "B", "C", "D"][idx]}
                active={q.correct_index === idx}
                onPress={() =>
                  setQuestions((prev) =>
                    prev.map((item, i) => (i === qIndex ? { ...item, correct_index: idx } : item))
                  )
                }
              />
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setQuestions((prev) => [...prev, { ...emptyQuestion }])}
      >
        <Text style={styles.addText}>+ Add Question</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} disabled={saving} onPress={submit}>
        <Text style={styles.btnText}>{saving ? "Saving..." : "Create Mock Test"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, paddingHorizontal: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800" },
  meta: { color: APP_THEME.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  label: { color: APP_THEME.muted, fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: APP_THEME.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  choice: { backgroundColor: APP_THEME.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceActive: { backgroundColor: `${APP_THEME.primary}33` },
  choiceText: { color: APP_THEME.muted, fontWeight: "700", fontSize: 12 },
  choiceTextActive: { color: APP_THEME.primary },
  helpText: { color: APP_THEME.muted, fontSize: 11, marginTop: -2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: APP_THEME.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: `${APP_THEME.primary}33` },
  chipText: { color: APP_THEME.text, fontSize: 12, fontWeight: "700" },
  card: { backgroundColor: APP_THEME.card, borderRadius: 12, padding: 10, marginTop: 10 },
  cardTitle: { color: APP_THEME.text, fontSize: 14, fontWeight: "800", marginBottom: 6 },
  addBtn: {
    marginTop: 10,
    backgroundColor: `${APP_THEME.primary}22`,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  addText: { color: APP_THEME.primary, fontWeight: "800", fontSize: 13 },
  removeBtn: {
    backgroundColor: `${APP_THEME.danger}22`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeText: { color: APP_THEME.danger, fontSize: 11, fontWeight: "700" },
  btn: {
    marginTop: 14,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
