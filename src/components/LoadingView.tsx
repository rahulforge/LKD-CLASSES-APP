import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  text?: string;
  variant?: "spinner" | "skeleton" | "setup";
};

export default function LoadingView({
  text = "Loading your data...",
  variant = "spinner",
}: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (variant === "skeleton" || variant === "setup") {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(shimmer, {
              toValue: 1,
              duration: 650,
              useNativeDriver: true,
            }),
            Animated.timing(pulse, {
              toValue: 1.06,
              duration: 650,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(shimmer, {
              toValue: 0,
              duration: 650,
              useNativeDriver: true,
            }),
            Animated.timing(pulse, {
              toValue: 0.9,
              duration: 650,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
      return;
    }

    Animated.parallel([
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      ),
      Animated.timing(fade, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, pulse, shimmer, spin, variant]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (variant === "skeleton") {
    const skeletonOpacity = shimmer.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 0.8],
    });

    return (
      <View style={styles.container}>
        <Animated.View style={[styles.skelTitle, { opacity: skeletonOpacity }]} />
        <Animated.View style={[styles.skelCard, { opacity: skeletonOpacity }]} />
        <Animated.View style={[styles.skelCard, { opacity: skeletonOpacity }]} />
        <Animated.View style={[styles.skelCardSmall, { opacity: skeletonOpacity }]} />
        <Text style={styles.text}>{text}</Text>
      </View>
    );
  }

  if (variant === "setup") {
    const setupOpacity = shimmer.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 0.95],
    });

    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.setupIconWrap,
            { opacity: setupOpacity, transform: [{ scale: pulse }] },
          ]}
        >
          <Ionicons name="construct" size={36} color="#38BDF8" />
        </Animated.View>
        <Text style={styles.setupTitle}>Setting up your dashboard</Text>
        <Text style={styles.setupSub}>Please wait while we fetch and cache your data.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          transform: [{ rotate }],
          opacity: fade,
        }}
      >
        <Ionicons name="sync-circle" size={46} color="#38BDF8" />
      </Animated.View>

      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    marginTop: 12,
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  skelTitle: {
    width: "62%",
    height: 26,
    borderRadius: 10,
    backgroundColor: "#1E293B",
    marginBottom: 14,
  },
  skelCard: {
    width: "88%",
    height: 76,
    borderRadius: 16,
    backgroundColor: "#1E293B",
    marginBottom: 10,
  },
  skelCardSmall: {
    width: "88%",
    height: 56,
    borderRadius: 16,
    backgroundColor: "#1E293B",
  },
  setupIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  setupTitle: {
    marginTop: 14,
    fontSize: 17,
    color: "#E2E8F0",
    fontWeight: "800",
  },
  setupSub: {
    marginTop: 6,
    fontSize: 12,
    color: "#94A3B8",
  },
});
