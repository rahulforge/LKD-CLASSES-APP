import { useMemo } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function PaymentSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const amount = useMemo(() => Number(params.amount || 0), [params.amount]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={34} color="#0B1220" />
        </View>
        <Text style={styles.title}>Payment Successful</Text>
        <Text style={styles.subtitle}>
          {amount > 0 ? `Paid Rs.${amount}` : "Payment verified successfully."}
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/(student)/home")}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#38BDF8",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 14,
    color: "#E5E7EB",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    color: "#94A3B8",
    fontSize: 13,
  },
  button: {
    marginTop: 18,
    backgroundColor: "#38BDF8",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonText: { color: "#020617", fontWeight: "800" },
});
