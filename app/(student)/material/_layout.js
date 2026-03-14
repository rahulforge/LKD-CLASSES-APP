import { Stack } from "expo-router";
import { View } from "react-native";

export default function MaterialLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <Stack
        screenOptions={{
          headerShown: false,

          // 🔥 MOST IMPORTANT FIXES
          animation: "fade",          // 👈 slide ki jagah fade
          animationDuration: 120,     // 👈 fast transition
          presentation: "card",

          contentStyle: {
            backgroundColor: "#0B1220", // 👈 force dark bg
          },
        }}
      />
    </View>
  );
}
