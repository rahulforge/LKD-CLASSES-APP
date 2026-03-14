import { Stack } from "expo-router";
import { View } from "react-native";

export default function ClassesLayout() {
  return (
       <View style={{ flex: 1, backgroundColor: "#0B1220" }}>
      <Stack
        screenOptions={{
          headerShown: false,

          // 🔥 MOST IMPORTANT FIXES
          animation: "fade",          
          animationDuration: 120,     
          presentation: "card",

          contentStyle: {
            backgroundColor: "#0B1220", 
          },
        }}
      />
    </View>
  );
}
