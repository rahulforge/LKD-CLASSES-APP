import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import useProfile from "../../src/hooks/useProfile";
import { paymentService } from "../../src/services/paymentService";
import { studentService } from "../../src/services/studentService";

const RETRY_LIMIT = 6;
const RETRY_DELAY_MS = 2000;

export default function PaymentReturn() {
  const router = useRouter();
  const { payment_id: paymentId } = useLocalSearchParams();
  const { profile } = useProfile();

  const [loading, setLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [rollNumber, setRollNumber] = useState(null);
  const [message, setMessage] = useState(
    "Verifying your payment..."
  );
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const verify = async () => {
      setLoading(true);
      if (!profile?.id || typeof paymentId !== "string") {
        setLoading(false);
        setMessage("Missing payment details. Please try again.");
        return;
      }

      let success = false;
      for (let attempt = 1; attempt <= RETRY_LIMIT; attempt += 1) {
        success = await paymentService.verifyPaymentAndSync({
          paymentId,
          userId: profile.id,
          studentType: profile.student_type,
        });

        if (success) break;
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS)
        );
      }

      setIsSuccess(success);
      if (success) {
        try {
          const payment = await paymentService.getPaymentRecord(paymentId);
          const flow = String(payment?.flow ?? "").toLowerCase();

          if (flow === "app_access") {
            await studentService.setAppAccessPaidForUser(profile.id, paymentId);
          }

          const roll = await studentService.ensureRollNumberForUser(profile.id);
          setRollNumber(roll);
          Animated.spring(reveal, {
            toValue: 1,
            useNativeDriver: true,
            friction: 7,
          }).start();
        } catch {
          // ignore roll assignment failure and continue success flow
        }
      }
      setMessage(
        success
          ? "Payment verified. Subscription is now active."
          : "Payment is still pending confirmation."
      );
      setLoading(false);
    };

    verify();
  }, [paymentId, profile?.id, profile?.student_type, reveal]);

  const goNext = () => {
    if (isSuccess) {
      router.replace("/(auth)/login");
      return;
    }
    router.replace("/(public)/home");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#38BDF8" />
        ) : (
          <Text style={styles.icon}>{isSuccess ? "OK" : "..."}</Text>
        )}

        <Text style={styles.title}>
          {loading
            ? "Processing payment"
            : isSuccess
            ? "Payment successful"
            : "Payment pending"}
        </Text>
        <Text style={styles.message}>{message}</Text>
        {isSuccess && !!rollNumber && (
          <Animated.View
            style={[
              styles.rollReveal,
              {
                opacity: reveal,
                transform: [
                  {
                    scale: reveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.rollLabel}>Your Roll Number</Text>
            <Text style={styles.rollValue}>{rollNumber}</Text>
          </Animated.View>
        )}

        {!loading && (
          <TouchableOpacity
            style={styles.button}
            onPress={goNext}
          >
            <Text style={styles.buttonText}>
              {isSuccess ? "Go to Login" : "Back to Home"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  icon: {
    color: "#38BDF8",
    fontSize: 28,
    fontWeight: "800",
  },
  title: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "800",
    color: "#E5E7EB",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    color: "#94A3B8",
    textAlign: "center",
  },
  rollReveal: {
    marginTop: 14,
    backgroundColor: "#020617",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  rollLabel: { color: "#94A3B8", fontSize: 11 },
  rollValue: { color: "#38BDF8", fontSize: 24, fontWeight: "800", marginTop: 3 },
  button: {
    marginTop: 20,
    backgroundColor: "#38BDF8",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#020617",
    fontWeight: "700",
  },
});
