import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lectureService } from "../../src/services/lectureService";
import {
  useTeacherChapters,
  useTeacherClasses,
  useTeacherSubjects,
} from "../../src/hooks/useTeacherClasses";
import { APP_THEME } from "../../src/utils/constants";
import { toastService } from "../../src/services/toastService";
import { pushNotificationService } from "../../src/services/pushNotificationService";

export default function UploadLectureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [classId, setClassId] = useState(String(params.classId ?? ""));
  const [subjectId, setSubjectId] = useState(String(params.subjectId ?? ""));
  const [chapterId, setChapterId] = useState(String(params.chapterId ?? ""));

  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [loading, setLoading] = useState(false);
  const { classes } = useTeacherClasses();
  const { subjects } = useTeacherSubjects(classId);
  const { chapters } = useTeacherChapters(subjectId);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setTitle("");
        setYoutubeUrl("");
        setIsFree(false);
      };
    }, [])
  );

  const onSubmit = async () => {
    if (!title.trim() || !youtubeUrl.trim() || !classId || !subjectId || !chapterId) {
      toastService.error("Missing fields", "Title, link and hierarchy are required.");
      return;
    }

    setLoading(true);
    try {
      const parsed = lectureService.parseYouTubeInput(youtubeUrl);

      if (parsed.kind === "unknown") {
        toastService.error("Invalid link", "Please provide valid YouTube video or playlist URL.");
        setLoading(false);
        return;
      }

      await lectureService.createLecture({
        title: title.trim(),
        class_id: classId,
        subject_id: subjectId,
        chapter_id: chapterId,
        video_url: parsed.normalizedUrl,
        video_type: parsed.kind,
        playlist_id: parsed.playlistId ?? null,
        is_free: isFree,
      });
      try {
        await pushNotificationService.sendToStudents({
          title: "New Lecture Uploaded",
          body: `${title.trim()} is now available.`,
          audience: { scope: "class", classId },
          data: {
            type: "lecture",
            classId,
            subjectId,
            chapterId,
          },
        });
      } catch {
        // Lecture upload should not fail on notification error.
      }

      toastService.success("Success", "Lecture uploaded.");
      router.back();
    } catch (error: any) {
      toastService.error("Upload failed", error?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 110 + insets.bottom,
      }}
    >
      <Text style={styles.heading}>Upload Lecture</Text>
      <Text style={styles.meta}>Supports YouTube video and playlist links.</Text>

      <Text style={styles.label}>Class</Text>
      <View style={styles.chips}>
        {classes.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.chip, classId === item.id && styles.chipActive]}
            onPress={() => {
              setClassId(item.id);
              setSubjectId("");
              setChapterId("");
            }}
          >
            <Text style={styles.chipText}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Subject</Text>
      <View style={styles.chips}>
        {subjects.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.chip, subjectId === item.id && styles.chipActive]}
            onPress={() => {
              setSubjectId(item.id);
              setChapterId("");
            }}
          >
            <Text style={styles.chipText}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Chapter</Text>
      <View style={styles.chips}>
        {chapters.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.chip, chapterId === item.id && styles.chipActive]}
            onPress={() => setChapterId(item.id)}
          >
            <Text style={styles.chipText}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholderTextColor={APP_THEME.muted}
      />

      <Text style={styles.label}>YouTube URL</Text>
      <TextInput
        style={styles.input}
        value={youtubeUrl}
        onChangeText={setYoutubeUrl}
        placeholder="https://youtube.com/..."
        placeholderTextColor={APP_THEME.muted}
      />

      <Text style={styles.label}>Access</Text>
      <View style={styles.choiceRow}>
        <TouchableOpacity
          style={[styles.choice, isFree && styles.choiceActive]}
          onPress={() => setIsFree(true)}
        >
          <Text style={styles.choiceText}>Free</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.choice, !isFree && styles.choiceActive]}
          onPress={() => setIsFree(false)}
        >
          <Text style={styles.choiceText}>Paid</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? "Uploading..." : "Save Lecture"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, padding: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  meta: { color: APP_THEME.muted, marginBottom: 12 },
  label: { color: APP_THEME.muted, fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: APP_THEME.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    backgroundColor: APP_THEME.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: `${APP_THEME.primary}33`,
  },
  chipText: {
    color: APP_THEME.text,
    fontSize: 12,
    fontWeight: "700",
  },
  choiceRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  choice: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: APP_THEME.card,
    alignItems: "center",
  },
  choiceActive: {
    backgroundColor: `${APP_THEME.primary}22`,
    borderWidth: 1,
    borderColor: APP_THEME.primary,
  },
  choiceText: { color: APP_THEME.text, fontWeight: "700", fontSize: 12 },
  btn: {
    marginTop: 14,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
