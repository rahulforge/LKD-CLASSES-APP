import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useProfile from "../../src/hooks/useProfile";
import useAuth from "../../src/hooks/useAuth";
import { classFeeService } from "../../src/services/classFeeService";
import { paymentService } from "../../src/services/paymentService";

export default function Profile() {
  const router = useRouter();
  const { logout } = useAuth();
  const { profile, loading } = useProfile();
  const [loggingOut, setLoggingOut] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);

  useEffect(() => {
    if (!profile?.class) return;
    void classFeeService
      .getClassFeeConfig(profile.class)
      .then((cfg) => setMonthlyFee(Math.max(0, Number(cfg?.monthly_fee ?? 0))));
  }, [profile?.class]);

  useEffect(() => {
    if (!profile?.roll_number) return;
    const load = async () => {
      const monthly = Math.max(0, Number(monthlyFee || 0));
      const rowsRes = await paymentService.getPaymentTrackingByRoll(
        profile.roll_number,
        1,
        200
      );
      const monthlyRows = (rowsRes.rows || []).filter((r) => {
        const kind = String(r.payment_kind || "").toLowerCase();
        return (
          kind === "" ||
          kind === "offline_monthly" ||
          kind === "online_monthly" ||
          kind === "monthly_fee"
        );
      });
      let totalPaid = 0;
      for (const r of monthlyRows) {
        const amount = Number(r.amount || 0);
        const mode = String(r.payment_mode || "").toLowerCase();
        const effective = amount > 0 ? amount : mode === "promo" && monthly > 0 ? monthly : 0;
        totalPaid += effective;
      }
      setMonthlyTotal(Math.round(totalPaid * 100) / 100);
    };
    void load();
  }, [profile?.roll_number, monthlyFee]);

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor="#0B1220" barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileBox}>
          <Ionicons name="person-circle" size={90} color="#38BDF8" />
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.subInfo}>STUDENT</Text>
        </View>

        <View style={styles.card}>
          <Detail label="Class" value={profile.class_name || "-"} />
          <Detail
            label="Join Date"
            value={
              profile.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-IN")
                : "-"
            }
          />
          <Detail label="Roll Number" value={profile.roll_number || "-"} />
          <Detail label="Mobile" value={profile.phone || "-"} />
        </View>

        <View style={styles.card}>
          <Detail label="Monthly Paid Total" value={`Rs.${monthlyTotal}`} />
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            if (loggingOut) return;
            setLoggingOut(true);
            router.replace("/(public)/home");
            void logout().finally(() => setLoggingOut(false));
          }}
          disabled={loggingOut}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>
            {loggingOut ? "Logging out..." : "Logout"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  container: {
    padding: 20,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#94A3B8",
  },
  profileBox: {
    alignItems: "center",
    marginBottom: 16,
  },
  name: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  subInfo: {
    color: "#94A3B8",
    marginTop: 2,
    fontSize: 12,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1E293B",
  },
  detailLabel: {
    color: "#94A3B8",
    fontSize: 13,
  },
  detailValue: {
    color: "#E5E7EB",
    fontWeight: "700",
    fontSize: 13,
  },
  logoutBtn: {
    marginTop: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
});
