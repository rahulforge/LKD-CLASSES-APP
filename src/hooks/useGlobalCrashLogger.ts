import { useEffect } from "react";
import { logCrash } from "../utils/crashLogger";

export default function useGlobalCrashLogger() {
  useEffect(() => {
    const errorUtils = (globalThis as any).ErrorUtils;
    const previousHandler = errorUtils?.getGlobalHandler?.();

    if (!errorUtils?.setGlobalHandler) {
      return;
    }

    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      void logCrash("global_js", error, Boolean(isFatal));
      if (typeof previousHandler === "function") {
        previousHandler(error, isFatal);
      } else {
        console.error("Unhandled global error", error);
      }
    });

    return () => {
      if (typeof previousHandler === "function") {
        errorUtils.setGlobalHandler(previousHandler);
      }
    };
  }, []);
}

