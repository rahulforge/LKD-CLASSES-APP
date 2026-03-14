import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import useAppConfig from "../hooks/useAppConfig";
import { openSupportContact } from "../utils/support";

type Props = {
  status: "free" | "expired";
};

export default function SubscriptionBanner({ status }: Props) {
  const router = useRouter();
  const { config } = useAppConfig();
  const heading = config?.lock_title || "Verification Pending";
  const text =
    config?.lock_message ||
    (status === "free"
      ? "Your access is currently limited."
      : "Your subscription has expired.");

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle" size={18} color="#FACC15" />

      <Text style={styles.text}>
        {heading} - {text}
      </Text>

      <TouchableOpacity onPress={() => router.push("/(student)/subscription")}>
        <Text style={styles.link}>View Plans</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          void openSupportContact({
            phone: config?.support_phone,
            text: config?.support_whatsapp_text,
          })
        }
      >
        <Text style={styles.link}>Contact Staff</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 14,
    gap: 10,
  },

  text: {
    flex: 1,
    marginLeft: 2,
    fontSize: 12,
    color: "#E5E7EB",
  },

  link: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38BDF8",
  },
});
