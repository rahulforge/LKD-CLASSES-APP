import React from "react";
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
import { useSubscriptionPlans } from "../../src/hooks/useSubscriptionPlans";
import useSubscription from "../../src/hooks/useSubscription";
import useProfile from "../../src/hooks/useProfile";
import { promoService } from "../../src/services/promoService";
import { studentPaymentFlowService } from "../../src/services/studentPaymentFlowService";
import { toastService } from "../../src/services/toastService";
import { APP_THEME } from "../../src/utils/constants";

export default function SubscriptionScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { subscription, loading: subLoading } = useSubscription();
  const { plans, loading } = useSubscriptionPlans(true);
  const [promoCode, setPromoCode] = React.useState("");
  const [promoApplying, setPromoApplying] = React.useState(false);
  const [appliedPromoCode, setAppliedPromoCode] = React.useState("");
  const [discountPercent, setDiscountPercent] = React.useState(0);
  const [payingCode, setPayingCode] = React.useState("");

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

  const getEstimated = (amount) => {
    if (!appliedPromoCode) return Number(amount || 0);
    return Math.max(
      0,
      Math.round(Number(amount || 0) * (1 - Math.max(0, discountPercent) / 100) * 100) / 100
    );
  };

  const currentPlan = React.useMemo(() => {
    const code = String(subscription?.planCode ?? "").trim().toLowerCase();
    if (!code) return null;
    return plans.find((plan) => String(plan.code).trim().toLowerCase() === code) ?? null;
  }, [plans, subscription?.planCode]);

  const expiresLabel = React.useMemo(() => {
    if (!subscription?.expiresAt) return "No expiry";
    try {
      return new Date(subscription.expiresAt).toLocaleDateString("en-IN");
    } catch {
      return subscription.expiresAt;
    }
  }, [subscription?.expiresAt]);

  const handleSubscribe = async (plan) => {
    if (!profile?.id) {
      toastService.error("Please wait", "Student profile is still loading.");
      return;
    }
    setPayingCode(plan.code);
    try {
      const result = await studentPaymentFlowService.run({
        profile,
        flow: "subscription",
        planCode: plan.code,
        promoCode: appliedPromoCode || null,
        title: plan.title || "Subscription",
      });
      toastService.success("Payment success", `Rs.${result.amount} paid successfully.`);
      router.replace("/(student)/home");
    } catch (error) {
      toastService.error("Payment failed", error?.message || "Please try again.");
    } finally {
      setPayingCode("");
    }
  };

  const hasActivePlan = Boolean(subscription?.isActive);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Ionicons name="wallet" size={28} color="#38BDF8" />
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.sub}>Choose subscription plan only.</Text>
          <Text style={styles.secureSub}>In-app Razorpay checkout only</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Subscription</Text>
          {subLoading ? (
            <Text style={styles.muted}>Checking subscription...</Text>
          ) : subscription?.isActive ? (
            <>
              <Text style={styles.planTitle}>
                {currentPlan?.title || subscription?.planCode || "Active Plan"}
              </Text>
              <Text style={styles.muted}>
                Valid till: {expiresLabel}
              </Text>
            </>
          ) : (
            <Text style={styles.muted}>No active subscription</Text>
          )}
        </View>
        {hasActivePlan ? (
          <Text style={styles.switchNote}>
            Buying another plan adds its months to your current validity.
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
            editable={!promoApplying && !payingCode}
          />
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={applyPromo}
            disabled={promoApplying || !!payingCode}
          >
            {promoApplying ? (
              <ActivityIndicator color="#111827" />
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

        {loading ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Loading plans...</Text>
          </View>
        ) : plans.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>No subscription plans available.</Text>
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.code} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.planTitle}>{plan.title || plan.code}</Text>
                {plan.badge ? <Text style={styles.badge}>{plan.badge}</Text> : null}
              </View>
              <Text style={styles.price}>Rs.{plan.amount}</Text>
              {appliedPromoCode ? (
                <Text style={styles.discountText}>Estimated after promo: Rs.{getEstimated(plan.amount)}</Text>
              ) : null}
              <Text style={styles.muted}>{plan.duration_months} month access</Text>

              <TouchableOpacity
                style={styles.payBtn}
                onPress={() => void handleSubscribe(plan)}
                disabled={payingCode === plan.code}
              >
                {payingCode === plan.code ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text style={styles.payText}>
                    {hasActivePlan ? "Extend Plan" : "Subscribe"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
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
  label: { color: APP_THEME.muted, fontSize: 12, marginBottom: 6 },
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  promoInput: { flex: 1, marginBottom: 0 },
  input: {
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    color: APP_THEME.text,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 12,
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
  appliedText: { color: "#86EFAC", fontSize: 11, marginBottom: 10, fontWeight: "700" },
  helper: { color: APP_THEME.muted, fontSize: 11, marginBottom: 10 },
  switchNote: { color: "#94A3B8", fontSize: 11, marginBottom: 12 },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: APP_THEME.border,
    padding: 14,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planTitle: { color: APP_THEME.text, fontWeight: "800", fontSize: 14 },
  sectionTitle: { color: APP_THEME.text, fontWeight: "800", fontSize: 14, marginBottom: 6 },
  badge: {
    color: "#0B1220",
    backgroundColor: "#FACC15",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  price: { color: "#38BDF8", fontSize: 22, fontWeight: "800", marginTop: 6 },
  discountText: { color: "#86EFAC", fontSize: 11, marginTop: 4, fontWeight: "700" },
  muted: { color: APP_THEME.muted, fontSize: 12, marginTop: 4 },
  payBtn: {
    marginTop: 10,
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  payText: { color: "#020617", fontSize: 13, fontWeight: "800" },
});
