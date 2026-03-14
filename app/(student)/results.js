import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AppScroll from "../../src/components/AppScroll";
import LoadingView from "../../src/components/LoadingView";
import useResults, {
  resultService,
} from "../../src/services/resultService";

function formatDate(dateValue) {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Results() {
  const {
    results,
    loading,
    refreshing,
    refresh,
  } = useResults();

  if (loading && results.length === 0) {
    return <LoadingView text="Loading results..." />;
  }

  if (!loading && results.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <AppScroll refreshing={refreshing} onRefresh={refresh} style={styles.container}>
          <View style={styles.emptyWrap}>
            <Ionicons name="school-outline" size={34} color="#64748B" />
            <Text style={styles.emptyTitle}>No result uploaded</Text>
            <Text style={styles.emptySub}>Your teacher has not uploaded results yet.</Text>
          </View>
        </AppScroll>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppScroll
        refreshing={refreshing}
        onRefresh={refresh}
        style={styles.container}
      >
        <Text style={styles.title}>Results</Text>
        <Text style={styles.subTitle}>
          Your test performance
        </Text>

        {results.map((item) => {
          const performance =
            resultService.getPerformanceLabel(
              item.percentage
            );

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.row}>
                <Ionicons
                  name="document-text"
                  size={22}
                  color="#38BDF8"
                />
                <Text style={styles.testName}>
                  {item.name}
                </Text>
              </View>

              <Text style={styles.date}>
                {formatDate(item.date)}
              </Text>

              <View style={styles.marksRow}>
                <MarkBox
                  label="Marks"
                  value={`${item.obtained}/${item.total}`}
                  color="#38BDF8"
                />
                <MarkBox
                  label="Correct"
                  value={item.correct}
                  color="#22C55E"
                />
                <MarkBox
                  label="Wrong"
                  value={item.wrong}
                  color="#EF4444"
                />
              </View>

              <View style={styles.performance}>
                <Text style={styles.percent}>
                  {item.percentage}%
                </Text>
                <Text
                  style={[
                    styles.performanceText,
                    { color: performance.color },
                  ]}
                >
                  {performance.label}
                </Text>
              </View>
            </View>
          );
        })}
      </AppScroll>
    </SafeAreaView>
  );
}

function MarkBox({ label, value, color }) {
  return (
    <View style={styles.marksBox}>
      <Text style={[styles.marksValue, { color }]}>
        {String(value)}
      </Text>
      <Text style={styles.marksLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: { padding: 20 },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#E5E7EB",
  },

  subTitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  testName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E5E7EB",
    marginLeft: 8,
  },

  date: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 12,
  },

  marksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  marksBox: {
    width: "30%",
    backgroundColor: "#0B1220",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },

  marksValue: {
    fontSize: 16,
    fontWeight: "800",
  },

  marksLabel: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },

  performance: {
    marginTop: 12,
    alignItems: "center",
  },

  percent: {
    fontSize: 20,
    fontWeight: "800",
    color: "#E5E7EB",
  },

  performanceText: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyWrap: {
    marginTop: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 8,
    color: "#CBD5E1",
    fontSize: 16,
    fontWeight: "700",
  },
  emptySub: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
  },
});
