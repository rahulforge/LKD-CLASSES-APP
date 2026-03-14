import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import useProfile from "../../../src/hooks/useProfile";
import { classService } from "../../../src/services/classService";

export default function SubjectChapters() {
  const { subject } = useLocalSearchParams();
  const router = useRouter();
  const { className } = useProfile();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!className || !subject) {
      setChapters([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    classService
      .getChapters(className, String(subject))
      .then((data) => {
        if (!mounted) return;
        setChapters(data);
      })
      .catch(() => {
        if (!mounted) return;
        setChapters([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [className, subject]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>
          {String(subject).toUpperCase()}
        </Text>
        <Text style={styles.sub}>Chapters</Text>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.empty}>Loading chapters...</Text>
          </View>
        ) : chapters.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color="#64748B" />
            <Text style={styles.empty}>No material chapters added yet</Text>
          </View>
        ) : (
          chapters.map((chapter) => (
            <TouchableOpacity
              key={chapter.slug}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/(student)/material/[subject]/[chapter]",
                  params: {
                    subject: String(subject),
                    chapter: chapter.slug,
                    chapterId: chapter.id,
                  },
                })
              }
            >
              <Ionicons
                name="document-text"
                size={22}
                color="#38BDF8"
              />
              <Text style={styles.cardText}>
                {chapter.name}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: { padding: 20, paddingTop: 30 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  sub: {
    color: "#9CA3AF",
    marginBottom: 20,
  },
  empty: {
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  cardText: {
    color: "#E5E7EB",
    fontSize: 15,
    marginLeft: 12,
    fontWeight: "600",
  },
  emptyCard: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
