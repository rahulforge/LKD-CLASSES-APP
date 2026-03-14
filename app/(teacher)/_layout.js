import { Tabs, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useMemo, useState } from "react";
import { TeacherQuickActionsSheet } from "../../src/components/TeacherQuickActionsSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TeacherLayout() {
  const insets = useSafeAreaInsets();
  const [quickOpen, setQuickOpen] = useState(false);
  const segments = useSegments();
  const shouldHideTabBar = useMemo(() => {
    const path = segments.join("/");
    return path.includes("classes/player") || path.includes("viewer");
  }, [segments]);

  return (
    <View style={{ flex: 1 }}>
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
                height: 58 + insets.bottom,
                paddingBottom: Math.max(insets.bottom, 8),
                paddingTop: 6,
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
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => (
              <Ionicons name="grid" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="students"
          options={{
            title: "Students",
            tabBarIcon: ({ color }) => (
              <Ionicons name="people" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="quick-actions"
          options={{
            title: "",
            tabBarLabel: "",
            tabBarIcon: ({ color }) => (
              <Ionicons name="add-circle" size={34} color={color} />
            ),
            tabBarActiveTintColor: "#38BDF8",
            tabBarInactiveTintColor: "#38BDF8",
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setQuickOpen(true);
            },
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
          name="profile"
          options={{
            title: "Account",
            tabBarIcon: ({ color }) => (
              <Ionicons name="person" size={22} color={color} />
            ),
          }}
        />

        <Tabs.Screen name="notices" options={{ href: null }} />
        <Tabs.Screen name="fees" options={{ href: null }} />
        <Tabs.Screen name="materials" options={{ href: null }} />
        <Tabs.Screen name="upload-lecture" options={{ href: null }} />
        <Tabs.Screen name="upload-material" options={{ href: null }} />
        <Tabs.Screen name="create-offer" options={{ href: null }} />
        <Tabs.Screen name="upload-gallery" options={{ href: null }} />
        <Tabs.Screen name="upload-topper" options={{ href: null }} />
        <Tabs.Screen name="upload-result" options={{ href: null }} />
        <Tabs.Screen name="go-live" options={{ href: null }} />
        <Tabs.Screen name="profile-config" options={{ href: null }} />
        <Tabs.Screen name="viewer" options={{ href: null }} />
        <Tabs.Screen name="classes/player" options={{ href: null }} />
        <Tabs.Screen name="create-mock-test" options={{ href: null }} />
        <Tabs.Screen name="add-task" options={{ href: null }} />
      </Tabs>
      <TeacherQuickActionsSheet open={quickOpen} onClose={() => setQuickOpen(false)} />
    </View>
  );
}
