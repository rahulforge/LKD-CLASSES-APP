import { Tabs, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo } from "react";
import useScreenGuard from "../../src/hooks/useScreenGuard";
import { usePushNotifications } from "../../src/hooks/usePushNotifications";
import useStudentWarmup from "../../src/hooks/useStudentWarmup";

export default function StudentLayout() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  useScreenGuard({ enabled: true });
  usePushNotifications();
  useStudentWarmup();

  const shouldHideTabBar = useMemo(() => {
    const path = segments.join("/");
    return (
      path.includes("classes/player") ||
      path.includes("material/pdf") ||
      path.includes("live-player") ||
      path.includes("app-access") ||
      path.includes("checkout") ||
      path.includes("payment-success") ||
      path.includes("monthly-pay") ||
      path.includes("subscription") ||
      path.includes("admit-card") ||
      path.includes("admit-card-view") ||
      path.includes("test-fee") ||
      path.includes("test-fee-view") ||
      path.includes("mock-tests/[id]/attempt")
    );
  }, [segments]);

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        detachInactiveScreens: true,
        lazy: true,
        freezeOnBlur: true,
        tabBarHideOnKeyboard: true,
        tabBarStyle: shouldHideTabBar
          ? { display: "none" }
          : {
              backgroundColor: "#020617",
              borderTopWidth: 0,
              height: 64 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 10),
              paddingTop: 8,
            },
        tabBarActiveTintColor: "#38BDF8",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: {
          fontSize: 11,
          marginBottom: 2,
        },
        sceneContainerStyle: {
          backgroundColor: "#0B1220",
        },
        sceneStyle: {
          backgroundColor: "#0B1220",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color }) => (
            <Ionicons name="play-circle" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="material"
        options={{
          title: "Material",
          tabBarIcon: ({ color }) => (
            <Ionicons name="document-text" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="results"
        options={{
          title: "Results",
          tabBarIcon: ({ color }) => (
            <Ionicons name="trophy" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-circle" size={24} color={color} />
          ),
        }}
      />

      {/* Hidden routes (direct children of (student)) */}
      <Tabs.Screen name="mock-tests/[id]" options={{ href: null }} />
      <Tabs.Screen name="mock-tests/index" options={{ href: null }} />
      <Tabs.Screen name="mock-tests/[id]/attempt" options={{ href: null }} />
      <Tabs.Screen name="mock-tests/[id]/submitted" options={{ href: null }} />
      <Tabs.Screen name="admit-card" options={{ href: null }} />
      <Tabs.Screen name="admit-card-view" options={{ href: null }} />
      <Tabs.Screen name="app-access" options={{ href: null }} />
      <Tabs.Screen name="checkout" options={{ href: null }} />
      <Tabs.Screen name="live-player" options={{ href: null }} />
      <Tabs.Screen name="monthly-pay" options={{ href: null }} />
      <Tabs.Screen name="payment-success" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="test-fee" options={{ href: null }} />
      <Tabs.Screen name="test-fee-view" options={{ href: null }} />

    </Tabs>
  );
}
