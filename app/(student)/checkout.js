import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import useProfile from "../../src/hooks/useProfile";
import { paymentService } from "../../src/services/paymentService";
import { promoService } from "../../src/services/promoService";
import { toastService } from "../../src/services/toastService";
import { studentService } from "../../src/services/studentService";
import { razorpayService } from "../../src/services/razorpayService";

const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? "";
const sanitizePhone = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return "";
};
const isNativeCheckoutUnavailable = (error) => {
  const text = String(error?.message ?? "").toLowerCase();
  return (
    text.includes("module not loaded") ||
    text.includes("cannot read property 'open' of null") ||
    text.includes("cannot read properties of null") ||
    text.includes("native module")
  );
};

export default function StudentCheckout() {
  const router = useRouter();
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  const params = useLocalSearchParams();

  const amountParam = Number(params.amount || 0);
  const title = decodeURIComponent(String(params.title || "Payment"));
  const flow = String(params.flow || "content").trim().toLowerCase();
  const planCode = String(params.code || "").trim();
  const monthsParam = String(params.months || "").trim();
  const mockTestId = String(params.mock_test_id || "").trim();

  const [promoCode, setPromoCode] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [estimatedAmount, setEstimatedAmount] = useState(amountParam);
  const [finalAmount, setFinalAmount] = useState(null);
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const months = useMemo(
    () => monthsParam.split(",").map((m) => m.trim()).filter(Boolean),
    [monthsParam]
  );

  useEffect(() => {
    let mounted = true;
    if (profileLoading || !profile?.id) return () => {};

    const loadAmount = async () => {
      try {
        const expected = await paymentService.getExpectedAmountForFlow({
          flow,
          classValue: profile.class ?? null,
          months,
          mockTestId,
          planCode,
        });
        if (!mounted) return;
        setEstimatedAmount(
          expected !== null && expected !== undefined ? Number(expected || 0) : amountParam
        );
      } catch {
        if (!mounted) return;
        setEstimatedAmount(amountParam);
      }
    };
    void loadAmount();
    return () => {
      mounted = false;
    };
  }, [amountParam, flow, mockTestId, months, planCode, profile?.class, profile?.id, profileLoading]);

  const finalizeSuccess = useCallback(
    async (paymentId, paidAmount) => {
      if (!profile?.id || !profile?.student_type) return;

      await paymentService.verifyPaymentAndSync({
        paymentId,
        userId: profile.id,
        studentType: profile.student_type,
      });

      if (flow === "app_access") {
        await studentService.setAppAccessPaidForUser(profile.id, paymentId);
        await refreshProfile();
      }
      if (flow === "monthly_fee" && profile.roll_number && months.length) {
        try {
          await paymentService.upsertOnlineMonthlyPayments({
            roll_number: profile.roll_number,
            class_id: profile.class ?? null,
            student_type: profile.student_type,
            months,
            amountPerMonth:
              months.length > 0 ? Math.max(0, paidAmount / months.length) : paidAmount,
          });
        } catch {
          // Payment tracking is best-effort; payment status remains source of truth.
        }
      }
      if (flow === "test_fee" && profile.roll_number) {
        try {
          await paymentService.upsertPaymentTracking({
            roll_number: profile.roll_number,
            amount: paidAmount,
            status: "success",
            paid_month: `${new Date().toISOString().slice(0, 7)}-01`,
            paid_date: new Date().toISOString().slice(0, 10),
            payment_mode: "online",
            payment_kind: "test_fee",
          });
        } catch {
          // Payment tracking is best-effort; payment status remains source of truth.
        }
      }
      if (flow === "mock_test" && mockTestId && profile?.id) {
        await paymentService.upsertMockTestPayment({
          user_id: profile.id,
          mock_test_id: mockTestId,
          amount: paidAmount,
        });
      }

      toastService.success("Payment success", "Payment verified successfully.");
      router.replace("/(student)/home");
    },
    [flow, mockTestId, months, profile?.class, profile?.id, profile?.roll_number, profile?.student_type, refreshProfile, router]
  );

  const applyPromo = async () => {
    if (flow === "app_access") return;
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

  const startPayment = async () => {
    if (!profile?.id || !profile?.student_type) {
      toastService.error("Please wait", "Student profile is still loading.");
      await refreshProfile();
      return;
    }

    setCreating(true);
    setFinalAmount(null);
    try {
      const intent = await paymentService.createPaymentIntent({
        flow,
        classValue: profile.class ?? null,
        months,
        mockTestId,
        planCode,
        promoCode: flow === "app_access" ? null : appliedPromoCode || null,
      });

      setFinalAmount(intent.amount);

      if (intent.skipCheckout) {
        await finalizeSuccess(intent.paymentId, intent.amount);
        return;
      }

      if (!intent.orderId) {
        throw new Error("Order creation failed");
      }
      if (!RAZORPAY_KEY) {
        throw new Error(
          "In-app payment is required. Razorpay key missing in app env (EXPO_PUBLIC_RAZORPAY_KEY_ID)."
        );
      }

      let response;
      try {
        response = await razorpayService.openCheckout({
          key: RAZORPAY_KEY,
          amount: intent.amount,
          currency: intent.currency,
          name: "LKD Classes",
          description: title,
          orderId: intent.orderId,
          prefill: {
            name: profile?.name ?? "",
            contact: sanitizePhone(profile?.phone),
          },
          notes: {
            flow,
            user_id: profile.id,
          },
        });
      } catch (checkoutError) {
        if (isNativeCheckoutUnavailable(checkoutError)) {
          throw new Error(
            "In-app Razorpay module unavailable. Install a development/production build (Expo Go not supported)."
          );
        }
        throw checkoutError;
      }

      setVerifying(true);
      const verified = await paymentService.verifyRazorpayPayment({
        paymentId: intent.paymentId,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });
      setVerifying(false);

      if (!verified) {
        toastService.error("Verification failed", "Payment could not be verified.");
        return;
      }

      await finalizeSuccess(intent.paymentId, intent.amount);
    } catch (error) {
      toastService.error("Payment failed", error?.message || "Please try again.");
    } finally {
      setCreating(false);
      setVerifying(false);
    }
  };

  const estimatedAfterPromo = useMemo(() => {
    if (!appliedPromoCode || flow === "app_access") return estimatedAmount;
    return Math.max(
      0,
      Math.round(estimatedAmount * (1 - Math.max(0, discountPercent) / 100) * 100) / 100
    );
  }, [appliedPromoCode, discountPercent, estimatedAmount, flow]);
  const amountLabel = finalAmount !== null ? finalAmount : estimatedAfterPromo;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#E2E8F0" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          LKD Classes
        </Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.amount}>Rs.{amountLabel}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.noticeCard}>
          <View style={styles.noticeRow}>
            <Ionicons name="shield-checkmark" size={16} color="#38BDF8" />
            <Text style={styles.noticeTitle}>Secure In-App Payment</Text>
          </View>
          <Text style={styles.noticeText}>
            Payment will open inside app via Razorpay. External browser checkout is disabled.
          </Text>
        </View>

        {flow !== "app_access" && (
          <>
            <Text style={styles.label}>Promo Code (optional)</Text>
            <View style={styles.promoRow}>
              <TextInput
                style={[styles.input, styles.promoInput]}
                value={promoCode}
                onChangeText={onPromoChange}
                placeholder="Enter promo code"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                editable={!creating && !verifying && !promoApplying}
              />
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={applyPromo}
                disabled={creating || verifying || promoApplying}
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
            ) : null}
            <Text style={styles.helper}>
              Enter code and tap Apply (not valid for app access fee).
            </Text>
          </>
        )}

        <TouchableOpacity
          style={styles.payBtn}
          onPress={startPayment}
          disabled={creating || verifying || profileLoading}
        >
          {creating || verifying ? (
            <ActivityIndicator color="#020617" />
          ) : (
            <Text style={styles.payText}>Pay Rs.{amountLabel}</Text>
          )}
        </TouchableOpacity>

        {(creating || verifying) && (
          <Text style={styles.processing}>Processing secure payment...</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  header: {
    height: 54,
    paddingHorizontal: 12,
    backgroundColor: "#020617",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
    marginLeft: 10,
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    backgroundColor: "#020617",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaText: { color: "#CBD5E1", fontSize: 12, flex: 1, marginRight: 12 },
  amount: { color: "#38BDF8", fontSize: 16, fontWeight: "800" },
  body: { padding: 20 },
  noticeCard: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  noticeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  noticeTitle: { color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  noticeText: { color: "#94A3B8", fontSize: 11, lineHeight: 16 },
  label: { color: "#94A3B8", fontSize: 12, marginBottom: 6 },
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  promoInput: { flex: 1, marginBottom: 0 },
  input: {
    backgroundColor: "#020617",
    borderRadius: 12,
    padding: 12,
    color: "#E2E8F0",
    marginBottom: 8,
  },
  applyBtn: {
    height: 44,
    minWidth: 76,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FACC15",
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: "#111827", fontSize: 12, fontWeight: "800" },
  appliedText: { color: "#86EFAC", fontSize: 11, marginBottom: 4, fontWeight: "700" },
  helper: { color: "#64748B", fontSize: 11 },
  payBtn: {
    marginTop: 18,
    backgroundColor: "#38BDF8",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  payText: { color: "#020617", fontWeight: "800", fontSize: 14 },
  processing: { marginTop: 10, color: "#94A3B8", fontSize: 12 },
});
