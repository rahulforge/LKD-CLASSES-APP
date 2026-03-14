import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LoadingView from "../../../../src/components/LoadingView";
import { classService } from "../../../../src/services/classService";
import { APP_THEME } from "../../../../src/utils/constants";

export default function ClassWorkspace() {
  const router = useRouter();
  const { classId, claassId, className } = useLocalSearchParams();
  const resolvedClassId = String(classId ?? claassId ?? "");
  const resolvedClassName = decodeURIComponent(String(className ?? "Class"));
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hierarchy = await classService.getClassHierarchy();
      const cls = hierarchy.find((item) => item.id === resolvedClassId);
      const rows = (cls?.subjects ?? [])
        .map((item) => ({
          id: item.id,
          name: item.name,
          chapterCount: item.chapters?.length ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setSubjects(rows);
    } finally {
      setLoading(false);
    }
  }, [resolvedClassId]);

  const createSubject = async () => {
    const name = newSubject.trim();
    if (!name) return;
    setSavingSubject(true);
    try {
      await classService.createSubject({ classId: resolvedClassId, name });
      setNewSubject("");
      await load();
    } finally {
      setSavingSubject(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <LoadingView text="Loading subjects..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom },
      ]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={APP_THEME.primary} />}
    >
      <Text style={styles.title}>{resolvedClassName}</Text>
      <Text style={styles.subtitle}>Select subject to manage chapters.</Text>

      <View style={styles.addRow}>
        <Text style={styles.addLabel}>Add Subject</Text>
        <View style={styles.addInputRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Subject name"
            placeholderTextColor={APP_THEME.muted}
            value={newSubject}
            onChangeText={setNewSubject}
          />
          <TouchableOpacity
            style={styles.addBtn}
            onPress={createSubject}
            disabled={savingSubject || !newSubject.trim()}
          >
            <Text style={styles.addBtnText}>{savingSubject ? "Saving..." : "Add"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {subjects.map((subject) => (
        <TouchableOpacity
          key={subject.id}
          style={styles.card}
          onPress={() =>
            router.push(
              `/(teacher)/classes/${resolvedClassId}/${subject.id}?className=${encodeURIComponent(
                resolvedClassName
              )}&subjectName=${encodeURIComponent(subject.name)}`
            )
          }
        >
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>{subject.name}</Text>
              <Text style={styles.cardMeta}>{subject.chapterCount} chapters</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={APP_THEME.muted} />
          </View>
        </TouchableOpacity>
      ))}

      {!subjects.length && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No subjects configured for this class.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
  },
  content: {
    padding: 16,
  },
  title: {
    color: APP_THEME.text,
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: APP_THEME.muted,
    marginBottom: 10,
    fontSize: 12,
  },
  addRow: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addLabel: {
    color: APP_THEME.text,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  addInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: APP_THEME.text,
  },
  addBtn: {
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: APP_THEME.text,
    fontSize: 14,
    fontWeight: "700",
  },
  cardMeta: {
    color: APP_THEME.muted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyWrap: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    padding: 12,
  },
  emptyText: {
    color: APP_THEME.muted,
    fontSize: 12,
  },
});
