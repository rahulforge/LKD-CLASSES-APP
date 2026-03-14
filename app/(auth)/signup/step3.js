import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

export default function Review() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      <Text style={styles.title}>Review Your Selection</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Category</Text>
        <Text style={styles.value}>{params.category}</Text>

        {params.class && (
          <>
            <Text style={styles.label}>Class</Text>
            <Text style={styles.value}>
              Class {params.class}
            </Text>
          </>
        )}

        {params.competitive_exam && (
          <>
            <Text style={styles.label}>Exam</Text>
            <Text style={styles.value}>
              {params.competitive_exam}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: "/(auth)/signup/account",
            params,
          })
        }
      >
        <Text style={styles.buttonText}>
          Continue to Create Account
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: "#E5E7EB",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 20,
    marginBottom: 30,
  },
  label: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 10,
  },
  value: {
    color: "#38BDF8",
    fontSize: 16,
    fontWeight: "700",
  },
  button: {
    backgroundColor: "#38BDF8",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "700",
  },
});
