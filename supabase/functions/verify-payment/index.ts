import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RAZORPAY_KEY_SECRET =
  Deno.env.get("RAZORPAY_KEY_SECRET") ??
  Deno.env.get("RAZERPAY_KEY_SECRET") ??
  Deno.env.get("EXPO_PUBLIC_RAZORPAY_KEY_SECRET") ??
  Deno.env.get("RAZORPAY_SECRET") ??
  Deno.env.get("RAZORPAY_API_SECRET") ??
  "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
const hasMissingColumnError = (message: string) => {
  const msg = String(message ?? "").toLowerCase();
  return (
    msg.includes("column") &&
    (msg.includes("does not exist") || msg.includes("schema cache"))
  );
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json(500, { error: "Supabase env not configured" });
  }
  if (!RAZORPAY_KEY_SECRET) {
    return json(500, {
      error: "Razorpay env not configured. Set secret: RAZORPAY_KEY_SECRET.",
      has_key_secret: Boolean(RAZORPAY_KEY_SECRET),
    });
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
  const paymentId = String(body.payment_id ?? "").trim();
  const razorpayOrderId = String(body.razorpay_order_id ?? "").trim();
  const razorpayPaymentId = String(body.razorpay_payment_id ?? "").trim();
  const razorpaySignature = String(body.razorpay_signature ?? "").trim();

  if (!paymentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return json(400, { error: "Missing payment details" });
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .select("id, user_id, provider_order_id, status")
    .eq("id", paymentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !payment) {
    return json(404, { error: "Payment not found" });
  }

  if (payment.provider_order_id && payment.provider_order_id !== razorpayOrderId) {
    return json(400, { error: "Order mismatch" });
  }

  const message = `${razorpayOrderId}|${razorpayPaymentId}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(RAZORPAY_KEY_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  const expected = toHex(signature);

  if (expected !== razorpaySignature) {
    return json(400, { error: "Signature mismatch" });
  }

  let { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "success",
      provider_payment_id: razorpayPaymentId,
      provider_order_id: razorpayOrderId,
    })
    .eq("id", paymentId);

  if (updateError && hasMissingColumnError(String(updateError.message ?? ""))) {
    const fallback = await supabase
      .from("payments")
      .update({ status: "success" })
      .eq("id", paymentId);
    updateError = fallback.error;
  }

  if (updateError) {
    return json(500, { error: updateError.message || "Unable to update payment" });
  }

  return json(200, { success: true });
});
