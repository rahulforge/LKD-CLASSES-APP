import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { studentService } from "../../../../src/services/studentService";
import { APP_THEME } from "../../../../src/utils/constants";

const formatRoll = (roll) => {
  const raw = String(roll ?? "");
  const digits = raw.match(/\d+/g)?.join("") ?? "";
  return digits || raw || "-";
};

export default function ClassFeesStudents() {
  const { classId, className } = useLocalSearchParams();
  const resolvedClassId = String(classId ?? "");
  const resolvedClassName = decodeURIComponent(String(className ?? "Class"));
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await studentService.getStudents({
          class_id: resolvedClassId,
          filter: "all",
          page: 1,
          pageSize: 200,
        });
        if (!mounted) return;
        setRows(result.rows);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (resolvedClassId) void load();
    return () => {
      mounted = false;
    };
  }, [resolvedClassId]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.heading}>{resolvedClassName} - Students</Text>
      <Text style={styles.meta}>Open student to add monthly payment entries.</Text>

      {loading && <ActivityIndicator color={APP_THEME.primary} style={{ marginTop: 20 }} />}

      {!loading &&
        rows.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() =>
              router.push(
                `/(teacher)/fees/${resolvedClassId}/${item.id}?className=${encodeURIComponent(
                  resolvedClassName
                )}&roll=${encodeURIComponent(item.roll_number || "")}&name=${encodeURIComponent(item.name)}`
              )
            }
          >
            <Text style={styles.roll}>{formatRoll(item.roll_number)}</Text>
            <Text style={styles.name}>{item.name}</Text>
          </TouchableOpacity>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, paddingHorizontal: 16 },
  heading: { color: APP_THEME.text, fontSize: 19, fontWeight: "800" },
  meta: { color: APP_THEME.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  roll: { width: 72, color: APP_THEME.primary, fontWeight: "800", fontSize: 12 },
  name: { color: APP_THEME.text, fontWeight: "700", fontSize: 14, flex: 1 },
});
