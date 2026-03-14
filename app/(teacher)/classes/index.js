import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherClasses } from "../../../src/hooks/useTeacherClasses";
import { APP_THEME } from "../../../src/utils/constants";

export default function ClassRoot() {
  const router = useRouter();
  const { classes, loading, refresh } = useTeacherClasses();
  const [filter, setFilter] = useState("all");
  const ordered = [...classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const competitiveClass = useMemo(
    () => ordered.find((item) => item.name.toLowerCase().includes("competitive")),
    [ordered]
  );
  const filtered = useMemo(() => {
    if (filter === "all") return ordered;
    if (filter === "competitive") {
      return ordered.filter((item) => item.name.toLowerCase().includes("competitive"));
    }
    return ordered.filter((item) => !item.name.toLowerCase().includes("competitive"));
  }, [filter, ordered]);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={APP_THEME.primary}
        />
      }
    >
      <Text style={styles.title}>Classes</Text>
      <Text style={styles.subtitle}>Select Class</Text>

      {!!competitiveClass && (
        <TouchableOpacity
          style={styles.competitiveCard}
          onPress={() =>
            router.push(
              `/(teacher)/classes/${competitiveClass.id}?className=${encodeURIComponent(competitiveClass.name)}`
            )
          }
        >
          <View>
            <Text style={styles.competitiveTitle}>Competitive Hub</Text>
            <Text style={styles.competitiveSub}>All competitive students and content</Text>
          </View>
          <Ionicons name="flash" size={18} color={APP_THEME.primary} />
        </TouchableOpacity>
      )}

      <View style={styles.filters}>
        <FilterChip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        <FilterChip
          label="School"
          active={filter === "school"}
          onPress={() => setFilter("school")}
        />
        <FilterChip
          label="Competitive"
          active={filter === "competitive"}
          onPress={() => setFilter("competitive")}
        />
      </View>

      {filtered.map((cls) => (
        <TouchableOpacity
          key={cls.id}
          style={styles.card}
          onPress={() =>
            router.push(
              `/(teacher)/classes/${cls.id}?className=${encodeURIComponent(cls.name)}`
            )
          }
        >
          <Text style={styles.cardText}>{cls.name}</Text>
        </TouchableOpacity>
      ))}

      {!filtered.length && !loading && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No class hierarchy found.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  title: {
    color: APP_THEME.text,
    fontSize: 21,
    fontWeight: "800",
  },
  subtitle: {
    color: APP_THEME.muted,
    fontSize: 13,
    marginBottom: 12,
  },
  competitiveCard: {
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: `${APP_THEME.primary}33`,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  competitiveTitle: {
    color: APP_THEME.text,
    fontSize: 14,
    fontWeight: "800",
  },
  competitiveSub: {
    color: APP_THEME.muted,
    fontSize: 12,
    marginTop: 2,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    backgroundColor: APP_THEME.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: `${APP_THEME.primary}22`,
  },
  filterText: {
    color: APP_THEME.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  filterTextActive: {
    color: APP_THEME.primary,
  },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardText: {
    color: APP_THEME.text,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyWrap: {
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    padding: 16,
  },
  emptyText: {
    color: APP_THEME.muted,
    fontSize: 13,
  },
});
