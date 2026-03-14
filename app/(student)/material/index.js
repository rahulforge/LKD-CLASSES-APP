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
import { useEffect, useState } from "react";
import { classService } from "../../../src/services/classService";
import useProfile from "../../../src/hooks/useProfile";

export default function MaterialHome() {
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
          <Text style={styles.emptyText}>Loading subjects...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <Ionicons name="folder-open-outline" size={28} color="#64748B" />
        <Text style={styles.emptyText}>No material subjects configured</Text>
      </View>
    );
  };

  const renderItem = ({ item: subject }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(student)/material/${subject.slug}`)}
    >
      <Ionicons name="folder" size={22} color="#38BDF8" />
      <Text style={styles.cardText}>{subject.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Study Material</Text>
        <Text style={styles.sub}>Notes and PDFs</Text>
        <FlatList
          data={subjects}
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
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  sub: {
    color: "#9CA3AF",
    marginBottom: 20,
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
  emptyText: {
    color: "#94A3B8",
    fontSize: 13,
    textAlign: "center",
  },
});
