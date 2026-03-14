import { Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";

export default function Step1() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fade, transform: [{ translateY: slide }] },
      ]}
    >
      <Text style={styles.title}>What are you preparing for?</Text>
      <Text style={styles.subtitle}>Choose your learning path</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/(auth)/signup/step2-school",
            params: { category: "school" },
          })
        }
      >
        <Text style={styles.cardTitle}>School Classes</Text>
        <Text style={styles.cardSub}>Class 6-12</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/(auth)/signup/step2-competitive",
            params: { category: "competitive" },
          })
        }
      >
        <Text style={styles.cardTitle}>Competitive Exams</Text>
        <Text style={styles.cardSub}>JEE, NEET and government exams</Text>
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
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: "#9CA3AF",
    marginBottom: 28,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    color: "#38BDF8",
    fontSize: 18,
    fontWeight: "700",
  },
  cardSub: {
    color: "#CBD5E1",
    marginTop: 4,
  },
});

