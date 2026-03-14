import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherChapterUploads } from "../../../../../../src/hooks/useTeacherClasses";
import { materialService } from "../../../../../../src/services/materialService";
import { APP_THEME } from "../../../../../../src/utils/constants";

export default function ChapterMaterialsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { classId, claassId, subject, chapter, className, subjectName, chapterName } =
    useLocalSearchParams();
  const resolvedClassId = String(classId ?? claassId ?? "");
  const resolvedSubjectId = String(subject ?? "");
  const resolvedChapterId = String(chapter ?? "");
  const title = useMemo(
    () =>
      `${decodeURIComponent(String(className ?? "Class"))} / ${decodeURIComponent(
        String(subjectName ?? "Subject")
      )} / ${decodeURIComponent(String(chapterName ?? "Chapter"))}`,
    [chapterName, className, subjectName]
  );

  const { materials, loading, refresh } = useTeacherChapterUploads({
    classId: resolvedClassId,
    subjectId: resolvedSubjectId,
    chapterId: resolvedChapterId,
    limit: 500,
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveEdit = async () => {
    if (!editing?.id || !editing?.title?.trim() || !editing?.file_url?.trim()) return;
    setSaving(true);
    try {
      await materialService.updateMaterial({
        id: editing.id,
        title: editing.title,
        file_url: editing.file_url,
        is_preview: editing?.is_preview,
      });
      setEditing(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (item) => {
    Alert.alert("Delete Material", `Delete "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await materialService.deleteMaterial(item.id);
          await refresh();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom },
      ]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={APP_THEME.primary} />}
    >
      <Text style={styles.title}>All Materials</Text>
      <Text style={styles.subtitle}>{title}</Text>

      {materials.map((item) => {
        const isFree = Boolean(item.is_preview);
        return (
        <View key={item.id} style={styles.row}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.85}
            onPress={() =>
              router.push(
                `/(teacher)/viewer?mode=pdf&url=${encodeURIComponent(
                  String(item.file_url ?? "")
                )}`
              )
            }
          >
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <View style={[styles.badge, isFree ? styles.badgeFree : styles.badgePaid]}>
                <Text style={styles.badgeText}>{isFree ? "FREE" : "PAID"}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={styles.linkText}>
              {item.file_url}
            </Text>
          </TouchableOpacity>
          <View style={styles.iconWrap}>
            <Ionicons name="document-text" size={18} color={APP_THEME.primary} />
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setEditing({ ...item })}>
              <Ionicons name="create-outline" size={16} color={APP_THEME.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete(item)}>
              <Ionicons name="trash-outline" size={16} color={APP_THEME.danger} />
            </TouchableOpacity>
          </View>
        </View>
      );
      })}

      {!materials.length && <Text style={styles.emptyText}>No materials found.</Text>}

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Edit Material</Text>
            <TextInput
              style={styles.input}
              value={editing?.title ?? ""}
              onChangeText={(v) => setEditing((prev) => ({ ...(prev ?? {}), title: v }))}
              placeholder="Title"
              placeholderTextColor={APP_THEME.muted}
            />
            <TextInput
              style={styles.input}
              value={editing?.file_url ?? ""}
              onChangeText={(v) => setEditing((prev) => ({ ...(prev ?? {}), file_url: v }))}
              placeholder="File URL"
              placeholderTextColor={APP_THEME.muted}
            />
            <View style={styles.choiceRow}>
              <TouchableOpacity
                style={[styles.choice, editing?.is_preview && styles.choiceActive]}
                onPress={() => setEditing((prev) => ({ ...(prev ?? {}), is_preview: true }))}
              >
                <Text style={styles.choiceText}>Free</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choice, !editing?.is_preview && styles.choiceActive]}
                onPress={() => setEditing((prev) => ({ ...(prev ?? {}), is_preview: false }))}
              >
                <Text style={styles.choiceText}>Paid</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.saveBtn} disabled={saving} onPress={saveEdit}>
              <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg },
  content: { padding: 16 },
  title: { color: APP_THEME.text, fontSize: 19, fontWeight: "800" },
  subtitle: { color: APP_THEME.muted, fontSize: 12, marginBottom: 10, marginTop: 2 },
  row: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionCol: { gap: 6 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: APP_THEME.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { color: APP_THEME.text, fontWeight: "700", fontSize: 13 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeFree: { backgroundColor: "#22C55E" },
  badgePaid: { backgroundColor: "#F59E0B" },
  badgeText: { color: "#0B1220", fontSize: 10, fontWeight: "800" },
  linkText: { color: APP_THEME.muted, marginTop: 2, fontSize: 11 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: APP_THEME.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: APP_THEME.muted, fontSize: 12 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,6,23,0.6)" },
  sheet: { backgroundColor: APP_THEME.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14 },
  sheetTitle: { color: APP_THEME.text, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  input: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
    marginBottom: 8,
  },
  choiceRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  choice: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: APP_THEME.bg,
    alignItems: "center",
  },
  choiceActive: {
    backgroundColor: `${APP_THEME.primary}22`,
    borderWidth: 1,
    borderColor: APP_THEME.primary,
  },
  choiceText: { color: APP_THEME.text, fontWeight: "700", fontSize: 12 },
  saveBtn: {
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  saveText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
