import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherChapterUploads } from "../../../../../../src/hooks/useTeacherClasses";
import { lectureService } from "../../../../../../src/services/lectureService";
import { APP_THEME } from "../../../../../../src/utils/constants";

const getYoutubeThumb = (url) => {
  const value = String(url ?? "");
  const watch = value.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1];
  const short = value.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)?.[1];
  const embed = value.match(/embed\/([a-zA-Z0-9_-]{6,})/)?.[1];
  const videoId = watch || short || embed;
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
};

export default function ChapterLecturesScreen() {
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

  const { lectures, loading, refresh } = useTeacherChapterUploads({
    classId: resolvedClassId,
    subjectId: resolvedSubjectId,
    chapterId: resolvedChapterId,
    limit: 500,
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveEdit = async () => {
    if (!editing?.id || !editing?.title?.trim() || !editing?.video_url?.trim()) return;
    setSaving(true);
    try {
      await lectureService.updateLecture({
        id: editing.id,
        title: editing.title,
        video_url: editing.video_url,
        is_free: editing?.is_free,
      });
      setEditing(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (item) => {
    Alert.alert("Delete Lecture", `Delete "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await lectureService.deleteLecture(item.id);
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
      <Text style={styles.title}>All Lectures</Text>
      <Text style={styles.subtitle}>{title}</Text>

      {lectures.map((item) => {
        const thumb = getYoutubeThumb(item.video_url);
        const isFree = Boolean(item.is_free);
        return (
          <View key={item.id} style={styles.row}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: "/(teacher)/classes/player",
                  params: { lectureId: item.id, teacherMode: "1" },
                })
              }
            >
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <View style={[styles.badge, isFree ? styles.badgeFree : styles.badgePaid]}>
                    <Text style={styles.badgeText}>{isFree ? "FREE" : "PAID"}</Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.linkText}>
                  {item.video_url}
                </Text>
              </View>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={styles.thumbFallback}>
                  <Ionicons name="logo-youtube" size={20} color="#ff0000" />
                </View>
              )}
            </TouchableOpacity>
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

      {!lectures.length && <Text style={styles.emptyText}>No lectures found.</Text>}

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Edit Lecture</Text>
            <TextInput
              style={styles.input}
              value={editing?.title ?? ""}
              onChangeText={(v) => setEditing((prev) => ({ ...(prev ?? {}), title: v }))}
              placeholder="Title"
              placeholderTextColor={APP_THEME.muted}
            />
            <TextInput
              style={styles.input}
              value={editing?.video_url ?? ""}
              onChangeText={(v) => setEditing((prev) => ({ ...(prev ?? {}), video_url: v }))}
              placeholder="Video URL"
              placeholderTextColor={APP_THEME.muted}
            />
            <View style={styles.choiceRow}>
              <TouchableOpacity
                style={[styles.choice, editing?.is_free && styles.choiceActive]}
                onPress={() => setEditing((prev) => ({ ...(prev ?? {}), is_free: true }))}
              >
                <Text style={styles.choiceText}>Free</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choice, !editing?.is_free && styles.choiceActive]}
                onPress={() => setEditing((prev) => ({ ...(prev ?? {}), is_free: false }))}
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
    gap: 8,
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
  thumb: { width: 92, height: 58, borderRadius: 8, backgroundColor: APP_THEME.bg },
  thumbFallback: {
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
