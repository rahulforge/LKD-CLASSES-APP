import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherChapterUploads } from "../../../../../src/hooks/useTeacherClasses";
import { APP_THEME } from "../../../../../src/utils/constants";

const getYoutubeThumb = (url) => {
  const value = String(url ?? "");
  const watch = value.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1];
  const short = value.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)?.[1];
  const embed = value.match(/embed\/([a-zA-Z0-9_-]{6,})/)?.[1];
  const videoId = watch || short || embed;
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
};

export default function ChapterClasses() {
  const {
    classId,
    claassId,
    subject,
    chapter,
    className,
    subjectName,
    chapterName,
  } = useLocalSearchParams();

  const resolvedClassId = String(classId ?? claassId ?? "");
  const resolvedSubjectId = String(subject ?? "");
  const resolvedChapterId = String(chapter ?? "");

  const resolvedClassName = decodeURIComponent(String(className ?? "Class"));
  const resolvedSubjectName = decodeURIComponent(String(subjectName ?? "Subject"));
  const resolvedChapterName = decodeURIComponent(String(chapterName ?? "Chapter"));

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { lectures, materials, loading, refresh } =
    useTeacherChapterUploads({
      classId: resolvedClassId,
      subjectId: resolvedSubjectId,
      chapterId: resolvedChapterId,
      limit: 5,
    });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom },
      ]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={APP_THEME.primary} />}
    >
      <Text style={styles.title}>{resolvedClassName}</Text>
      <Text style={styles.subtitle}>
        {resolvedSubjectName} / {resolvedChapterName}
      </Text>

      <TouchableOpacity
        style={styles.liveBtn}
        onPress={() =>
          router.push(
            `/(teacher)/go-live?classId=${resolvedClassId}&className=${encodeURIComponent(
              resolvedClassName
            )}&subjectId=${resolvedSubjectId}&chapterId=${resolvedChapterId}&title=${encodeURIComponent(
              `${resolvedSubjectName} - ${resolvedChapterName}`
            )}`
          )
        }
      >
        <Ionicons name="radio" size={18} color={APP_THEME.success} />
        <Text style={styles.liveText}>Go Live & Notify Students</Text>
      </TouchableOpacity>

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            router.push(
              `/(teacher)/upload-lecture?classId=${resolvedClassId}&subjectId=${resolvedSubjectId}&chapterId=${resolvedChapterId}&className=${encodeURIComponent(
                resolvedClassName
              )}&subjectName=${encodeURIComponent(resolvedSubjectName)}&chapterName=${encodeURIComponent(
                resolvedChapterName
              )}`
            )
          }
        >
          <Ionicons name="play-circle" size={24} color={APP_THEME.primary} />
          <Text style={styles.cardTitle}>Upload Lecture</Text>
          <Text style={styles.cardMeta}>Quick upload</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            router.push(
              `/(teacher)/upload-material?classId=${resolvedClassId}&subjectId=${resolvedSubjectId}&chapterId=${resolvedChapterId}&className=${encodeURIComponent(
                resolvedClassName
              )}&subjectName=${encodeURIComponent(resolvedSubjectName)}&chapterName=${encodeURIComponent(
                resolvedChapterName
              )}`
            )
          }
        >
          <Ionicons name="document-text" size={24} color={APP_THEME.primary} />
          <Text style={styles.cardTitle}>Upload Material</Text>
          <Text style={styles.cardMeta}>Quick upload</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.card, styles.outlineCard]}
          onPress={() =>
            router.push(
              `/(teacher)/classes/${resolvedClassId}/${resolvedSubjectId}/${resolvedChapterId}/lectures?className=${encodeURIComponent(
                resolvedClassName
              )}&subjectName=${encodeURIComponent(resolvedSubjectName)}&chapterName=${encodeURIComponent(
                resolvedChapterName
              )}`
            )
          }
        >
          <Text style={styles.outlineTitle}>View All Lectures</Text>
          <Text style={styles.outlineMeta}>Total: {lectures.length}+ </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.card, styles.outlineCard]}
          onPress={() =>
            router.push(
              `/(teacher)/classes/${resolvedClassId}/${resolvedSubjectId}/${resolvedChapterId}/materials?className=${encodeURIComponent(
                resolvedClassName
              )}&subjectName=${encodeURIComponent(resolvedSubjectName)}&chapterName=${encodeURIComponent(
                resolvedChapterName
              )}`
            )
          }
        >
          <Text style={styles.outlineTitle}>View All Materials</Text>
          <Text style={styles.outlineMeta}>Total: {materials.length}+ </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent 5 Lectures</Text>
        {lectures.length === 0 ? (
          <Text style={styles.emptyText}>No lecture uploaded for this chapter.</Text>
        ) : (
          lectures.map((item) => {
            const thumb = getYoutubeThumb(item.video_url);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.itemRow}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/(teacher)/classes/player",
                    params: { lectureId: item.id, teacherMode: "1" },
                  })
                }
              >
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text numberOfLines={1} style={styles.itemLink}>
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
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent 5 Materials</Text>
        {materials.length === 0 ? (
          <Text style={styles.emptyText}>No material uploaded for this chapter.</Text>
        ) : (
          materials.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemRow}
              activeOpacity={0.85}
              onPress={() =>
                router.push(
                  `/(teacher)/viewer?mode=pdf&url=${encodeURIComponent(
                    String(item.file_url ?? "")
                  )}`
                )
              }
            >
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text numberOfLines={1} style={styles.itemLink}>
                  {item.file_url}
                </Text>
              </View>
              <View style={styles.thumbFallback}>
                <Ionicons name="document-text" size={18} color={APP_THEME.primary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg },
  content: { padding: 16 },
  title: { color: APP_THEME.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: APP_THEME.muted, fontSize: 13, marginBottom: 12, marginTop: 2 },
  grid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  liveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${APP_THEME.success}22`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  liveText: { color: APP_THEME.success, fontWeight: "700", fontSize: 12 },
  card: { flex: 1, backgroundColor: APP_THEME.card, borderRadius: 14, padding: 12 },
  cardTitle: { color: APP_THEME.text, marginTop: 8, fontWeight: "700", fontSize: 13 },
  cardMeta: { color: APP_THEME.muted, fontSize: 11, marginTop: 3 },
  outlineCard: { borderWidth: 1, borderColor: APP_THEME.border },
  outlineTitle: { color: APP_THEME.text, fontWeight: "700", fontSize: 13 },
  outlineMeta: { color: APP_THEME.muted, fontSize: 11, marginTop: 3 },
  section: { backgroundColor: APP_THEME.card, borderRadius: 14, padding: 12, marginBottom: 10 },
  sectionTitle: { color: APP_THEME.text, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: APP_THEME.muted, fontSize: 12 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APP_THEME.border,
  },
  itemBody: { flex: 1 },
  itemTitle: { color: APP_THEME.text, fontSize: 13, fontWeight: "600" },
  itemLink: { color: APP_THEME.muted, marginTop: 2, fontSize: 11 },
  thumb: { width: 92, height: 58, borderRadius: 8, backgroundColor: APP_THEME.bg },
  thumbFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: APP_THEME.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
