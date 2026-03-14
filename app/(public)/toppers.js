import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from "react-native";
import React, { useEffect, useState } from "react";
import { Image } from "expo-image";
import { topperService } from "../../src/services/topperService";

export default function Toppers() {
  const [top3, setTop3] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const data = await topperService.getTop3();
      if (!mounted) return;
      setTop3(data || []);
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </SafeAreaView>
    );
  }

  const first = top3.find((t) => t.rank === 1);
  const second = top3.find((t) => t.rank === 2);
  const third = top3.find((t) => t.rank === 3);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Our Top 3</Text>
        <Text style={styles.subtitle}>Updated from teacher panel</Text>

        {first && (
          <View style={styles.firstCard}>
            <Image source={{ uri: first.image_url }} style={styles.firstImg} contentFit="cover" cachePolicy="memory-disk" />
            <Text style={styles.rank}>Top 1</Text>
            <Text style={styles.name}>{first.name}</Text>
            <Text style={styles.detail}>
              {first.class} | {first.obtained_marks && first.total_marks ? `${first.obtained_marks}/${first.total_marks}` : first.marks}
            </Text>
          </View>
        )}

        <View style={styles.row}>
          {second && <MiniTopper title="Top 2" data={second} />}
          {third && <MiniTopper title="Top 3" data={third} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniTopper({ title, data }) {
  return (
    <View style={styles.miniCard}>
      <Image source={{ uri: data.image_url }} style={styles.miniImg} contentFit="cover" cachePolicy="memory-disk" />
      <Text style={styles.rank}>{title}</Text>
      <Text style={styles.name}>{data.name}</Text>
      <Text style={styles.detail}>
        {data.class} | {data.obtained_marks && data.total_marks ? `${data.obtained_marks}/${data.total_marks}` : data.marks}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220", paddingTop: 20 },
  container: { padding: 20 },
  title: { fontSize: 26, fontWeight: "800", color: "#38BDF8" },
  subtitle: { fontSize: 13, color: "#9CA3AF", marginBottom: 24 },
  firstCard: { backgroundColor: "#111827", borderRadius: 22, padding: 20, alignItems: "center", marginBottom: 22 },
  firstImg: { width: 96, height: 96, borderRadius: 48, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 26 },
  miniCard: { width: "48%", backgroundColor: "#111827", borderRadius: 18, padding: 14, alignItems: "center" },
  miniImg: { width: 64, height: 64, borderRadius: 32, marginBottom: 6 },
  rank: { fontSize: 14, color: "#FACC15", marginBottom: 2 },
  name: { fontSize: 15, fontWeight: "600", color: "#E5E7EB" },
  detail: { fontSize: 12, color: "#9CA3AF" },
});
