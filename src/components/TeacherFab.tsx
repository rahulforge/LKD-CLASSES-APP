import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { APP_THEME } from "../utils/constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FabAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const ACTIONS: FabAction[] = [
  { label: "Upload Lecture", icon: "play-circle", route: "/(teacher)/upload-lecture" },
  { label: "Upload Material", icon: "document-text", route: "/(teacher)/upload-material" },
  { label: "Add Notice", icon: "notifications", route: "/(teacher)/notices" },
  { label: "Create Offer", icon: "pricetag", route: "/(teacher)/create-offer" },
  { label: "Upload Gallery Photo", icon: "images", route: "/(teacher)/upload-gallery" },
  { label: "Upload Topper", icon: "trophy", route: "/(teacher)/upload-topper" },
  { label: "Upload Result", icon: "ribbon", route: "/(teacher)/upload-result" },
  { label: "Go Live", icon: "radio", route: "/(teacher)/go-live" },
  { label: "Add Tomorrow Plan", icon: "calendar", route: "/(teacher)/add-task" },
];

const hiddenSegments = ["notice-edit"];

export function TeacherFab() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const hidden = useMemo(
    () => hiddenSegments.some((segment) => pathname.includes(segment)),
    [pathname]
  );

  if (hidden) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.fab, { bottom: 72 + insets.bottom }]}
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="add" size={28} color={APP_THEME.bg} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { paddingBottom: Math.max(24, insets.bottom + 12), paddingTop: Math.max(10, insets.top * 0.35) },
            ]}
            onPress={() => undefined}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>Quick Actions</Text>
            <ScrollView
              style={styles.actionsWrap}
              contentContainerStyle={styles.actionsContent}
              showsVerticalScrollIndicator={false}
            >
              {ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={styles.row}
                  onPress={() => {
                    setOpen(false);
                    router.push(action.route as any);
                  }}
                >
                  <Ionicons name={action.icon} size={20} color={APP_THEME.primary} />
                  <Text style={styles.label}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: APP_THEME.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2,6,23,0.6)",
  },
  sheet: {
    backgroundColor: APP_THEME.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    maxHeight: "80%",
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: APP_THEME.border,
    marginBottom: 12,
  },
  title: {
    color: APP_THEME.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_THEME.border,
  },
  actionsWrap: {
    maxHeight: 360,
  },
  actionsContent: {
    paddingBottom: 8,
  },
  label: {
    color: APP_THEME.text,
    fontSize: 14,
    fontWeight: "600",
  },
});
