import { Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

const CLASSES = ["6", "7", "8", "9", "10", "11", "12"];

export default function Step2School() {
  const router = useRouter();
  const { category } = useLocalSearchParams();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fade }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Select Your Class</Text>

      {CLASSES.map((cls) => (
        <TouchableOpacity
          key={cls}
          style={styles.option}
          onPress={() =>
            router.push({
              pathname: "/(auth)/signup/step3",
              params: { category, class: cls },
            })
          }
        >
          <Text style={styles.optionText}>Class {cls}</Text>
        </TouchableOpacity>
      ))}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    color: "#E5E7EB",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
  },
  option: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  optionText: {
    color: "#38BDF8",
    fontSize: 16,
    fontWeight: "600",
  },
});
