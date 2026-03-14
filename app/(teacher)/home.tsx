import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useAuth from "../../src/hooks/useAuth";
import { useTeacherDashboard } from "../../src/hooks/useTeacherDashboard";
import useNetwork from "../../src/hooks/useNetwork";
import { liveService } from "../../src/services/liveService";
import { APP_THEME } from "../../src/utils/constants";

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function TeacherHome() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, refreshing, refresh } = useTeacherDashboard();
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();
  const [scheduled, setScheduled] = useState<any[]>([]);

  const loadScheduled = useCallback(async () => {
    const rows = await liveService.getMyScheduled(user?.id);
    setScheduled(rows);
  }, [user?.id]);

  useEffect(() => {
    void loadScheduled();
  }, [loadScheduled]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(12, insets.top), paddingBottom: 120 + insets.bottom },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing && !loading} onRefresh={refresh} tintColor={APP_THEME.primary} />
      }
    >
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color={APP_THEME.warning} />
          <Text style={styles.offlineText}>Offline Mode - data may be outdated</Text>
        </View>
      )}

      <Text style={styles.heading}>Teacher Dashboard</Text>

      <View style={styles.grid}>
        <MetricCard
          label="Total Students"
          value={data?.totalStudents ?? 0}
          icon="people"
          color="#38BDF8"
        />
        <MetricCard
          label="Recent Uploads"
          value={(data?.recentUploads.lectures ?? 0) + (data?.recentUploads.materials ?? 0)}
          icon="cloud-upload"
          color="#FACC15"
        />
        <MetricCard
          label="Recent Notices"
          value={data?.recentNotices.length ?? 0}
          icon="notifications"
          color="#38BDF8"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Notices</Text>
        {(data?.recentNotices ?? []).length === 0 ? (
          <Text style={styles.muted}>No notices available.</Text>
        ) : (
          data?.recentNotices.map((notice) => (
            <View key={notice.id} style={styles.noticeRow}>
              <Text style={styles.noticeTitle}>{notice.title}</Text>
              <Text numberOfLines={2} style={styles.noticeMessage}>
                {notice.message}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live / Scheduled Sessions</Text>
        {!scheduled.length ? (
          <Text style={styles.muted}>No active or scheduled sessions.</Text>
        ) : (
          scheduled.map((item) => (
            <View key={item.id} style={styles.noticeRow}>
              <Text style={styles.noticeTitle}>{item.title}</Text>
              <Text style={styles.noticeMessage}>
                {new Date(item.starts_at).toLocaleString("en-IN")} | {item.status}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tomorrow Plans</Text>
        <Text style={styles.muted}>Create, edit, modify, delete, or clear all student plans.</Text>
        <TouchableOpacity style={styles.planBtn} onPress={() => router.push("/(teacher)/add-task")}>
          <Text style={styles.planBtnText}>Manage Tomorrow Plan</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
  },
  content: {
    padding: 16,
  },
  offlineBanner: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#331A00",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  offlineText: {
    color: APP_THEME.warning,
    fontSize: 12,
    fontWeight: "600",
  },
  heading: {
    color: APP_THEME.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
    marginBottom : 5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricCard: {
    width: "48%",
    backgroundColor: APP_THEME.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricLabel: {
    color: APP_THEME.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  metricValue: {
    color: APP_THEME.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 16,
    padding: 14,
    margin : 10,
  },
  cardTitle: {
    color: APP_THEME.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  muted: {
    color: APP_THEME.muted,
    fontSize: 13,
  },
  noticeRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APP_THEME.border,
    paddingVertical: 8,
  },
  noticeTitle: {
    color: APP_THEME.text,
    fontSize: 13,
    fontWeight: "700",
  },
  noticeMessage: {
    color: APP_THEME.muted,
    marginTop: 2,
    fontSize: 12,
  },
  planBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: `${APP_THEME.primary}22`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planBtnText: {
    color: APP_THEME.primary,
    fontWeight: "800",
    fontSize: 12,
  },
});
