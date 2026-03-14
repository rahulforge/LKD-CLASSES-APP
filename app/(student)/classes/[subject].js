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
import { useLocalSearchParams, useRouter } from "expo-router";
import { classService } from "../../../src/services/classService";
import useProfile from "../../../src/hooks/useProfile";

export default function SubjectPage() {
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

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.muted}>Loading chapters...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="albums-outline" size={28} color="#64748B" />
        <Text style={styles.muted}>No chapters added yet</Text>
      </View>
    );
  };

  const renderItem = ({ item: chapter }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(student)/classes/${subject}/${chapter.slug}`)}
    >
      <Text style={styles.name}>{chapter.name}</Text>
      <Ionicons name="chevron-forward" size={20} color="#64748B" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Chapters</Text>
        <FlatList
          data={chapters}
          renderItem={renderItem}
          keyExtractor={(item) => item.slug}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={7}
          maxToRenderPerBatch={10}
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
  title: { fontSize: 22, fontWeight: "800", color: "#E5E7EB" },
  muted: { color: "#94A3B8", marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  name: { color: "#E5E7EB", fontWeight: "600" },
  emptyCard: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
