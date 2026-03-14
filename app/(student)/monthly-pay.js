import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useProfile from "../../src/hooks/useProfile";
import { classFeeService } from "../../src/services/classFeeService";
import { promoService } from "../../src/services/promoService";
import { studentPaymentFlowService } from "../../src/services/studentPaymentFlowService";
import { toastService } from "../../src/services/toastService";
import { APP_THEME } from "../../src/utils/constants";

const getMonthKeys = (count) => {
  const safeCount = Math.max(1, Math.min(12, Number(count || 1)));
  const out = [];
  const now = new Date();
  for (let i = 0; i < safeCount; i += 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return out;
};

export default function MonthlyFeeScreen() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();

  const [monthlyFee, setMonthlyFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [monthCount, setMonthCount] = useState(1);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!profile?.class) {
        if (mounted) {
          setMonthlyFee(0);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const cfg = await classFeeService.getClassFeeConfig(profile.class);
      if (!mounted) return;
      setMonthlyFee(Math.max(0, Number(cfg?.monthly_fee ?? 0)));
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [profile?.class]);

  const selectedMonths = useMemo(() => getMonthKeys(monthCount), [monthCount]);
  const totalAmount = useMemo(
    () => Math.max(0, Number(monthlyFee || 0) * Math.max(1, Number(monthCount || 1))),
    [monthlyFee, monthCount]
  );
  const estimatedAfterPromo = useMemo(() => {
    if (!appliedPromoCode) return totalAmount;
    return Math.max(
      0,
      Math.round(totalAmount * (1 - Math.max(0, discountPercent) / 100) * 100) / 100
    );
  }, [appliedPromoCode, discountPercent, totalAmount]);

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setAppliedPromoCode("");
      setDiscountPercent(0);
      toastService.error("Missing", "Enter promo code first.");
      return;
    }
    setPromoApplying(true);
    try {
      const validation = await promoService.validatePromoCode(code);
      if (!validation.valid) {
        setAppliedPromoCode("");
        setDiscountPercent(0);
        toastService.error("Invalid", "Promo code not found or inactive.");
        return;
      }
      const appliedCode = String(validation.code ?? code).toUpperCase();
      const percent = Math.max(0, Number(validation.discountPercent || 0));
      setPromoCode(appliedCode);
      setAppliedPromoCode(appliedCode);
      setDiscountPercent(percent);
      toastService.success("Promo applied", `${appliedCode} (${percent}% off)`);
    } catch {
      setAppliedPromoCode("");
      setDiscountPercent(0);
      toastService.error("Failed", "Unable to validate promo code.");
    } finally {
      setPromoApplying(false);
    }
  };

  const onPromoChange = (value) => {
    const next = String(value ?? "").toUpperCase();
    setPromoCode(next);
    if (appliedPromoCode && next.trim() !== appliedPromoCode) {
      setAppliedPromoCode("");
      setDiscountPercent(0);
    }
  };

  const handlePay = async () => {
    if (!profile?.id) {
      toastService.error("Please wait", "Student profile is still loading.");
      return;
    }
    if (!monthlyFee) {
      toastService.error("Fee not set", "Teacher has not set monthly fee yet.");
      return;
    }

    setPaying(true);
    try {
      const result = await studentPaymentFlowService.run({
        profile,
        flow: "monthly_fee",
        title: `Monthly Fee (${monthCount} month)`,
        months: selectedMonths,
        promoCode: appliedPromoCode || null,
      });
      toastService.success("Payment success", `Rs.${result.amount} paid successfully.`);
      router.replace("/(student)/home");
    } catch (error) {
      toastService.error("Payment failed", error?.message || "Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Ionicons name="calendar" size={28} color="#38BDF8" />
          <Text style={styles.title}>Monthly Fee</Text>
          <Text style={styles.sub}>Pay monthly class fee only.</Text>
          <Text style={styles.secureSub}>In-app Razorpay checkout only</Text>
        </View>

        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color="#38BDF8" />
          ) : (
            <>
              <Text style={styles.amountLabel}>Monthly Fee</Text>
              <Text style={styles.amount}>Rs.{monthlyFee}</Text>

              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setMonthCount((v) => Math.max(1, v - 1))}
                >
                  <Text style={styles.counterText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterLabel}>{monthCount} month</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setMonthCount((v) => Math.min(12, v + 1))}
                >
                  <Text style={styles.counterText}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.total}>Total: Rs.{totalAmount}</Text>
              {appliedPromoCode ? (
                <Text style={styles.discountText}>
                  Estimated after promo: Rs.{estimatedAfterPromo}
                </Text>
              ) : null}

              <Text style={styles.label}>Promo Code (optional)</Text>
              <View style={styles.promoRow}>
                <TextInput
                  style={[styles.input, styles.promoInput]}
                  value={promoCode}
                  onChangeText={onPromoChange}
                  placeholder="Enter promo code"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  editable={!paying && !promoApplying}
                />
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={applyPromo}
                  disabled={paying || promoApplying}
                >
                  {promoApplying ? (
                    <ActivityIndicator color="#020617" />
                  ) : (
                    <Text style={styles.applyText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {appliedPromoCode ? (
                <Text style={styles.appliedText}>
                  Applied: {appliedPromoCode} ({discountPercent}% off)
                </Text>
              ) : (
                <Text style={styles.helper}>Enter code and tap Apply before payment.</Text>
              )}

              <TouchableOpacity
                style={styles.payBtn}
                disabled={!monthlyFee || paying || profileLoading}
                onPress={handlePay}
              >
                {paying ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text style={styles.payText}>Pay Monthly Fee</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: APP_THEME.bg },
  container: { padding: 16, paddingBottom: 24 },
  header: { marginBottom: 12 },
  title: { color: APP_THEME.text, fontSize: 20, fontWeight: "800", marginTop: 6 },
  sub: { color: APP_THEME.muted, fontSize: 12, marginTop: 4 },
  secureSub: { color: "#7DD3FC", fontSize: 11, marginTop: 4, fontWeight: "700" },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    padding: 14,
    marginBottom: 12,
  },
  amountLabel: { color: APP_THEME.muted, fontSize: 12 },
  amount: { color: "#38BDF8", fontSize: 24, fontWeight: "800", marginTop: 6 },
  counterRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  counterBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
  },
  counterText: { color: "#E2E8F0", fontSize: 18, fontWeight: "800" },
  counterLabel: { color: "#E2E8F0", fontWeight: "700", fontSize: 13 },
  total: { color: APP_THEME.text, fontSize: 13, fontWeight: "700", marginTop: 10 },
  discountText: { color: "#86EFAC", fontSize: 12, marginTop: 6, fontWeight: "700" },
  label: { color: APP_THEME.muted, fontSize: 12, marginTop: 10, marginBottom: 6 },
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  promoInput: { flex: 1 },
  input: {
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    color: APP_THEME.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  applyBtn: {
    height: 42,
    minWidth: 76,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FACC15",
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: "#111827", fontSize: 12, fontWeight: "800" },
  appliedText: { color: "#86EFAC", fontSize: 11, marginTop: 6, fontWeight: "700" },
  helper: { color: APP_THEME.muted, fontSize: 11, marginTop: 6 },
  payBtn: {
    marginTop: 10,
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  payText: { color: "#020617", fontSize: 13, fontWeight: "800" },
});
