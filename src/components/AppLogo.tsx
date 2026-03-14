import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

type Props = {
  size?: number;
  showTitle?: boolean;
};

export default function AppLogo({
  size = 72,
  showTitle = false,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.logoShell,
          { width: size, height: size, borderRadius: Math.round(size * 0.28) },
        ]}
      >
        <Image
          source={require("../../assets/images/logo.png")}
          style={{
            width: Math.round(size * 0.82),
            height: Math.round(size * 0.82),
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>
      {showTitle ? <Text style={styles.title}>LKD Classes</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  logoShell: {
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  title: {
    marginTop: 8,
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 16,
  },
});
