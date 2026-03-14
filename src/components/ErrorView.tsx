import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  message?: string;
  onRetry?: () => void;
};

export default function ErrorView({
  message = "Server unreachable. Please try again.",
  onRetry,
}: Props) {
  return (
    <View style={styles.container}>
      <Ionicons
        name="cloud-offline"
        size={42}
        color="#EF4444"
      />

      <Text style={styles.title}>Something went wrong</Text>

      <Text style={styles.message}>{message}</Text>

      {onRetry && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onRetry}
          activeOpacity={0.85}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#0B1220",
  },

  title: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#E5E7EB",
  },

  message: {
    marginTop: 6,
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
  },

  retryBtn: {
    marginTop: 16,
    backgroundColor: "#38BDF8",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },

  retryText: {
    color: "#020617",
    fontWeight: "700",
    fontSize: 14,
  },
});