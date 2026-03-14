import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PublicLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        detachInactiveScreens: false,
        lazy: false,
        freezeOnBlur: false,
        tabBarStyle: {
          backgroundColor: "#020617",
          borderTopWidth: 0,
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        sceneContainerStyle: {
          backgroundColor: "#0B1220",
        },
        tabBarActiveTintColor: "#38BDF8",
        tabBarLabelStyle: {
          fontSize: 11,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="toppers"
        options={{
          tabBarLabel: "Toppers",
          tabBarIcon: ({ color }) => (
            <Ionicons name="trophy" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="gallery"
        options={{
          tabBarLabel: "Gallery",
          title: "Gallery",
          tabBarIcon: ({ color }) => (
            <Ionicons name="images" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen name="payment-return" options={{ href: null }} />

      <Tabs.Screen
        name="login"
        options={{
          tabBarLabel: "Login",
          tabBarIcon: () => (
            <Ionicons name="person-circle" size={30} color="#38BDF8" />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/(auth)/login");
          },
        }}
      />
    </Tabs>
  );
}
