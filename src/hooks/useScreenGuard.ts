import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";
import { toastService } from "../services/toastService";

export default function useScreenGuard(options?: {
  enabled?: boolean;
}) {
  const [appHidden, setAppHidden] = useState(false);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === "web") return;

    void ScreenCapture.preventScreenCaptureAsync().catch(() => {
      // ignore platform-specific failures
    });

    const captureListener =
      ScreenCapture.addScreenshotListener(() => {
        toastService.error(
          "Restricted",
          "Screenshots are not allowed for this content"
        );
      });

    const appStateSub = AppState.addEventListener(
      "change",
      (state) => {
        setAppHidden(state !== "active");
      }
    );

    return () => {
      void ScreenCapture.allowScreenCaptureAsync().catch(() => {
        // ignore platform-specific failures
      });
      captureListener.remove();
      appStateSub.remove();
    };
  }, [enabled]);

  return {
    appHidden,
    allowed: true,
    loading: false,
  };
}
