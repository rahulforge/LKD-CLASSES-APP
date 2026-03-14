import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAZORPAY_KEY_ID =
  Deno.env.get("RAZORPAY_KEY_ID") ??
  Deno.env.get("RAZERPAY_KEY_ID") ??
  Deno.env.get("EXPO_PUBLIC_RAZORPAY_KEY_ID") ??
  Deno.env.get("RAZORPAY_KEY") ??
  Deno.env.get("RAZORPAY_API_KEY") ??
  "";
const RAZORPAY_KEY_SECRET =
  Deno.env.get("RAZORPAY_KEY_SECRET") ??
  Deno.env.get("RAZERPAY_KEY_SECRET") ??
  Deno.env.get("EXPO_PUBLIC_RAZORPAY_KEY_SECRET") ??
  Deno.env.get("RAZORPAY_SECRET") ??
  Deno.env.get("RAZORPAY_API_SECRET") ??
  "";
const DEV_TEST_PAYMENTS =
  (Deno.env.get("DEV_TEST_PAYMENTS") ?? Deno.env.get("ALLOW_DEV_TEST_PAYMENTS") ?? "")
    .toLowerCase() === "true";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const toMoney = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const clampPercent = (value: unknown) =>
  Math.max(0, Math.min(100, Math.round(Number(value ?? 0) || 0)));
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
const normalizeClassKey = (value: string) =>
  String(value ?? "").toLowerCase().replace(/\s+/g, "");
const hasMissingColumnError = (message: string) => {
  const msg = String(message ?? "").toLowerCase();
  return (
    msg.includes("column") &&
    (msg.includes("does not exist") || msg.includes("schema cache"))
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json(500, { error: "Supabase env not configured" });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json(401, { error: "Unauthorized" });
  }

  const body = await req.json().catch(() => ({}));
  const flow = String(body.flow ?? "").trim().toLowerCase();
  const classValue = String(body.class_value ?? "").trim();
  const months = Array.isArray(body.months) ? body.months.filter(Boolean) : [];
  const mockTestId = String(body.mock_test_id ?? "").trim();
  const planCode = String(body.plan_code ?? "").trim().toLowerCase();
  const promoCode = String(body.promo_code ?? "").trim().toUpperCase();
  const devTest = DEV_TEST_PAYMENTS && (body.dev_test === true || String(body.dev_test ?? "") === "true");
  const paymentMeta = {
    flow,
    class_value: classValue || null,
    months,
    mock_test_id: mockTestId || null,
    plan_code: planCode || null,
  };

  const createPaymentRow = async (input: {
    amount: number;
    status: "pending" | "success";
    provider: "razorpay" | "promo";
    promoCode: string | null;
  }) => {
    const basePayload = {
      user_id: user.id,
      amount: input.amount,
      status: input.status,
    };
    const richPayload = {
      ...basePayload,
      provider: input.provider,
      promo_code: input.promoCode,
      flow,
      metadata: paymentMeta,
    };

    let inserted = await supabase
      .from("payments")
      .insert(richPayload)
      .select("id")
      .single();

    if (
      inserted.error &&
      hasMissingColumnError(String(inserted.error.message ?? ""))
    ) {
      inserted = await supabase
        .from("payments")
        .insert(basePayload)
        .select("id")
        .single();
    }

    return inserted;
  };

  let expected = 0;
  if (flow === "app_access") {
    const { data } = await supabase
      .from("app_runtime_config")
      .select("app_access_fee")
      .eq("id", 1)
      .maybeSingle();
    expected = toMoney(data?.app_access_fee ?? 50);
  } else if (flow === "monthly_fee" || flow === "test_fee") {
    if (!classValue) return json(400, { error: "Missing class" });
    let classIds: string[] = [];
    const { data: classRows } = await supabase
      .from("classes")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(300);
    if (classRows?.length) {
      if (isUuid(classValue)) {
        const own = (classRows as any[]).find((row) => String(row.id) === classValue);
        const key = own ? normalizeClassKey(String(own.name ?? "")) : "";
        classIds = key
          ? (classRows as any[])
              .filter((row) => normalizeClassKey(String(row.name ?? "")) === key)
              .map((row) => String(row.id))
          : [classValue];
      } else {
        const target = normalizeClassKey(classValue);
        classIds = (classRows as any[])
          .filter((row) => {
            const key = normalizeClassKey(String(row.name ?? ""));
            return key === target || key.endsWith(target) || target.endsWith(key);
          })
          .map((row) => String(row.id));
      }
    }
    if (!classIds.length && isUuid(classValue)) classIds = [classValue];
    classIds = Array.from(new Set(classIds.filter((id) => isUuid(String(id ?? "")))));

    if (!classIds.length) {
      const profileClassRes = await supabase
        .from("profiles")
        .select("class")
        .eq("id", user.id)
        .maybeSingle();
      const profileClass = String(profileClassRes.data?.class ?? "").trim();
      if (isUuid(profileClass)) {
        classIds = [profileClass];
      } else if (profileClass && classRows?.length) {
        const target = normalizeClassKey(profileClass);
        classIds = Array.from(
          new Set(
            (classRows as any[])
              .filter((row) => normalizeClassKey(String(row.name ?? "")) === target)
              .map((row) => String(row.id))
              .filter((id) => isUuid(id))
          )
        );
      }
    }

    if (!classIds.length) {
      return json(400, { error: "Class mapping not found for fee calculation" });
    }

    let feeData: any = null;
    let feeError: any = null;
    const feeTry = await supabase
      .from("class_fee_configs")
      .select("monthly_fee, test_fee")
      .in("class_id", classIds)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    feeData = feeTry.data;
    feeError = feeTry.error;
    if (feeError) {
      const msg = String(feeError.message ?? "").toLowerCase();
      if (msg.includes("test_fee") && msg.includes("column")) {
        const fallback = await supabase
          .from("class_fee_configs")
          .select("monthly_fee")
          .in("class_id", classIds)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        feeData = fallback.data;
        feeError = fallback.error;
      }
    }
    if (feeError) {
      return json(500, { error: feeError.message || "Unable to read class fee config" });
    }
    if (!feeData) {
      return json(400, { error: "Fee config missing for selected class" });
    }

    if (flow === "test_fee") {
      expected = toMoney(feeData?.test_fee ?? feeData?.monthly_fee ?? 0);
    } else {
      expected = toMoney(feeData?.monthly_fee ?? 0);
    }
    if (flow === "monthly_fee") {
      const count = Math.max(1, months.length || 1);
      expected = toMoney(expected * count);
    }
  } else if (flow === "subscription") {
    if (!planCode) return json(400, { error: "Missing plan code" });
    const { data } = await supabase
      .from("subscription_plans")
      .select("amount")
      .ilike("code", planCode)
      .maybeSingle();
    expected = toMoney(data?.amount ?? 0);
  } else if (flow === "mock_test") {
    if (!mockTestId) return json(400, { error: "Missing test id" });
    const { data } = await supabase
      .from("mock_tests")
      .select("price, is_free")
      .eq("id", mockTestId)
      .maybeSingle();
    if (data?.is_free) expected = 0;
    else expected = toMoney(data?.price ?? 0);
  } else {
    return json(400, { error: "Invalid flow" });
  }

  let finalAmount = expected;
  let appliedPromo: string | null = null;

  if (flow !== "app_access" && promoCode) {
    const { data } = await supabase
      .from("promo_codes")
      .select("discount_percent, is_active")
      .eq("code", promoCode)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.is_active) {
      const discount = clampPercent(data.discount_percent);
      finalAmount = toMoney(expected - expected * (discount / 100));
      appliedPromo = promoCode;
    }
  }

  // Razorpay rejects very small amounts (< Rs.1). Treat near-zero as fully discounted.
  if (finalAmount > 0 && finalAmount < 1) {
    finalAmount = 0;
  }

  if (finalAmount <= 0) {
    const { data, error } = await createPaymentRow({
      amount: 0,
      status: "success",
      provider: "promo",
      promoCode: appliedPromo,
    });
    if (error || !data?.id) {
      return json(500, { error: error?.message || "Unable to save payment" });
    }
    return json(200, {
      payment_id: data.id,
      amount: 0,
      currency: "INR",
      skip_checkout: true,
    });
  }

  if (devTest) {
    const { data, error } = await createPaymentRow({
      amount: finalAmount,
      status: "success",
      provider: "promo",
      promoCode: appliedPromo,
    });
    if (error || !data?.id) {
      return json(500, { error: error?.message || "Unable to save payment" });
    }
    return json(200, {
      payment_id: data.id,
      amount: finalAmount,
      currency: "INR",
      skip_checkout: true,
    });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return json(500, {
      error:
        "Razorpay env not configured. Set secrets: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      has_key_id: Boolean(RAZORPAY_KEY_ID),
      has_key_secret: Boolean(RAZORPAY_KEY_SECRET),
    });
  }

  const paymentInsert = await createPaymentRow({
    amount: finalAmount,
    status: "pending",
    provider: "razorpay",
    promoCode: appliedPromo,
  });

  if (paymentInsert.error || !paymentInsert.data?.id) {
    return json(500, { error: paymentInsert.error?.message || "Unable to create payment" });
  }

  const paymentId = paymentInsert.data.id as string;
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.max(0, Math.round(finalAmount * 100)),
      currency: "INR",
      receipt: paymentId,
      notes: {
        flow,
        user_id: user.id,
      },
    }),
  });

  if (!orderRes.ok) {
    const orderErrorBody = await orderRes.text().catch(() => "");
    await supabase.from("payments").update({ status: "failed" }).eq("id", paymentId);
    return json(500, {
      error: orderErrorBody || `Unable to create Razorpay order (${orderRes.status})`,
    });
  }

  const orderData = await orderRes.json();
  const orderId = String(orderData?.id ?? "");
  if (!orderId) {
    await supabase.from("payments").update({ status: "failed" }).eq("id", paymentId);
    return json(500, { error: "Invalid Razorpay order" });
  }

  const updateOrder = await supabase
    .from("payments")
    .update({ provider_order_id: orderId })
    .eq("id", paymentId);
  if (updateOrder.error && !hasMissingColumnError(String(updateOrder.error.message ?? ""))) {
    return json(500, { error: updateOrder.error.message || "Unable to update payment order id" });
  }

  return json(200, {
    payment_id: paymentId,
    order_id: orderId,
    amount: finalAmount,
    currency: "INR",
    skip_checkout: false,
  });
});
