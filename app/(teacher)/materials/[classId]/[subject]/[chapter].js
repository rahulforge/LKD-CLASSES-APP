import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ChapterMaterial() {
  const { chapter } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(16, insets.top), paddingBottom: 78 + insets.bottom }]}>
      <Text style={styles.title}>{chapter}</Text>

      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No material uploaded yet
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.fab, { bottom: 72 + insets.bottom }]}
        onPress={() => alert("Upload PDF")}
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
  empty: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  emptyText: { color: "#94A3B8" },

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
