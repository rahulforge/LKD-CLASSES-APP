import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Text,
  StyleSheet,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../src/services/authService";
import { profileService } from "../src/services/profileService";
import AppToastHost from "../src/components/AppToastHost";
import AppErrorBoundary from "../src/components/AppErrorBoundary";
import useGlobalCrashLogger from "../src/hooks/useGlobalCrashLogger";
import { pushNotificationService } from "../src/services/pushNotificationService";
import { AppSessionProvider } from "../src/context/AppSessionContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [booting, setBooting] = useState(true);
  const lastRouteRef = useRef<string>("");
  const pulseAnim = useRef(new Animated.Value(0.96)).current;
  useGlobalCrashLogger();

  useEffect(() => {
    void pushNotificationService.ensurePermissionPromptOnAppOpen();
  }, []);

  useEffect(() => {
    const warmup = async () => {
      try {
        const logoUri = Image.resolveAssetSource(
          require("../assets/images/logo.png")
        )?.uri;
        const founderUri = Image.resolveAssetSource(
          require("../assets/images/founder.png")
        )?.uri;
        const jobs = [logoUri, founderUri]
          .filter(Boolean)
          .map((uri) => Image.prefetch(uri as string));
        if (jobs.length) {
          await Promise.allSettled(jobs);
        }
      } catch {
        // Non-blocking warmup.
      }
    };
    void warmup();
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.96,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};
    const bootMaxTimer = setTimeout(() => {
      if (mounted) setBooting(false);
    }, 3500);

    const safeRoute = (path: string) => {
      if (!mounted) return;
      if (lastRouteRef.current === path) return;
      lastRouteRef.current = path;
      router.replace(path as any);
    };

    const getCachedProfile = async (
      userId: string
    ): Promise<{ role: "teacher" | "student" | null; appAccessPaid: boolean }> => {
      const raw = await AsyncStorage.getItem("user_profile_v2");
      if (!raw) return { role: null, appAccessPaid: false };

      try {
        const parsed = JSON.parse(raw) as
          | {
              userId?: string;
              data?: { role?: string; app_access_paid?: boolean };
            }
          | { id?: string; role?: string; app_access_paid?: boolean };

        const roleFromNew =
          parsed &&
          "userId" in parsed &&
          parsed.userId === userId
            ? parsed.data?.role
            : null;
        const accessFromNew =
          parsed &&
          "userId" in parsed &&
          parsed.userId === userId
            ? Boolean(parsed.data?.app_access_paid)
            : false;
        const roleFromOld =
          parsed &&
          "id" in parsed &&
          parsed.id === userId
            ? parsed.role
            : null;
        const accessFromOld =
          parsed &&
          "id" in parsed &&
          parsed.id === userId
            ? Boolean(parsed.app_access_paid)
            : false;
        const role = (roleFromNew || roleFromOld) as
          | "teacher"
          | "student"
          | null;
        return {
          role: role ?? null,
          appAccessPaid: accessFromNew || accessFromOld,
        };
      } catch {
        return { role: null, appAccessPaid: false };
      }
    };

    const routeByRole = async (userId: string) => {
      const cached = await getCachedProfile(userId);
      const cachedRole = cached.role;
      if (cachedRole === "teacher") {
        safeRoute("/(teacher)/home");
      } else if (cachedRole === "student") {
        safeRoute(cached.appAccessPaid ? "/(student)/home" : "/(student)/app-access");
      }

      const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
        Promise.race<T | null>([
          promise,
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), ms)
          ),
        ]);

      const quickRole =
        (await withTimeout(profileService.getMyRole(userId), 2500)) ?? null;
      if (quickRole === "teacher") {
        safeRoute("/(teacher)/home");
        return;
      }
      let profile =
        (await withTimeout(profileService.getMyProfile(userId), 3500)) ?? null;
      if (!profile) {
        profile =
          (await withTimeout(profileService.getMyProfile(userId), 1500)) ?? null;
      }

      if (!profile) {
        if (cachedRole === "teacher") {
          safeRoute("/(teacher)/home");
          return;
        }
        // Authenticated user should never drop to public home just due to slow profile fetch.
        safeRoute("/(student)/app-access");
        return;
      }

      if (profile.role === "teacher") {
        safeRoute("/(teacher)/home");
        return;
      }

      if (profile.role === "student") {
        safeRoute(profile.app_access_paid ? "/(student)/home" : "/(student)/app-access");
        return;
      }

      safeRoute("/(public)/home");
    };

    const bootstrap = async () => {
      try {
        const session = await authService.getSession();

        if (!session?.user?.id) {
          safeRoute("/(public)/home");
        } else {
          await routeByRole(session.user.id);
        }

        unsubscribe = authService.onAuthStateChange(
          async (event, nextSession) => {
            if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
              if (mounted) {
                setBooting(false);
              }
              return;
            }

            if (!nextSession?.user?.id) {
              safeRoute("/(public)/home");
              setBooting(false);
              return;
            }

            if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
              await routeByRole(nextSession.user.id);
            }
            if (mounted) {
              setBooting(false);
            }
          }
        );
      } catch {
        safeRoute("/(public)/home");
      } finally {
        if (mounted) {
          setBooting(false);
        }
        await SplashScreen.hideAsync();
      }
    };

    bootstrap();

    return () => {
      mounted = false;
      clearTimeout(bootMaxTimer);
      unsubscribe();
    };
  }, [router]);

  const isPlayerRoute = segments.includes("classes") && segments.includes("player");

  return (
    <View style={[styles.root, isPlayerRoute && styles.rootNoTopPadding]}>
      <StatusBar style="light" translucent={false} backgroundColor="#0B1220" />
      <AppSessionProvider>
        <AppErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0B1220" },
              animation: "fade",
            }}
          />
        </AppErrorBoundary>
      </AppSessionProvider>
      {booting && (
        <View style={styles.bootOverlay} pointerEvents="none">
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Image source={require("../assets/images/logo.png")} style={styles.logo} />
          </Animated.View>
          <Text style={styles.brandText}>LKD Classes</Text>
          <Text style={styles.brandSubText}>Smart learning app for students and teachers</Text>
          <ActivityIndicator size="large" color="#38BDF8" />
        </View>
      )}
      <AppToastHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B1220",
    paddingTop: 30,
  },
  rootNoTopPadding: {
    paddingTop: 0,
  },
  bootOverlay: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 18,
  },
  brandText: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "700",
    marginTop: -2,
  },
  brandSubText: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: -6,
    marginBottom: 2,
  },
});
