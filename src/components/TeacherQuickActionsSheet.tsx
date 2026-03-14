import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_THEME } from "../utils/constants";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ACTIONS: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
  { label: "Upload Lecture", icon: "play-circle", route: "/(teacher)/upload-lecture" },
  { label: "Upload Material", icon: "document-text", route: "/(teacher)/upload-material" },
  { label: "Add Notice", icon: "notifications", route: "/(teacher)/notices" },
  { label: "Create Offer", icon: "pricetag", route: "/(teacher)/create-offer" },
  { label: "Upload Gallery Photo", icon: "images", route: "/(teacher)/upload-gallery" },
  { label: "Upload Topper", icon: "trophy", route: "/(teacher)/upload-topper" },
  { label: "Upload Result", icon: "ribbon", route: "/(teacher)/upload-result" },
  { label: "Live / Schedule Class", icon: "radio", route: "/(teacher)/go-live" },
  { label: "Create Mock Test", icon: "clipboard", route: "/(teacher)/create-mock-test" },
  { label: "Manage Mock Tests", icon: "list", route: "/(teacher)/mock-tests" },
  { label: "Add Tomorrow Plan", icon: "calendar", route: "/(teacher)/add-task" },
];

export function TeacherQuickActionsSheet({ open, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(24, insets.bottom + 12),
              paddingTop: Math.max(10, insets.top * 0.35),
            },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Quick Actions</Text>
          <View style={styles.grid}>
            {ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.tile}
                onPress={() => {
                  onClose();
                  router.push(action.route as any);
                }}
              >
                <Ionicons name={action.icon} size={19} color={APP_THEME.primary} />
                <Text style={styles.label}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tile: {
    width: "48%",
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  label: {
    color: APP_THEME.text,
    fontSize: 12,
    fontWeight: "600",
  },
});
