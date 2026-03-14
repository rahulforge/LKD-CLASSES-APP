import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_THEME } from "../utils/constants";
import { toastService, type ToastKind } from "../services/toastService";

type ToastState = {
  kind: ToastKind;
  title: string;
  message: string;
  durationMs: number;
};

const iconMap: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "close-circle",
  info: "information-circle",
  warning: "warning",
};

const colorMap: Record<ToastKind, string> = {
  success: APP_THEME.success,
  error: APP_THEME.danger,
  info: APP_THEME.primary,
  warning: APP_THEME.warning,
};

export default function AppToastHost() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unregister = toastService.register((payload) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      setToast(payload);
    });
    return () => {
      unregister();
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    translateY.setValue(16);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 10,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => setToast(null));
    }, toast.durationMs);
  }, [opacity, toast, translateY]);

  if (!toast) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.wrap,
          {
            bottom: 72 + Math.max(insets.bottom, 8),
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.box, { borderColor: colorMap[toast.kind] }]}>
          <Ionicons name={iconMap[toast.kind]} size={18} color={colorMap[toast.kind]} />
          <View style={styles.textWrap}>
            <Text style={styles.title}>{toast.title}</Text>
            {!!toast.message && <Text style={styles.message}>{toast.message}</Text>}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    alignItems: "center",
  },
  box: {
    width: "100%",
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: APP_THEME.text,
    fontSize: 13,
    fontWeight: "800",
  },
  message: {
    color: APP_THEME.muted,
    fontSize: 12,
    marginTop: 1,
  },
});
