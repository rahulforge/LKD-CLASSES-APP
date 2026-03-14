import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DUMMY_CHAPTERS = ["Chapter 1", "Chapter 2"];

export default function Chapters() {
  const { classId, subject } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(16, insets.top), paddingBottom: 78 + insets.bottom }]}>
      <Text style={styles.title}>
        {subject} – Chapters
      </Text>

      {DUMMY_CHAPTERS.map((ch) => (
        <TouchableOpacity
          key={ch}
          style={styles.card}
          onPress={() =>
            router.push(
              `/(teacher)/materials/${classId}/${subject}/${ch}`
            )
          }
        >
          <Text style={styles.cardText}>{ch}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.fab, { bottom: 72 + insets.bottom }]}
        onPress={() => alert("Add Chapter")}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardText: { color: "#E5E7EB", fontSize: 14 },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#38BDF8",
    justifyContent: "center",
    alignItems: "center",
  },
});
