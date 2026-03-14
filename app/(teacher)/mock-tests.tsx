import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useAuth from "../../src/hooks/useAuth";
import { useTeacherClasses } from "../../src/hooks/useTeacherClasses";
import { mockTestService } from "../../src/services/mockTestService";
import { toastService } from "../../src/services/toastService";
import { APP_THEME } from "../../src/utils/constants";

type EditableTest = {
  id: string;
  title: string;
  class_id: string | null;
  program_type: "all" | "school" | "competitive";
  scheduled_for: string | null;
  duration_minutes: number;
  marks_per_question: number;
  negative_marks: number;
  is_free: boolean;
  price: number;
};

export default function TeacherMockTests() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { classes } = useTeacherClasses();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableTest | null>(null);
  const [saving, setSaving] = useState(false);

  const classLabelById = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  const loadTests = useCallback(async () => {
    if (!user?.id) {
      setTests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await mockTestService.getTestsForTeacher(user.id);
    setTests(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadTests();
  }, [loadTests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTests();
    setRefreshing(false);
  }, [loadTests]);

  const startEdit = (test: any) => {
    setEditingId(test.id);
    setDraft({
      id: test.id,
      title: test.title ?? "",
      class_id: test.class_id ?? null,
      program_type: (test.program_type ?? "all") as EditableTest["program_type"],
      scheduled_for: test.scheduled_for ?? "",
      duration_minutes: Number(test.duration_minutes ?? 60),
      marks_per_question: Number(test.marks_per_question ?? 1),
      negative_marks: Number(test.negative_marks ?? 0),
      is_free: Boolean(test.is_free),
      price: Number(test.price ?? 0),
    });
  };

  const saveEdit = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toastService.error("Missing", "Test name required.");
      return;
    }
    setSaving(true);
    try {
      await mockTestService.updateMockTest({
        id: draft.id,
        title: draft.title.trim(),
        class_id: draft.class_id,
        program_type: draft.program_type,
        scheduled_for: draft.scheduled_for || null,
        duration_minutes: Number(draft.duration_minutes || 60),
        marks_per_question: Number(draft.marks_per_question || 1),
        negative_marks: Number(draft.negative_marks || 0),
        is_free: Boolean(draft.is_free),
        price: Number(draft.price || 0),
      });
      toastService.success("Updated", "Mock test updated.");
      setEditingId(null);
      setDraft(null);
      await loadTests();
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to update");
    } finally {
      setSaving(false);
    }
  };

  const deleteTest = (test: any) => {
    Alert.alert("Delete test", "This will remove the test and its questions.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await mockTestService.deleteMockTest(test.id);
            toastService.success("Deleted", "Mock test removed.");
            await loadTests();
          } catch (error: any) {
            toastService.error("Failed", error?.message ?? "Unable to delete");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_THEME.primary} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>My Mock Tests</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push("/(teacher)/create-mock-test")}
        >
          <Ionicons name="add" size={16} color={APP_THEME.bg} />
          <Text style={styles.createText}>New</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.meta}>Edit, update, or delete your uploaded mock tests.</Text>

      {loading && !tests.length ? (
        <Text style={styles.emptyText}>Loading tests...</Text>
      ) : null}
      {!loading && tests.length === 0 ? (
        <Text style={styles.emptyText}>No mock tests yet. Create one to get started.</Text>
      ) : null}

      {tests.map((test) => {
        const isEditing = editingId === test.id;
        const displayClass =
          test.class_name ||
          classLabelById.get(String(test.class_id ?? "")) ||
          (test.class_id ? "Class" : "All");
        return (
          <View key={test.id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{test.title}</Text>
                <Text style={styles.cardSub}>
                  {displayClass} · {String(test.program_type ?? "all").toUpperCase()}
                </Text>
                <Text style={styles.cardSub}>
                  {test.duration_minutes || 60} mins · +{test.marks_per_question || 1} / -
                  {test.negative_marks || 0}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {test.is_free ? "FREE" : `Rs.${Math.max(0, Number(test.price ?? 0))}`}
                </Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => startEdit(test)}>
                <Ionicons name="create-outline" size={14} color={APP_THEME.primary} />
                <Text style={styles.outlineText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerBtn} onPress={() => deleteTest(test)}>
                <Ionicons name="trash-outline" size={14} color={APP_THEME.danger} />
                <Text style={styles.dangerText}>Delete</Text>
              </TouchableOpacity>
            </View>

            {isEditing && draft ? (
              <View style={styles.editBox}>
                <Text style={styles.label}>Test Name</Text>
                <TextInput
                  style={styles.input}
                  value={draft.title}
                  onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, title: v } : prev))}
                  placeholderTextColor={APP_THEME.muted}
                />

                <Text style={styles.label}>Program</Text>
                <View style={styles.row}>
                  {(["all", "school", "competitive"] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.choice, draft.program_type === p && styles.choiceActive]}
                      onPress={() => setDraft((prev) => (prev ? { ...prev, program_type: p } : prev))}
                    >
                      <Text
                        style={[styles.choiceText, draft.program_type === p && styles.choiceTextActive]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Class (optional)</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.choice, !draft.class_id && styles.choiceActive]}
                    onPress={() => setDraft((prev) => (prev ? { ...prev, class_id: null } : prev))}
                  >
                    <Text style={[styles.choiceText, !draft.class_id && styles.choiceTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {classes.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.choice, draft.class_id === c.id && styles.choiceActive]}
                      onPress={() => setDraft((prev) => (prev ? { ...prev, class_id: c.id } : prev))}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          draft.class_id === c.id && styles.choiceTextActive,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={String(draft.scheduled_for ?? "")}
                  onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, scheduled_for: v } : prev))}
                  placeholder="2026-03-31"
                  placeholderTextColor={APP_THEME.muted}
                />

                <Text style={styles.label}>Duration (minutes)</Text>
                <TextInput
                  style={styles.input}
                  value={String(draft.duration_minutes ?? 60)}
                  onChangeText={(v) =>
                    setDraft((prev) =>
                      prev ? { ...prev, duration_minutes: Number(v || 0) } : prev
                    )
                  }
                  keyboardType="numeric"
                  placeholder="60"
                  placeholderTextColor={APP_THEME.muted}
                />

                <Text style={styles.label}>Marks per Correct (+)</Text>
                <TextInput
                  style={styles.input}
                  value={String(draft.marks_per_question ?? 1)}
                  onChangeText={(v) =>
                    setDraft((prev) =>
                      prev ? { ...prev, marks_per_question: Number(v || 0) } : prev
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={APP_THEME.muted}
                />

                <Text style={styles.label}>Negative Marks (-)</Text>
                <TextInput
                  style={styles.input}
                  value={String(draft.negative_marks ?? 0)}
                  onChangeText={(v) =>
                    setDraft((prev) =>
                      prev ? { ...prev, negative_marks: Number(v || 0) } : prev
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={APP_THEME.muted}
                />

                <Text style={styles.label}>Availability</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.choice, !draft.is_free && styles.choiceActive]}
                    onPress={() => setDraft((prev) => (prev ? { ...prev, is_free: false } : prev))}
                  >
                    <Text style={[styles.choiceText, !draft.is_free && styles.choiceTextActive]}>
                      Paid
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choice, draft.is_free && styles.choiceActive]}
                    onPress={() => setDraft((prev) => (prev ? { ...prev, is_free: true } : prev))}
                  >
                    <Text style={[styles.choiceText, draft.is_free && styles.choiceTextActive]}>
                      Free
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Extra Price (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={String(draft.price ?? 0)}
                  onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, price: Number(v || 0) } : prev))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={APP_THEME.muted}
                />

                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingId(null)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={saving}>
                    <Text style={styles.saveText}>{saving ? "Saving..." : "Save Changes"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800" },
  meta: { color: APP_THEME.muted, fontSize: 12, marginTop: 2, marginBottom: 12 },
  createBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: APP_THEME.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 12 },
  emptyText: { color: APP_THEME.muted, fontSize: 12, marginTop: 8 },
  card: { backgroundColor: APP_THEME.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { color: APP_THEME.text, fontSize: 15, fontWeight: "800" },
  cardSub: { color: APP_THEME.muted, fontSize: 11, marginTop: 2 },
  badge: {
    backgroundColor: `${APP_THEME.primary}22`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { color: APP_THEME.primary, fontSize: 11, fontWeight: "800" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: APP_THEME.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  outlineText: { color: APP_THEME.primary, fontSize: 11, fontWeight: "700" },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: APP_THEME.danger,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dangerText: { color: APP_THEME.danger, fontSize: 11, fontWeight: "700" },
  editBox: { marginTop: 10, borderTopWidth: 1, borderTopColor: APP_THEME.border, paddingTop: 10 },
  label: { color: APP_THEME.muted, fontSize: 11, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: APP_THEME.text,
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  choice: { backgroundColor: APP_THEME.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  choiceActive: { backgroundColor: `${APP_THEME.primary}33` },
  choiceText: { color: APP_THEME.muted, fontSize: 11, fontWeight: "700" },
  choiceTextActive: { color: APP_THEME.primary },
  editActions: { flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "flex-end" },
  cancelBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: { color: APP_THEME.muted, fontSize: 12, fontWeight: "700" },
  saveBtn: {
    borderRadius: 10,
    backgroundColor: APP_THEME.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveText: { color: APP_THEME.bg, fontSize: 12, fontWeight: "800" },
});
