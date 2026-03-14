import RazorpayCheckout from "react-native-razorpay";

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  orderId: string;
  prefill?: {
    name?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
};

export const razorpayService = {
  async openCheckout(options: RazorpayCheckoutOptions): Promise<{
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }> {
    if (!RazorpayCheckout || typeof (RazorpayCheckout as any).open !== "function") {
      throw new Error(
        "Razorpay module not loaded. Use a development/production build (not Expo Go), then reinstall the app."
      );
    }

    const response = await RazorpayCheckout.open({
      key: options.key,
      amount: Math.max(0, Math.round(options.amount * 100)),
      currency: options.currency || "INR",
      name: options.name || "LKD Classes",
      description: options.description || "Payment",
      order_id: options.orderId,
      prefill: options.prefill || {},
      notes: options.notes || {},
      theme: { color: "#38BDF8" },
    });

    return response as {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    };
  },
};
