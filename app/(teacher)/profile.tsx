import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import useAuth from "../../src/hooks/useAuth";
import useProfile from "../../src/hooks/useProfile";
import { paymentService, type TeacherIncomeSummary } from "../../src/services/paymentService";
import { APP_THEME } from "../../src/utils/constants";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TeacherProfile() {
  const router = useRouter();
  const { logout } = useAuth();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const [income, setIncome] = useState<TeacherIncomeSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const monthLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }, []);

  const formatCurrency = useCallback((value: number) => `Rs. ${Math.round(value)}`, []);

  const loadIncome = useCallback(async () => {
    try {
      const data = await paymentService.getTeacherMonthlyIncomeSummary();
      setIncome(data);
    } catch {
      setIncome(null);
    }
  }, []);

  useEffect(() => {
    void loadIncome();
  }, [loadIncome]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadIncome();
    } finally {
      setRefreshing(false);
    }
  }, [loadIncome]);

  const onLogout = async () => {
    await logout();
    router.replace("/(public)/home");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 110 + insets.bottom,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={APP_THEME.primary}
        />
      }
    >
      <View style={styles.rowBetween}>
        <Text style={styles.heading}>Account</Text>
        <TouchableOpacity
          style={styles.configBtn}
          onPress={() => router.push("/(teacher)/profile-config")}
        >
          <Ionicons name="settings-outline" size={14} color={APP_THEME.bg} />
          <Text style={styles.configText}>Configure</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Row icon="person" label="Teacher" value={profile?.name ?? "-"} />
        <Row icon="call" label="Phone" value={profile?.phone ?? "-"} />
        <Row icon="shield-checkmark" label="Role" value={profile?.role ?? "-"} />
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.feesBtn} onPress={() => router.push("/(teacher)/fees")}>
          <Ionicons name="wallet-outline" size={16} color={APP_THEME.primary} />
          <Text style={styles.feesText}>Manage Monthly Fees</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Monthly Income ({monthLabel})</Text>
        <View style={styles.divider} />
        <Text style={styles.sectionHint}>
          Monthly fee only. Expected = total fee due, Covered = received. Collected shows
          teacher-entered offline payments.
        </Text>
        <Row
          icon="cash-outline"
          label="Expected Total"
          value={formatCurrency(income?.total.expected ?? 0)}
        />
        <Row
          icon="checkmark-done-outline"
          label="Covered Total"
          value={formatCurrency(income?.total.covered ?? 0)}
        />

        <View style={styles.divider} />

        <Row
          icon="globe-outline"
          label="Online (Expected / Covered)"
          value={`${formatCurrency(income?.online.expected ?? 0)} / ${formatCurrency(
            income?.online.covered ?? 0
          )}`}
        />
        <Row
          icon="school-outline"
          label="Collected (Teacher)"
          value={formatCurrency(income?.offline.covered ?? 0)}
        />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={18} color={APP_THEME.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Row icon="cube" label="App Version" value={Constants.expoConfig?.version ?? "1.0.0"} />
        <Row icon="headset" label="Support" value="+91-00000-00000" />
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={16} color={APP_THEME.primary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
    paddingHorizontal: 16,
  },
  heading: {
    color: APP_THEME.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: APP_THEME.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  value: {
    color: APP_THEME.text,
    fontSize: 13,
    fontWeight: "600",
  },
  configBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: APP_THEME.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  configText: {
    color: APP_THEME.bg,
    fontSize: 12,
    fontWeight: "800",
  },
  feesBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  feesText: {
    color: APP_THEME.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  logoutBtn: {
    marginTop: 8,
    backgroundColor: `${APP_THEME.danger}22`,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexDirection: "row",
  },
  logoutText: {
    color: APP_THEME.danger,
    fontSize: 13,
    fontWeight: "800",
  },
  footer: {
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    color: APP_THEME.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionHint: {
    color: APP_THEME.muted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: APP_THEME.border,
    marginVertical: 2,
  },
});
