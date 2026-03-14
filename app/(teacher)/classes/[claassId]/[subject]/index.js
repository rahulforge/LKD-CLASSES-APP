import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherChapters } from "../../../../../src/hooks/useTeacherClasses";
import { classService } from "../../../../../src/services/classService";
import { APP_THEME } from "../../../../../src/utils/constants";

export default function SubjectChaptersScreen() {
  const {
    classId,
    claassId,
    subject,
    className,
    subjectName,
  } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const resolvedClassId = String(classId ?? claassId ?? "");
  const resolvedSubjectId = String(subject ?? "");
  const resolvedClassName = decodeURIComponent(String(className ?? "Class"));
  const resolvedSubjectName = decodeURIComponent(String(subjectName ?? "Subject"));

  const { chapters, loading, refresh } = useTeacherChapters(resolvedSubjectId);
  const [summary, setSummary] = useState({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!resolvedClassId || !resolvedSubjectId) return;
    const data = await classService.getSubjectChapterContentSummary({
      classId: resolvedClassId,
      subjectId: resolvedSubjectId,
    });
    setSummary(data);
  }, [resolvedClassId, resolvedSubjectId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, chapters.length]);

  const onRefresh = async () => {
    await refresh();
    await loadSummary();
  };

  const openCreate = () => {
    setEditingChapterId("");
    setChapterName("");
    setEditorOpen(true);
  };

  const openEdit = (chapter) => {
    setEditingChapterId(chapter.id);
    setChapterName(chapter.name);
    setEditorOpen(true);
  };

  const submitChapter = async () => {
    if (!chapterName.trim()) return;
    setSaving(true);
    try {
      if (editingChapterId) {
        await classService.updateChapter({
          chapterId: editingChapterId,
          name: chapterName.trim(),
        });
      } else {
        await classService.createChapter({
          subjectId: resolvedSubjectId,
          name: chapterName.trim(),
        });
      }
      setEditorOpen(false);
      setChapterName("");
      await onRefresh();
    } catch (error) {
      Alert.alert("Unable to save chapter", error?.message ?? "Please try again");
    } finally {
      setSaving(false);
    }
  };

  const removeChapter = (chapterId, name) => {
    Alert.alert("Delete Chapter", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await classService.deleteChapter({ chapterId });
          await onRefresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: Math.max(10, insets.top),
          paddingBottom: 120 + insets.bottom,
          paddingHorizontal: 16,
        }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={APP_THEME.primary} />}
      >
        <Text style={styles.title}>{resolvedClassName}</Text>
        <Text style={styles.subtitle}>{resolvedSubjectName}</Text>

        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add-circle" size={16} color={APP_THEME.bg} />
          <Text style={styles.addText}>Add Chapter</Text>
        </TouchableOpacity>

        {chapters.map((ch) => (
          <View key={ch.id} style={styles.card}>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  `/(teacher)/classes/${resolvedClassId}/${resolvedSubjectId}/${ch.id}?className=${encodeURIComponent(
                    resolvedClassName
                  )}&subjectName=${encodeURIComponent(resolvedSubjectName)}&chapterName=${encodeURIComponent(
                    ch.name
                  )}`
                )
              }
            >
              <Text style={styles.cardTitle}>{ch.name}</Text>
              <Text style={styles.metaText}>
                Lectures: {summary[ch.id]?.lectures ?? 0} | Materials: {summary[ch.id]?.materials ?? 0}
              </Text>
            </TouchableOpacity>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(ch)}>
                <Ionicons name="create-outline" size={16} color={APP_THEME.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => removeChapter(ch.id, ch.name)}>
                <Ionicons name="trash-outline" size={16} color={APP_THEME.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {!chapters.length && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No chapters yet. Add first chapter.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditorOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{editingChapterId ? "Edit Chapter" : "Create Chapter"}</Text>
            <TextInput
              style={styles.input}
              value={chapterName}
              onChangeText={setChapterName}
              placeholder="Enter chapter name"
              placeholderTextColor={APP_THEME.muted}
            />
            <TouchableOpacity style={styles.saveBtn} disabled={saving} onPress={submitChapter}>
              <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
  },
  title: {
    color: APP_THEME.text,
    fontSize: 19,
    fontWeight: "800",
  },
  subtitle: {
    color: APP_THEME.muted,
    marginBottom: 10,
    fontSize: 13,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: APP_THEME.primary,
    borderRadius: 999,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  addText: {
    color: APP_THEME.bg,
    fontWeight: "800",
    fontSize: 12,
  },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: {
    color: APP_THEME.text,
    fontWeight: "700",
    fontSize: 14,
  },
  metaText: {
    color: APP_THEME.muted,
    fontSize: 11,
    marginTop: 4,
  },
  actionRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: APP_THEME.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    padding: 12,
  },
  emptyText: {
    color: APP_THEME.muted,
    fontSize: 12,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,6,23,0.6)" },
  modalCard: { backgroundColor: APP_THEME.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14 },
  modalTitle: { color: APP_THEME.text, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  input: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
  },
  saveBtn: {
    marginTop: 10,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  saveText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
