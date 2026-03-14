import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useProfile from "../../src/hooks/useProfile";
import useAuth from "../../src/hooks/useAuth";
import { paymentService } from "../../src/services/paymentService";
import { toastService } from "../../src/services/toastService";

const DEFAULT_APP_ACCESS_FEE = Math.max(
  0,
  Number(process.env.EXPO_PUBLIC_APP_ACCESS_FEE ?? 50)
);

export default function AppAccessGate() {
  const router = useRouter();
  const { profile, loading, error, refreshProfile } = useProfile();
  const { logout } = useAuth();
  const [fee, setFee] = useState(DEFAULT_APP_ACCESS_FEE);
  const [starting, setStarting] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const autoRetryRef = useRef(false);

  const hasPaidAppAccess = useMemo(
    () => Boolean(profile?.app_access_paid),
    [profile?.app_access_paid]
  );

  useEffect(() => {
    void paymentService.getAppAccessFee().then(setFee).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) {
      setSlowLoading(false);
      return;
    }
    const id = setTimeout(() => setSlowLoading(true), 6000);
    return () => clearTimeout(id);
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (profile) {
      autoRetryRef.current = false;
      return;
    }
    if (!autoRetryRef.current) {
      autoRetryRef.current = true;
      void refreshProfile();
    }
  }, [loading, profile, refreshProfile]);

  useEffect(() => {
    if (loading) return;
    if (hasPaidAppAccess) {
      router.replace("/(student)/home");
    }
  }, [hasPaidAppAccess, loading, router]);

  const startPayment = async () => {
    if (starting) return;
    if (!profile?.id) {
      toastService.error("Please wait", "Profile is loading. Try again in 2 seconds.");
      void refreshProfile();
      return;
    }
    setStarting(true);
    try {
      router.push({
        pathname: "/(student)/checkout",
        params: {
          flow: "app_access",
          title: encodeURIComponent("App Access Fee"),
          amount: String(fee),
        },
      });
    } catch (error) {
      toastService.error("Payment failed", error?.message || "Please try again.");
    } finally {
      setStarting(false);
    }
  };

  if (loading && !slowLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.title}>Syncing account</Text>
            <Text style={styles.subTitle}>
              Please wait while we verify your app access status.
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void refreshProfile()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile || slowLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Ionicons name="alert-circle" size={34} color="#F59E0B" />
            <Text style={styles.title}>{slowLoading ? "Taking longer than usual" : "Profile Not Loaded"}</Text>
            <Text style={styles.subTitle}>
              {error || "Unable to load your account right now. Please retry."}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void refreshProfile()}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                Alert.alert("Logout", "Do you want to logout?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Logout",
                    style: "destructive",
                    onPress: () => {
                      void logout();
                      router.replace("/(public)/home");
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="phone-portrait" size={34} color="#38BDF8" />
          <Text style={styles.title}>App Access Required</Text>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Payable Amount</Text>
            <Text style={styles.amount}>Rs.{fee}</Text>
          </View>

          <TouchableOpacity
            style={styles.payBtn}
            onPress={startPayment}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color="#020617" />
            ) : (
              <Text style={styles.payText}>Pay & Continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert("Logout", "Do you want to logout?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Logout",
                  style: "destructive",
                  onPress: () => {
                    void logout();
                    router.replace("/(public)/home");
                  },
                },
              ]);
            }}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  card: {
    width: "100%",
    backgroundColor: "#020617",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 16,
  },
  title: { marginTop: 10, color: "#E2E8F0", fontSize: 20, fontWeight: "800" },
  subTitle: { marginTop: 6, color: "#94A3B8", fontSize: 12 },
  amountBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  amountLabel: { color: "#94A3B8", fontSize: 11 },
  amount: { marginTop: 4, color: "#38BDF8", fontSize: 24, fontWeight: "800" },
  payBtn: {
    marginTop: 14,
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  payText: { color: "#020617", fontWeight: "800", fontSize: 14 },
  logoutBtn: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 10,
    alignItems: "center",
  },
  logoutText: { color: "#CBD5E1", fontWeight: "700", fontSize: 12 },
  retryBtn: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 9,
    alignItems: "center",
  },
  retryText: { color: "#CBD5E1", fontWeight: "700", fontSize: 12 },
});
