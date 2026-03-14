import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { subscriptionService } from "./SubscriptionService";
import { classFeeService } from "./classFeeService";
import type { StudentType } from "../types/user";

export type PaymentStatus =
  | "pending"
  | "success"
  | "failed";

export type PaymentFlow =
  | "app_access"
  | "monthly_fee"
  | "test_fee"
  | "subscription"
  | "mock_test";

export type PaymentRecord = {
  id: string;
  user_id: string;
  amount: number;
  status: PaymentStatus;
  provider_payment_id: string | null;
  provider_order_id: string | null;
  created_at: string;
  promo_code?: string | null;
  flow?: PaymentFlow | string | null;
};

type CreatePaymentInput = {
  userId: string;
  amount: number;
  promoCode?: string | null;
  flow?: PaymentFlow | string | null;
  metadata?: Record<string, unknown> | null;
};

type VerifyPaymentInput = {
  paymentId: string;
  userId: string;
  studentType: StudentType;
};

export type TeacherPaymentTracking = {
  id: string;
  roll_number: string;
  amount: number;
  status: string;
  paid_month: string | null;
  paid_date: string | null;
  payment_mode: string | null;
  payment_kind?: string | null;
};

export type PaymentIntent = {
  paymentId: string;
  orderId?: string | null;
  amount: number;
  currency: string;
  skipCheckout: boolean;
};

export type MockTestPayment = {
  id: string;
  user_id: string;
  mock_test_id: string;
  amount: number;
  status: string;
  paid_at: string;
};

export type TeacherIncomeSummary = {
  monthKey: string;
  online: {
    expected: number;
    covered: number;
  };
  offline: {
    expected: number;
    covered: number;
  };
  total: {
    expected: number;
    covered: number;
  };
};

const normalizeMonthKey = (date?: Date): string => {
  const d = date ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const getNextMonthDateKey = (monthKey: string): string => {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
};

const toAmount = (value: unknown) => Math.max(0, Number(value ?? 0) || 0);
const toMoney = (value: unknown) => Math.round(toAmount(value) * 100) / 100;
const PAYMENT_SUMMARY_PREFIX = "lkd_payment_summary_v1_";
const PAYMENT_SUMMARY_TTL_MS = 1000 * 60 * 60 * 12;
const getSummaryKey = (userId: string) => `${PAYMENT_SUMMARY_PREFIX}${userId}`;
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );

const normalizeClassKey = (value: string) =>
  String(value ?? "").toLowerCase().replace(/\s+/g, "");
const CLASS_LIST_TTL = 5 * 60 * 1000;
let classListCache: { time: number; rows: { id: string; name: string }[] } | null = null;
const SUPABASE_FUNCTIONS_BASE = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "")
  .replace(/\/+$/, "")
  .concat("/functions/v1");
const SUPABASE_ANON_KEY = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "");
const DEV_TEST_PAYMENTS =
  String(process.env.EXPO_PUBLIC_DEV_TEST_PAYMENTS ?? "").toLowerCase() === "true";
const CREATE_PAYMENT_FN_NAMES = [
  "create-payment-order",
  "create-payment-intent",
  "payment-api",
  "dynamic-api",
  "clever-endpoint",
];
const VERIFY_PAYMENT_FN_NAMES = [
  "verify-payment",
  "verify-payment-order",
  "dynamic-api",
  "payment-api",
  "clever-endpoint",
];

const isFunctionNotFoundError = (value: unknown) => {
  const text = String(value ?? "").toLowerCase();
  return (
    text.includes("function not found") ||
    text.includes("edge function returned a non-2xx status code") ||
    text.includes("404") ||
    text.includes("not_found")
  );
};

const isRecoverableFunctionConfigError = (value: unknown) => {
  const text = String(value ?? "").toLowerCase();
  return (
    text.includes("razorpay env not configured") ||
    text.includes("supabase env not configured")
  );
};
const isOnConflictConstraintError = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .includes("no unique or exclusion constraint matching the on conflict specification");
const isPaymentTrackingStatusConstraintError = (value: unknown) => {
  const text = String(value ?? "").toLowerCase();
  return (
    text.includes("payment_tracking_status_check") ||
    (text.includes("check constraint") && text.includes("status"))
  );
};

const normalizePaymentTrackingStatus = (value: unknown): string => {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return "success";
  if (
    status === "success" ||
    status === "paid" ||
    status === "succeeded" ||
    status === "done" ||
    status === "completed" ||
    status === "ok"
  ) {
    return "success";
  }
  if (
    status === "pending" ||
    status === "processing" ||
    status === "in_progress" ||
    status === "unpaid" ||
    status === "due"
  ) {
    return "pending";
  }
  if (
    status === "failed" ||
    status === "fail" ||
    status === "error" ||
    status === "cancelled" ||
    status === "canceled"
  ) {
    return "failed";
  }
  return "success";
};

const isSuccessStatus = (value: unknown): boolean => {
  const status = String(value ?? "").trim().toLowerCase();
  return (
    status === "success" ||
    status === "paid" ||
    status === "succeeded" ||
    status === "done" ||
    status === "completed" ||
    status === "ok"
  );
};

const getPaymentTrackingStatusCandidates = (value: unknown): string[] => {
  const normalized = normalizePaymentTrackingStatus(value);
  const list: string[] = [];
  if (normalized === "success") {
    list.push("success", "paid", "PAID");
  } else if (normalized === "pending") {
    list.push("pending", "PENDING", "unpaid", "UNPAID");
  } else {
    list.push("failed", "FAILED");
  }
  const original = String(value ?? "").trim();
  if (original) list.push(original);
  return Array.from(new Set(list.filter(Boolean)));
};

const isInvalidJwtError = (value: unknown) => {
  const text = String(value ?? "").toLowerCase();
  return (
    text.includes("invalid jwt") ||
    text.includes("jwt not found") ||
    text.includes("jwt malformed") ||
    text.includes("jwt expired") ||
    text.includes("missing authorization header")
  );
};

const refreshAuthSessionIfPossible = async (): Promise<boolean> => {
  try {
    const current = await supabase.auth.getSession();
    const refreshToken = current.data.session?.refresh_token;
    if (!refreshToken) return false;
    const refreshed = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });
    return Boolean(refreshed.data.session && !refreshed.error);
  } catch {
    return false;
  }
};

const getAccessToken = async (): Promise<string | null> => {
  try {
    const current = await supabase.auth.getSession();
    if (current.data.session?.access_token) {
      return current.data.session.access_token;
    }
    const refreshed = await refreshAuthSessionIfPossible();
    if (!refreshed) return null;
    const afterRefresh = await supabase.auth.getSession();
    return afterRefresh.data.session?.access_token ?? null;
  } catch {
    return null;
  }
};

const manualUpsertPaymentTrackingByMonthKind = async (payload: {
  roll_number: string;
  amount: number;
  status: string;
  paid_month: string | null;
  paid_date: string | null;
  payment_mode: string | null;
  payment_kind?: string | null;
  class_id?: string | null;
  student_type?: string | null;
}): Promise<void> => {
  let query = supabase
    .from("payment_tracking")
    .select("id, amount")
    .eq("roll_number", payload.roll_number)
    .limit(1)
    .order("id", { ascending: false });

  if (payload.paid_month) {
    query = query.eq("paid_month", payload.paid_month);
  } else {
    query = query.is("paid_month", null);
  }

  if (payload.payment_kind) {
    query = query.eq("payment_kind", payload.payment_kind);
  } else {
    query = query.is("payment_kind", null);
  }

  const existing = await query.maybeSingle();
  if (existing.error) {
    throw new Error(existing.error.message || "Unable to lookup payment tracking");
  }

  if (existing.data?.id) {
    const kind = String(payload.payment_kind ?? "").toLowerCase();
    const isMonthlyKind =
      !kind || kind === "offline_monthly" || kind === "online_monthly" || kind === "monthly_fee";
    const previousAmount = Number((existing.data as any)?.amount ?? 0);
    const nextAmount = isMonthlyKind
      ? previousAmount + Number(payload.amount ?? 0)
      : Number(payload.amount ?? 0);
    const statusCandidates = getPaymentTrackingStatusCandidates(payload.status);
    let updateErrorMessage = "";
    let updated: any = null;
    for (const status of statusCandidates) {
      const writePayload = { ...payload, status, amount: nextAmount };
      updated = await supabase
        .from("payment_tracking")
        .update(writePayload)
        .eq("id", existing.data.id);
      if (!updated.error) {
        updateErrorMessage = "";
        break;
      }
      updateErrorMessage = String(updated.error.message ?? "");
      if (!isPaymentTrackingStatusConstraintError(updateErrorMessage)) {
        break;
      }
    }
    if (updated?.error && isPaymentTrackingStatusConstraintError(updated.error.message)) {
      const fallbackPayload = { ...payload };
      delete (fallbackPayload as any).status;
      updated = await supabase
        .from("payment_tracking")
        .update(fallbackPayload)
        .eq("id", existing.data.id);
    }
    if (updated?.error) {
      throw new Error(updated.error.message || updateErrorMessage || "Unable to update payment tracking");
    }
    return;
  }

  const statusCandidates = getPaymentTrackingStatusCandidates(payload.status);
  let inserted: any = null;
  let insertErrorMessage = "";
  for (const status of statusCandidates) {
    const writePayload = { ...payload, status };
    inserted = await supabase.from("payment_tracking").insert(writePayload);
    if (!inserted.error) {
      insertErrorMessage = "";
      break;
    }
    insertErrorMessage = String(inserted.error.message ?? "");
    if (!isPaymentTrackingStatusConstraintError(insertErrorMessage)) {
      break;
    }
  }

  if (inserted?.error && isPaymentTrackingStatusConstraintError(inserted.error.message)) {
    const fallbackPayload = { ...payload };
    delete (fallbackPayload as any).status;
    inserted = await supabase.from("payment_tracking").insert(fallbackPayload);
  }

  if (inserted?.error) {
    throw new Error(inserted.error.message || insertErrorMessage || "Unable to insert payment tracking");
  }
};

const invokeEdgeDirect = async (
  fnName: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<{ data: any; errorMessage: string | null }> => {
  if (!SUPABASE_FUNCTIONS_BASE || !SUPABASE_ANON_KEY) {
    return {
      data: null,
      errorMessage: "Supabase env missing. Check EXPO_PUBLIC_SUPABASE_URL and ANON key.",
    };
  }

  try {
    const response = await fetch(`${SUPABASE_FUNCTIONS_BASE}/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const raw = await response.text().catch(() => "");
    let parsed: any = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    if (!response.ok) {
      const msg =
        String(parsed?.error ?? parsed?.message ?? raw ?? "").trim() ||
        `Request failed (${response.status})`;
      return { data: null, errorMessage: msg };
    }

    return { data: parsed, errorMessage: null };
  } catch (error: any) {
    return {
      data: null,
      errorMessage: String(error?.message ?? "Network request failed"),
    };
  }
};

const invokeEdgeWithFallback = async (
  functionNames: string[],
  body: Record<string, unknown>,
  fallbackMessage: string,
  isValidData?: (data: any) => boolean
): Promise<any> => {
  let accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Session expired. Please login again.");
  }

  let lastMessage = "";
  for (const fnName of functionNames) {
    let retriedAfterRefresh = false;
    while (true) {
      const invoke = await invokeEdgeDirect(fnName, body, accessToken);
      if (!invoke.errorMessage && invoke.data !== null && invoke.data !== undefined) {
        if (!isValidData || isValidData(invoke.data)) {
          return invoke.data;
        }
        lastMessage = `Invalid response from function: ${fnName}`;
        break;
      }
      const message = String(invoke.errorMessage ?? "").trim() || fallbackMessage;
      lastMessage = message || lastMessage;

      if (isInvalidJwtError(message) && !retriedAfterRefresh) {
        retriedAfterRefresh = true;
        const refreshed = await refreshAuthSessionIfPossible();
        if (refreshed) {
          accessToken = await getAccessToken();
          if (!accessToken) {
            throw new Error("Session expired. Please login again.");
          }
          continue;
        }
      }

      if (isRecoverableFunctionConfigError(message)) {
        break;
      }

      if (!isFunctionNotFoundError(message)) {
        throw new Error(message || fallbackMessage);
      }
      break;
    }
  }
  if (isInvalidJwtError(lastMessage)) {
    throw new Error("Session expired. Please login again.");
  }
  if (isFunctionNotFoundError(lastMessage)) {
    throw new Error(
      `Payment function missing on server. Deploy edge function: ${functionNames[0]}`
    );
  }
  throw new Error(
    lastMessage ||
      `${fallbackMessage}. Please deploy edge function: ${functionNames[0]}`
  );
};

export const paymentService = {
  async getPaymentRecord(paymentId: string): Promise<PaymentRecord | null> {
    const id = String(paymentId ?? "").trim();
    if (!id) return null;
    const { data, error } = await supabase
      .from("payments")
      .select("id, user_id, amount, status, provider_payment_id, provider_order_id, created_at, promo_code, flow")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data as PaymentRecord;
  },

  async createPaymentIntent(input: {
    flow: PaymentFlow;
    classValue?: string | null;
    months?: string[];
    mockTestId?: string | null;
    planCode?: string | null;
    promoCode?: string | null;
  }): Promise<PaymentIntent> {
    const payload = {
      flow: input.flow,
      class_value: input.classValue ?? null,
      months: (input.months ?? []).filter(Boolean),
      mock_test_id: input.mockTestId ?? null,
      plan_code: input.planCode ?? null,
      promo_code: input.promoCode ?? null,
      dev_test: DEV_TEST_PAYMENTS,
    };

    const data = await invokeEdgeWithFallback(
      CREATE_PAYMENT_FN_NAMES,
      payload,
      "Unable to start payment",
      (res) => Boolean(res?.payment_id)
    );

    return {
      paymentId: String(data.payment_id),
      orderId: data.order_id ? String(data.order_id) : null,
      amount: toMoney(data.amount ?? 0),
      currency: String(data.currency ?? "INR"),
      skipCheckout: Boolean(data.skip_checkout),
    };
  },

  async verifyRazorpayPayment(input: {
    paymentId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<boolean> {
    const payload = {
      payment_id: input.paymentId,
      razorpay_order_id: input.razorpayOrderId,
      razorpay_payment_id: input.razorpayPaymentId,
      razorpay_signature: input.razorpaySignature,
    };
    try {
      const data = await invokeEdgeWithFallback(
        VERIFY_PAYMENT_FN_NAMES,
        payload,
        "Unable to verify payment",
        (res) => typeof res?.success === "boolean"
      );
      return data?.success === true;
    } catch {
      return false;
    }
  },

  async getAppAccessFee(): Promise<number> {
    const { data, error } = await supabase
      .from("app_runtime_config")
      .select("app_access_fee")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) {
      return Math.max(0, Number(process.env.EXPO_PUBLIC_APP_ACCESS_FEE ?? 50));
    }
    return toAmount((data as any).app_access_fee ?? 50);
  },

  async resolveClassId(classValue?: string | null): Promise<string | null> {
    const raw = String(classValue ?? "").trim();
    if (!raw) return null;
    if (isUuid(raw)) return raw;

    const normalized = normalizeClassKey(raw);
    let rows = classListCache;
    if (!rows || Date.now() - rows.time > CLASS_LIST_TTL) {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(300);
      if (error || !data?.length) return null;
      rows = { time: Date.now(), rows: data as any[] };
      classListCache = rows;
    }
    const match = rows.rows.find((row) => {
      const key = normalizeClassKey(row.name);
      return key === normalized || key.endsWith(normalized) || normalized.endsWith(key);
    });
    return match?.id ? String(match.id) : null;
  },

  async resolveClassCandidates(classValue?: string | null): Promise<string[]> {
    const raw = String(classValue ?? "").trim();
    if (!raw) return [];

    let rows = classListCache;
    if (!rows || Date.now() - rows.time > CLASS_LIST_TTL) {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(300);
      if (error || !data?.length) return [raw];
      rows = { time: Date.now(), rows: data as any[] };
      classListCache = rows;
    }

    if (isUuid(raw)) {
      const current = rows.rows.find((row) => String(row.id) === raw);
      const targetKey = current ? normalizeClassKey(String(current.name ?? "")) : "";
      if (!targetKey) return [raw];
      const ids = rows.rows
        .filter((row) => normalizeClassKey(String(row.name ?? "")) === targetKey)
        .map((row) => String(row.id));
      if (!ids.includes(raw)) ids.push(raw);
      return Array.from(new Set(ids));
    }

    const targetKey = normalizeClassKey(raw);
    const ids = rows.rows
      .filter((row) => {
        const key = normalizeClassKey(String(row.name ?? ""));
        return key === targetKey || key.endsWith(targetKey) || targetKey.endsWith(key);
      })
      .map((row) => String(row.id));
    if (!ids.length) {
      const resolved = await this.resolveClassId(raw);
      return resolved ? [resolved] : [];
    }
    return Array.from(new Set(ids));
  },

  async getMonthlyFeeForClass(classValue?: string | null): Promise<number | null> {
    const raw = String(classValue ?? "").trim();
    if (!raw) return null;
    const cfg = await classFeeService.getClassFeeConfig(raw);
    if (!cfg) return null;
    return toMoney(cfg.monthly_fee ?? 0);
  },

  async getTestFeeForClass(classValue?: string | null): Promise<number | null> {
    const raw = String(classValue ?? "").trim();
    if (!raw) return null;
    const cfg = await classFeeService.getClassFeeConfig(raw);
    if (!cfg) return null;
    return toMoney(cfg.test_fee ?? cfg.monthly_fee ?? 0);
  },

  async getMockTestPrice(mockTestId?: string | null): Promise<number | null> {
    const id = String(mockTestId ?? "").trim();
    if (!id) return null;
    const { data, error } = await supabase
      .from("mock_tests")
      .select("price, is_free")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return toMoney((data as any).price ?? 0);
  },

  async getSubscriptionAmount(planCode?: string | null): Promise<number | null> {
    const code = String(planCode ?? "").trim().toLowerCase();
    if (!code) return null;
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("amount")
      .ilike("code", code)
      .maybeSingle();
    if (error || !data) return null;
    return toMoney((data as any).amount ?? 0);
  },

  async getExpectedAmountForFlow(input: {
    flow: string;
    classValue?: string | null;
    months?: string[];
    mockTestId?: string | null;
    planCode?: string | null;
  }): Promise<number | null> {
    const flow = String(input.flow ?? "").trim().toLowerCase();
    if (flow === "app_access") {
      return this.getAppAccessFee();
    }
    if (flow === "monthly_fee") {
      const fee = await this.getMonthlyFeeForClass(input.classValue ?? null);
      if (fee == null) return null;
      const months = (input.months ?? []).filter(Boolean);
      return toMoney(fee * Math.max(1, months.length || 1));
    }
    if (flow === "test_fee") {
      return this.getTestFeeForClass(input.classValue ?? null);
    }
    if (flow === "mock_test") {
      return this.getMockTestPrice(input.mockTestId ?? null);
    }
    if (flow === "subscription") {
      return this.getSubscriptionAmount(input.planCode ?? null);
    }
    return null;
  },

  async validatePaymentAmountForFlow(input: {
    flow: string;
    paidAmount: number;
    classValue?: string | null;
    months?: string[];
    mockTestId?: string | null;
    planCode?: string | null;
  }): Promise<boolean> {
    const expected = await this.getExpectedAmountForFlow({
      flow: input.flow,
      classValue: input.classValue,
      months: input.months,
      mockTestId: input.mockTestId,
      planCode: input.planCode,
    });
    if (expected == null) return true;
    const paid = toMoney(input.paidAmount);
    return paid + 0.5 >= expected;
  },
  async createPendingPayment(
    input: CreatePaymentInput
  ): Promise<PaymentRecord> {
    const { data, error } = await supabase
      .from("payments")
      .insert({
        user_id: input.userId,
        amount: input.amount,
        status: "pending",
        promo_code: input.promoCode ?? null,
        flow: input.flow ?? null,
        metadata: input.metadata ?? null,
        provider: "razorpay",
      })
      .select(
        "id, user_id, amount, status, provider_payment_id, provider_order_id, created_at, flow"
      )
      .single();

    if (error || !data) {
      throw new Error(
        error?.message || "Unable to create payment"
      );
    }

    return data as PaymentRecord;
  },

  buildCheckoutUrl(
    paymentId: string,
    returnUrl: string
  ): string {
    const baseUrl =
      process.env.EXPO_PUBLIC_CHECKOUT_URL ??
      "https://lkdclasses.netlify.app/pay";
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}payment_id=${paymentId}&return_url=${encodeURIComponent(
      returnUrl
    )}`;
  },

  async verifyPaymentAndSync(
    input: VerifyPaymentInput
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("payments")
      .select("status")
      .eq("id", input.paymentId)
      .eq("user_id", input.userId)
      .maybeSingle();

    if (error || !data) return false;

    if (data.status === "success") {
      await subscriptionService.refreshSubscription(
        input.userId,
        input.studentType
      );
      await this.refreshPaymentSummaryCache(input.userId);
      return true;
    }

    return false;
  },

  async verifyLatestPaymentAndSync(
    userId: string,
    studentType: StudentType
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("payments")
      .select("status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;

    if (data.status === "success") {
      await subscriptionService.refreshSubscription(
        userId,
        studentType
      );
      await this.refreshPaymentSummaryCache(userId);
      return true;
    }

    return false;
  },

  async getPaymentSummary(userId: string): Promise<{
    totalPaid: number;
    successCount: number;
    lastPaymentAt: string | null;
  }> {
    const paymentsRes = await supabase
      .from("payments")
      .select("amount, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const studentRollRes = await supabase
      .from("students")
      .select("roll_number, created_at")
      .eq("user_id", userId)
      .not("roll_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let rollNumber = String(studentRollRes.data?.roll_number ?? "").trim();
    if (!rollNumber) {
      const profileRollRes = await supabase
        .from("profiles")
        .select("roll_number")
        .eq("id", userId)
        .maybeSingle();
      rollNumber = String(profileRollRes.data?.roll_number ?? "").trim();
    }

    let trackingRows: any[] = [];
    if (rollNumber) {
      const trackingRes = await supabase
        .from("payment_tracking")
        .select("id, amount, status, paid_date, payment_mode, payment_kind")
        .eq("roll_number", rollNumber)
        .order("paid_date", { ascending: false });
      if (!trackingRes.error && Array.isArray(trackingRes.data)) {
        trackingRows = trackingRes.data as any[];
      }
    }

    const paymentRows = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
    const onlineSuccessRows = paymentRows.filter((item) => isSuccessStatus(item.status));
    const onlineTotal = onlineSuccessRows.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const onlineCount = onlineSuccessRows.length;
    const onlineLast = onlineSuccessRows[0]?.created_at ?? null;

    const offlineRows = trackingRows.filter((row) => {
      const mode = String(row.payment_mode ?? "").toLowerCase();
      const kind = String(row.payment_kind ?? "").toLowerCase();
      const isOffline = mode === "offline" || kind === "offline_monthly";
      return isOffline && isSuccessStatus(row.status);
    });
    const offlineTotal = offlineRows.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const offlineCount = offlineRows.length;
    const offlineLast = offlineRows[0]?.paid_date ? String(offlineRows[0].paid_date) : null;

    let onlineTrackingTotal = 0;
    let onlineTrackingCount = 0;
    let onlineTrackingLast: string | null = null;
    if (!onlineCount) {
      const trackingOnlineRows = trackingRows.filter((row) => {
        const kind = String(row.payment_kind ?? "").toLowerCase();
        return kind === "online_monthly" && isSuccessStatus(row.status);
      });
      onlineTrackingTotal = trackingOnlineRows.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );
      onlineTrackingCount = trackingOnlineRows.length;
      onlineTrackingLast = trackingOnlineRows[0]?.paid_date
        ? String(trackingOnlineRows[0].paid_date)
        : null;
    }

    const candidates = [onlineLast, offlineLast, onlineTrackingLast]
      .filter(Boolean)
      .map((d) => new Date(String(d)))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    const lastPaymentAt = candidates.length ? candidates[0].toISOString() : null;

    return {
      totalPaid: Math.round((onlineTotal + offlineTotal + onlineTrackingTotal) * 100) / 100,
      successCount: onlineCount + offlineCount + onlineTrackingCount,
      lastPaymentAt,
    };
  },

  async getPaymentSummaryCached(
    userId: string,
    force = false
  ): Promise<{
    totalPaid: number;
    successCount: number;
    lastPaymentAt: string | null;
  }> {
    const key = getSummaryKey(userId);
    if (!force) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            time: number;
            data: {
              totalPaid: number;
              successCount: number;
              lastPaymentAt: string | null;
            };
          };
          if (
            typeof parsed?.time === "number" &&
            Date.now() - parsed.time < PAYMENT_SUMMARY_TTL_MS
          ) {
            return parsed.data;
          }
        } catch {
          await AsyncStorage.removeItem(key);
        }
      }
    }

    return this.refreshPaymentSummaryCache(userId);
  },

  async refreshPaymentSummaryCache(userId: string): Promise<{
    totalPaid: number;
    successCount: number;
    lastPaymentAt: string | null;
  }> {
    const data = await this.getPaymentSummary(userId);
    await AsyncStorage.setItem(
      getSummaryKey(userId),
      JSON.stringify({
        time: Date.now(),
        data,
      })
    );
    return data;
  },

  async getLatestSuccessfulPaymentByFlow(
    userId: string,
    flow: PaymentFlow | string
  ): Promise<PaymentRecord | null> {
    const uid = String(userId ?? "").trim();
    const cleanFlow = String(flow ?? "").trim().toLowerCase();
    if (!uid || !cleanFlow) return null;

    const selectCols =
      "id, user_id, amount, status, provider_payment_id, provider_order_id, created_at, promo_code, flow, metadata";
    let { data, error } = await supabase
      .from("payments")
      .select(selectCols)
      .eq("user_id", uid)
      .eq("status", "success")
      .eq("flow", cleanFlow)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const errMsg = String(error?.message ?? "").toLowerCase();
    if (error && errMsg.includes("flow") && errMsg.includes("does not exist")) {
      const fallback = await supabase
        .from("payments")
        .select(selectCols)
        .eq("user_id", uid)
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(10);
      if (fallback.error || !fallback.data?.length) return null;
      const matched =
        (fallback.data as any[]).find(
          (row) =>
            String(row?.flow ?? row?.metadata?.flow ?? "")
              .trim()
              .toLowerCase() === cleanFlow
        ) ?? null;
      return matched ? (matched as PaymentRecord) : null;
    }

    if (error || !data) return null;
    return data as PaymentRecord;
  },

  async getPaymentTrackingByRoll(
    rollNumber: string,
    page = 1,
    pageSize = 20
  ): Promise<{
    rows: TeacherPaymentTracking[];
    total: number;
  }> {
    const from = (Math.max(1, page) - 1) * pageSize;
    const to = from + pageSize - 1;
    const cleanRoll = rollNumber.trim();

    const { data, error, count } = await supabase
      .from("payment_tracking")
      .select(
        "id, roll_number, amount, status, paid_month, paid_date, payment_mode, payment_kind",
        { count: "exact" }
      )
      .eq("roll_number", cleanRoll)
      .order("paid_month", { ascending: false })
      .range(from, to);

    if (error || !data) {
      const fallback = await supabase
        .from("payment_tracking")
        .select(
          "id, roll_number, amount, status, paid_date, payment_mode, payment_kind",
          { count: "exact" }
        )
        .eq("roll_number", cleanRoll)
        .order("paid_date", { ascending: false })
        .range(from, to);
      if (fallback.error || !fallback.data) {
        return { rows: [], total: 0 };
      }
      return {
        rows: (fallback.data as any[]).map((row) => ({
          ...row,
          paid_month: row.paid_date
            ? String(row.paid_date).slice(0, 7) + "-01"
            : null,
        })) as TeacherPaymentTracking[],
        total: fallback.count ?? 0,
      };
    }

    return {
      rows: data as TeacherPaymentTracking[],
      total: count ?? 0,
    };
  },

  async getMyMonthlyPayments(rollNumber: string): Promise<TeacherPaymentTracking[]> {
    const cleanRoll = rollNumber.trim();
    const { data, error } = await supabase
      .from("payment_tracking")
      .select("id, roll_number, amount, status, paid_month, paid_date, payment_mode, payment_kind")
      .eq("roll_number", cleanRoll)
      .eq("payment_kind", "online_monthly")
      .order("paid_month", { ascending: false });

    if (error || !data) return [];
    return data as TeacherPaymentTracking[];
  },

  async hasPaidForMonth(rollNumber: string, monthDate: string): Promise<boolean> {
    const cleanRoll = rollNumber.trim();
    if (!cleanRoll || !monthDate) return false;
    const { data, error } = await supabase
      .from("payment_tracking")
      .select("id, paid_month")
      .eq("roll_number", cleanRoll)
      .eq("paid_month", monthDate)
      .limit(1);

    if (error || !data) return false;
    return data.length > 0;
  },

  async upsertOnlineMonthlyPayments(input: {
    roll_number: string;
    class_id: string | null;
    student_type: "online" | "offline";
    months: string[];
    amountPerMonth: number;
  }): Promise<void> {
    const mode = Number(input.amountPerMonth ?? 0) > 0 ? "online" : "promo";
    const payload = input.months.map((month) => ({
      roll_number: input.roll_number,
      amount: input.amountPerMonth,
      status: "success",
      paid_month: month,
      paid_date: new Date().toISOString().slice(0, 10),
      payment_mode: mode,
      payment_kind: "online_monthly",
      class_id: input.class_id ?? null,
      student_type: input.student_type,
    }));
    for (const row of payload) {
      await manualUpsertPaymentTrackingByMonthKind({
        roll_number: String(row.roll_number),
        amount: Number(row.amount ?? 0),
        status: String(row.status ?? "success"),
        paid_month: row.paid_month ? String(row.paid_month) : null,
        paid_date: row.paid_date ? String(row.paid_date) : null,
        payment_mode: row.payment_mode ? String(row.payment_mode) : null,
        payment_kind: row.payment_kind ? String(row.payment_kind) : null,
        class_id: row.class_id ? String(row.class_id) : null,
        student_type: row.student_type ? String(row.student_type) : null,
      });
    }
  },

  async upsertPaymentTracking(input: {
    roll_number: string;
    amount: number;
    status: string;
    paid_month?: string | null;
    paid_date: string | null;
    payment_mode: string | null;
    payment_kind?: string | null;
  }): Promise<void> {
    const payload = {
      ...input,
      status: normalizePaymentTrackingStatus(input.status),
      paid_month:
        input.paid_month ??
        (input.paid_date ? `${String(input.paid_date).slice(0, 7)}-01` : null),
    };
    await manualUpsertPaymentTrackingByMonthKind({
      roll_number: String(payload.roll_number),
      amount: Number(payload.amount ?? 0),
      status: String(payload.status ?? "success"),
      paid_month: payload.paid_month ? String(payload.paid_month) : null,
      paid_date: payload.paid_date ? String(payload.paid_date) : null,
      payment_mode: payload.payment_mode ? String(payload.payment_mode) : null,
      payment_kind: payload.payment_kind ? String(payload.payment_kind) : null,
    });
  },

  async upsertMockTestPayment(input: {
    user_id: string;
    mock_test_id: string;
    amount: number;
  }): Promise<void> {
    const payload = {
      user_id: input.user_id,
      mock_test_id: input.mock_test_id,
      amount: Math.max(0, Number(input.amount || 0)),
      status: "success",
      paid_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("mock_test_payments")
      .upsert(payload, { onConflict: "user_id,mock_test_id" });

    if (error && isOnConflictConstraintError(error.message)) {
      const existing = await supabase
        .from("mock_test_payments")
        .select("id")
        .eq("user_id", payload.user_id)
        .eq("mock_test_id", payload.mock_test_id)
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing.error) {
        throw new Error(existing.error.message || "Unable to save mock test payment");
      }
      if (existing.data?.id) {
        const updated = await supabase
          .from("mock_test_payments")
          .update(payload)
          .eq("id", existing.data.id);
        if (updated.error) {
          throw new Error(updated.error.message || "Unable to save mock test payment");
        }
        return;
      }
      const inserted = await supabase.from("mock_test_payments").insert(payload);
      if (inserted.error) {
        throw new Error(inserted.error.message || "Unable to save mock test payment");
      }
      return;
    }

    if (error) {
      throw new Error(error.message || "Unable to save mock test payment");
    }
  },

  async getTeacherMonthlyIncomeSummary(date?: Date): Promise<TeacherIncomeSummary> {
    const monthKey = normalizeMonthKey(date);
    const monthDate = `${monthKey}-01`;
    const nextMonthDate = getNextMonthDateKey(monthKey);
    const trackingSelect =
      "id, roll_number, amount, status, paid_month, paid_date, payment_kind, payment_mode, created_at";
    const trackingByMonthPromise = supabase
      .from("payment_tracking")
      .select(trackingSelect)
      .eq("paid_month", monthDate);

    const trackingByDatePromise = supabase
      .from("payment_tracking")
      .select(trackingSelect)
      .gte("paid_date", monthDate)
      .lt("paid_date", nextMonthDate);

    const trackingByCreatedPromise = supabase
      .from("payment_tracking")
      .select(trackingSelect)
      .gte("created_at", `${monthKey}-01T00:00:00.000Z`)
      .lt("created_at", `${nextMonthDate}T00:00:00.000Z`);

    const [
      studentsRes,
      profilesRes,
      feeRes,
      trackingByMonthRes,
      trackingByDateRes,
      trackingByCreatedRes,
      paymentsRes,
    ] = await Promise.all([
      supabase
        .from("students")
        .select("user_id, roll_number, class_id, student_type"),
      supabase
        .from("profiles")
        .select("id, class, student_type, roll_number, role")
        .eq("role", "student"),
      supabase
        .from("class_fee_configs")
        .select("class_id, monthly_fee"),
      trackingByMonthPromise,
      trackingByDatePromise,
      trackingByCreatedPromise,
      supabase
        .from("payments")
        .select("user_id, amount, status, created_at, flow")
        .gte("created_at", `${monthKey}-01T00:00:00.000Z`)
        .lt(`${nextMonthDate}T00:00:00.000Z`),
    ]);

    const students = studentsRes.data ?? [];
    const profileStudents = profilesRes.data ?? [];
    const feeConfigs = feeRes.data ?? [];
    const trackingMap = new Map<string, any>();
    for (const row of [
      ...(trackingByMonthRes.data ?? []),
      ...(trackingByDateRes.data ?? []),
      ...(trackingByCreatedRes.data ?? []),
    ]) {
      const key = String(
        row.id ??
          `${row.roll_number || ""}_${row.paid_month || ""}_${row.paid_date || ""}_${row.status || ""}_${row.amount || 0}`
      );
      if (!trackingMap.has(key)) {
        trackingMap.set(key, row);
      }
    }
    const tracking = Array.from(trackingMap.values());
    const payments = paymentsRes.data ?? [];

    const feeByClass = new Map(
      feeConfigs.map((row: any) => [
        String(row.class_id),
        toAmount(row.monthly_fee ?? 0),
      ])
    );

    let onlineExpected = 0;
    let offlineExpected = 0;
    const onlineUserIds = new Set<string>();
    const studentByRoll = new Map<
      string,
      {
        class_id: string | null;
        student_type: string;
      }
    >();

    const seenKeys = new Set<string>();
    const addStudent = (row: any, fromProfile = false) => {
      const uid = row.user_id ? String(row.user_id) : fromProfile ? String(row.id ?? "") : "";
      const roll = row.roll_number ? String(row.roll_number) : "";
      const classId = row.class_id
        ? String(row.class_id)
        : row.class
          ? String(row.class)
          : null;
      const studentType = String(row.student_type ?? "online");
      const key = uid || roll;
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);

      if (roll) {
        studentByRoll.set(roll, {
          class_id: classId,
          student_type: studentType,
        });
      }

      if (studentType === "online") {
        if (uid) onlineUserIds.add(uid);
        return;
      }

      const fee = classId ? feeByClass.get(classId) : null;
      const monthly = fee ?? 0;
      offlineExpected += monthly;
    };

    for (const row of students as any[]) {
      addStudent(row, false);
    }
    for (const row of profileStudents as any[]) {
      addStudent(row, true);
    }

    const onlineMonthlyFee = Number(process.env.EXPO_PUBLIC_ONLINE_MONTHLY_FEE ?? 1000);
    onlineExpected = onlineUserIds.size * Math.max(0, onlineMonthlyFee || 0);

    const isMonthlyTracking = (kind: string, row: any, mode: string) =>
      Boolean(kind && kind.includes("monthly")) ||
      (!kind && Boolean(row?.paid_month) && (mode === "offline" || mode === "online"));

    let offlineCovered = 0;
    for (const row of tracking as any[]) {
      const roll = String(row.roll_number ?? "");
      const student = studentByRoll.get(roll);
      const kind = String(row.payment_kind ?? "").toLowerCase();
      const mode = String(row.payment_mode ?? "").toLowerCase();
      const isOfflineTracking =
        kind === "offline_monthly" ||
        (isMonthlyTracking(kind, row, mode) && (mode === "offline" || student?.student_type === "offline"));
      if (!isOfflineTracking && student?.student_type !== "offline") continue;

      const rawAmount = toAmount(row.amount);
      if (rawAmount > 0) {
        offlineCovered += rawAmount;
        continue;
      }

      const fee = student?.class_id ? feeByClass.get(String(student.class_id)) : null;
      const monthly = fee ?? 0;
      const status = String(row.status ?? "").toUpperCase();
      if (status === "PAID") {
        offlineCovered += monthly;
      }
    }

    let onlineCovered = 0;
    for (const row of tracking as any[]) {
      const kind = String(row.payment_kind ?? "").toLowerCase();
      const mode = String(row.payment_mode ?? "").toLowerCase();
      const isOnlineTracking =
        kind === "online_monthly" ||
        (isMonthlyTracking(kind, row, mode) && mode === "online");
      if (!isOnlineTracking) continue;
      if (!isSuccessStatus(row.status)) continue;
      onlineCovered += toAmount(row.amount);
    }

    const expected = Math.round((onlineExpected + offlineExpected) * 100) / 100;
    const covered = Math.round((onlineCovered + offlineCovered) * 100) / 100;

    return {
      monthKey,
      online: {
        expected: Math.round(onlineExpected * 100) / 100,
        covered: Math.round(onlineCovered * 100) / 100,
      },
      offline: {
        expected: Math.round(offlineExpected * 100) / 100,
        covered: Math.round(offlineCovered * 100) / 100,
      },
      total: {
        expected,
        covered,
      },
    };
  },
};
