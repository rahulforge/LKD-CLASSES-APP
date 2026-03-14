import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { classService } from "../../../src/services/classService";
import useProfile from "../../../src/hooks/useProfile";

export default function ClassesIndex() {
  const router = useRouter();
  const { className } = useProfile();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!className) {
      setSubjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    classService
      .getSubjects(className)
      .then((data) => {
        if (!mounted) return;
        setSubjects(data);
      })
      .catch(() => {
        if (!mounted) return;
        setSubjects([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [className]);

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.muted}>Loading classes...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="school-outline" size={28} color="#64748B" />
        <Text style={styles.muted}>No classes configured yet</Text>
      </View>
    );
  };

  const renderItem = ({ item: s }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(student)/classes/${s.slug}`)}
    >
      <View style={styles.row}>
        <Ionicons name="book" size={22} color="#38BDF8" />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={styles.count}>{s.chapter_count || 0} chapters</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#64748B" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Classes</Text>
        <Text style={styles.sub}>Recorded classes by subject</Text>
        <FlatList
          data={subjects}
          renderItem={renderItem}
          keyExtractor={(item) => item.slug}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          windowSize={7}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={32}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: { padding: 20, paddingTop: 30 },
  title: { fontSize: 26, fontWeight: "800", color: "#E5E7EB" },
  sub: { color: "#9CA3AF", marginBottom: 20 },
  muted: { color: "#94A3B8", marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  row: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: "#E5E7EB" },
  count: { fontSize: 12, color: "#94A3B8" },
  emptyCard: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
