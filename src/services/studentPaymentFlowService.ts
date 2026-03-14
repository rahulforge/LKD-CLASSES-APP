import { paymentService, type PaymentFlow } from "./paymentService";
import { razorpayService } from "./razorpayService";
import { studentService } from "./studentService";
import { subscriptionPlanService } from "./subscriptionPlanService";
import { subscriptionService } from "./SubscriptionService";
import type { StudentType } from "../types/user";

const RAZORPAY_KEY = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? "";

type StudentProfileLike = {
  id: string;
  name?: string | null;
  phone?: string | null;
  class?: string | null;
  roll_number?: string | null;
  student_type?: StudentType | string | null;
};

type RunStudentPaymentInput = {
  profile: StudentProfileLike | null | undefined;
  flow: PaymentFlow;
  title: string;
  promoCode?: string | null;
  planCode?: string | null;
  months?: string[];
  mockTestId?: string | null;
  onAppAccessPaid?: (() => Promise<void>) | (() => void);
};

const sanitizePhone = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return "";
};

const normalizeStudentType = (value: unknown): StudentType => {
  const cleaned = String(value ?? "").trim().toLowerCase();
  return cleaned === "offline" ? "offline" : "online";
};

const isNativeCheckoutUnavailable = (error: unknown) => {
  const text = String((error as any)?.message ?? "").toLowerCase();
  return (
    text.includes("module not loaded") ||
    text.includes("cannot read property 'open' of null") ||
    text.includes("cannot read properties of null") ||
    text.includes("native module")
  );
};

const applyPostSuccess = async (input: {
  profile: StudentProfileLike;
  flow: PaymentFlow;
  paymentId: string;
  paidAmount: number;
  months: string[];
  mockTestId: string | null;
  planCode?: string | null;
  onAppAccessPaid?: (() => Promise<void>) | (() => void);
}) => {
  const studentType = normalizeStudentType(input.profile.student_type);
  await paymentService.verifyPaymentAndSync({
    paymentId: input.paymentId,
    userId: input.profile.id,
    studentType,
  });

  if (input.flow === "app_access") {
    await studentService.setAppAccessPaidForUser(input.profile.id, input.paymentId);
    if (input.onAppAccessPaid) {
      await input.onAppAccessPaid();
    }
    return;
  }

  if (input.flow === "monthly_fee" && input.profile.roll_number && input.months.length) {
    try {
      await paymentService.upsertOnlineMonthlyPayments({
        roll_number: input.profile.roll_number,
        class_id: input.profile.class ?? null,
        student_type: studentType,
        months: input.months,
        amountPerMonth:
          input.months.length > 0
            ? Math.max(0, input.paidAmount / input.months.length)
            : input.paidAmount,
      });
    } catch {
      // Payment tracking is best-effort; payment status remains source of truth.
    }
    return;
  }

  if (input.flow === "subscription") {
    const code = String(input.planCode ?? "").trim();
    const plan = code ? await subscriptionPlanService.getPlanByCode(code) : null;
    const duration = Math.max(1, Number(plan?.duration_months ?? 1));
    const current = await subscriptionService.refreshSubscription(
      input.profile.id,
      studentType
    );
    const now = new Date();
    let base = now;
    if (current?.expiresAt) {
      const parsed = new Date(current.expiresAt);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
        base = parsed;
      }
    }
    const expires = new Date(base);
    expires.setMonth(expires.getMonth() + duration);
    const expiresAt = `${expires.getFullYear()}-${String(expires.getMonth() + 1).padStart(2, "0")}-${String(
      expires.getDate()
    ).padStart(2, "0")}`;

    await studentService.setStudentAccess({
      userId: input.profile.id,
      isActive: true,
      expiresAt,
      planCode: input.planCode ?? null,
    });
    await subscriptionService.clear(input.profile.id);
    await subscriptionService.refreshSubscription(input.profile.id, studentType);
    return;
  }

  if (input.flow === "test_fee" && input.profile.roll_number) {
    try {
      await paymentService.upsertPaymentTracking({
        roll_number: input.profile.roll_number,
        amount: input.paidAmount,
        status: "success",
        paid_month: `${new Date().toISOString().slice(0, 7)}-01`,
        paid_date: new Date().toISOString().slice(0, 10),
        payment_mode: "online",
        payment_kind: "test_fee",
      });
    } catch {
      // Payment tracking is best-effort; payment status remains source of truth.
    }
    return;
  }

  if (input.flow === "mock_test" && input.mockTestId) {
    await paymentService.upsertMockTestPayment({
      user_id: input.profile.id,
      mock_test_id: input.mockTestId,
      amount: input.paidAmount,
    });
  }
};

export const studentPaymentFlowService = {
  async run(input: RunStudentPaymentInput): Promise<{
    paymentId: string;
    amount: number;
  }> {
    const profile = input.profile;
    if (!profile?.id) {
      throw new Error("Student profile is still loading.");
    }

    const months = (input.months ?? []).filter(Boolean);
    const mockTestId = input.mockTestId ? String(input.mockTestId) : null;
    const promoCode = input.flow === "app_access" ? null : input.promoCode?.trim() || null;

    const intent = await paymentService.createPaymentIntent({
      flow: input.flow,
      classValue: profile.class ?? null,
      months,
      mockTestId,
      planCode: input.planCode ?? null,
      promoCode,
    });

    if (intent.skipCheckout) {
      await applyPostSuccess({
        profile,
        flow: input.flow,
        paymentId: intent.paymentId,
        paidAmount: intent.amount,
        months,
        mockTestId,
        planCode: input.planCode ?? null,
        onAppAccessPaid: input.onAppAccessPaid,
      });
      return { paymentId: intent.paymentId, amount: intent.amount };
    }

    if (!intent.orderId) {
      throw new Error("Order creation failed");
    }
    if (!RAZORPAY_KEY) {
      throw new Error(
        "In-app payment is required. Razorpay key missing in app env (EXPO_PUBLIC_RAZORPAY_KEY_ID)."
      );
    }

    let response: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    };
    try {
      response = await razorpayService.openCheckout({
        key: RAZORPAY_KEY,
        amount: intent.amount,
        currency: intent.currency,
        name: "LKD Classes",
        description: input.title,
        orderId: intent.orderId,
        prefill: {
          name: profile?.name ?? "",
          contact: sanitizePhone(profile?.phone),
        },
        notes: {
          flow: input.flow,
          user_id: profile.id,
        },
      });
    } catch (error) {
      if (isNativeCheckoutUnavailable(error)) {
        throw new Error(
          "In-app Razorpay module unavailable. Install a development/production build (Expo Go not supported)."
        );
      }
      throw error;
    }

    const verified = await paymentService.verifyRazorpayPayment({
      paymentId: intent.paymentId,
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
    });

    if (!verified) {
      throw new Error("Payment could not be verified.");
    }

    await applyPostSuccess({
      profile,
      flow: input.flow,
      paymentId: intent.paymentId,
      paidAmount: intent.amount,
      months,
      mockTestId,
      planCode: input.planCode ?? null,
      onAppAccessPaid: input.onAppAccessPaid,
    });

    return { paymentId: intent.paymentId, amount: intent.amount };
  },
};
