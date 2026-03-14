import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useAuth from "../../src/hooks/useAuth";
import { useTeacherClasses } from "../../src/hooks/useTeacherClasses";
import { taskService } from "../../src/services/taskService";
import { toastService } from "../../src/services/toastService";
import { APP_THEME } from "../../src/utils/constants";

export default function AddTaskScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { classes } = useTeacherClasses();

  const [text, setText] = useState("");
  const [classId, setClassId] = useState("");
  const [programType, setProgramType] = useState<"all" | "school" | "competitive">("all");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<
    { id: string; text: string; due_date: string | null; created_at: string | null }[]
  >([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const rows = await taskService.listTasksByTeacher(user?.id);
      setTasks(rows);
    } finally {
      setLoadingTasks(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const submit = async () => {
    if (!user?.id) {
      toastService.error("Wait", "Teacher session is loading. Please try again.");
      return;
    }
    if (!text.trim()) {
      toastService.error("Missing", "Plan text required");
      return;
    }

    setSaving(true);
    try {
      const count = await taskService.createStudentTask({
        text: text.trim(),
        classId: classId || null,
        programType,
        dueDate: dueDate.trim() || null,
        teacherId: user.id,
      });
      toastService.success("Saved", `Plan assigned to ${count} students.`);
      setText("");
      setClassId("");
      setDueDate("");
      setProgramType("all");
      await loadTasks();
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to save plan");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: { id: string; text: string; due_date: string | null }) => {
    setEditingId(item.id);
    setEditingText(item.text);
    setEditingDueDate(item.due_date ?? "");
  };

  const saveEdit = async () => {
    if (!editingId || !editingText.trim()) return;
    setSaving(true);
    try {
      await taskService.updateTask({
        id: editingId,
        text: editingText.trim(),
        dueDate: editingDueDate.trim() || null,
        teacherId: user?.id,
      });
      setEditingId(null);
      setEditingText("");
      setEditingDueDate("");
      await loadTasks();
      toastService.success("Updated", "Task updated.");
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to update task");
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = (id: string) => {
    Alert.alert("Delete Task", "Delete this task from all assigned students?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await taskService.deleteTask({ id, teacherId: user?.id });
            await loadTasks();
          } catch (error: any) {
            toastService.error("Failed", error?.message ?? "Unable to delete task");
          }
        },
      },
    ]);
  };

  const clearAll = () => {
    Alert.alert("Delete All", "Delete all tasks created by you?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All",
        style: "destructive",
        onPress: async () => {
          try {
            await taskService.clearAllTasksByTeacher(user?.id);
            await loadTasks();
            toastService.success("Cleared", "All tasks removed.");
          } catch (error: any) {
            toastService.error("Failed", error?.message ?? "Unable to clear tasks");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 110 + insets.bottom,
      }}
    >
      <Text style={styles.heading}>Add Tomorrow Plan</Text>
      <Text style={styles.meta}>Assign a task shown in student dashboard tomorrow section.</Text>

      <Text style={styles.label}>Plan Text</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={text}
        onChangeText={setText}
        placeholder="Example: Revise chapter 4 and solve 20 MCQs."
        placeholderTextColor={APP_THEME.muted}
        multiline
      />

      <Text style={styles.label}>Program</Text>
      <View style={styles.row}>
        <Choice label="All" active={programType === "all"} onPress={() => setProgramType("all")} />
        <Choice label="School" active={programType === "school"} onPress={() => setProgramType("school")} />
        <Choice
          label="Competitive"
          active={programType === "competitive"}
          onPress={() => setProgramType("competitive")}
        />
      </View>

      <Text style={styles.label}>Class (optional)</Text>
      <View style={styles.chips}>
        {classes.map((cls) => (
          <TouchableOpacity
            key={cls.id}
            style={[styles.chip, classId === cls.id && styles.chipActive]}
            onPress={() => setClassId(classId === cls.id ? "" : cls.id)}
          >
            <Text style={styles.chipText}>{cls.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Due Date (optional)</Text>
      <TextInput
        style={styles.input}
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={APP_THEME.muted}
      />

      <TouchableOpacity style={styles.btn} disabled={saving} onPress={submit}>
        <Text style={styles.btnText}>{saving ? "Saving..." : "Save Plan"}</Text>
      </TouchableOpacity>

      <View style={styles.historyHead}>
        <Text style={styles.historyTitle}>Manage Tasks</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
          <Text style={styles.clearText}>Delete All</Text>
        </TouchableOpacity>
      </View>

      {loadingTasks ? (
        <Text style={styles.meta}>Loading tasks...</Text>
      ) : tasks.length === 0 ? (
        <Text style={styles.meta}>No tasks created yet.</Text>
      ) : (
        tasks.map((item) => (
          <View key={item.id} style={styles.taskCard}>
            {editingId === item.id ? (
              <>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editingText}
                  onChangeText={setEditingText}
                  placeholderTextColor={APP_THEME.muted}
                  multiline
                />
                <TextInput
                  style={styles.input}
                  value={editingDueDate}
                  onChangeText={setEditingDueDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={APP_THEME.muted}
                />
                <View style={styles.row}>
                  <TouchableOpacity style={styles.smallBtn} onPress={saveEdit}>
                    <Text style={styles.smallBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, styles.grayBtn]}
                    onPress={() => {
                      setEditingId(null);
                      setEditingText("");
                      setEditingDueDate("");
                    }}
                  >
                    <Text style={[styles.smallBtnText, styles.grayBtnText]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.taskText}>{item.text}</Text>
                <Text style={styles.taskMeta}>
                  Due: {item.due_date || "-"} | Created:{" "}
                  {item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "-"}
                </Text>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => startEdit(item)}>
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, styles.deleteBtn]}
                    onPress={() => deleteTask(item.id)}
                  >
                    <Text style={[styles.smallBtnText, styles.deleteBtnText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ))
      )}
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
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  choice: { backgroundColor: APP_THEME.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceActive: { backgroundColor: `${APP_THEME.primary}33` },
  choiceText: { color: APP_THEME.muted, fontWeight: "700", fontSize: 12 },
  choiceTextActive: { color: APP_THEME.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: APP_THEME.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: `${APP_THEME.primary}33` },
  chipText: { color: APP_THEME.text, fontSize: 12, fontWeight: "700" },
  btn: {
    marginTop: 14,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
  historyHead: {
    marginTop: 18,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyTitle: { color: APP_THEME.text, fontSize: 16, fontWeight: "800" },
  clearBtn: {
    backgroundColor: `${APP_THEME.danger}22`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: { color: APP_THEME.danger, fontWeight: "700", fontSize: 12 },
  taskCard: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  taskText: { color: APP_THEME.text, fontWeight: "700", fontSize: 13 },
  taskMeta: { color: APP_THEME.muted, fontSize: 11, marginTop: 4, marginBottom: 8 },
  smallBtn: {
    backgroundColor: `${APP_THEME.primary}22`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallBtnText: { color: APP_THEME.primary, fontWeight: "800", fontSize: 12 },
  grayBtn: { backgroundColor: `${APP_THEME.muted}22` },
  grayBtnText: { color: APP_THEME.muted },
  deleteBtn: { backgroundColor: `${APP_THEME.danger}22` },
  deleteBtnText: { color: APP_THEME.danger },
});
