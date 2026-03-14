import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "../../lib/supabase";

const TOKEN_CACHE_KEY = "lkd_expo_push_token_v1";
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

type AudienceInput =
  | { scope: "all" }
  | { scope: "class"; classId: string };

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  audience: AudienceInput;
};

const isExpoPushToken = (token: string) =>
  /^ExponentPushToken\[.+\]$/.test(token);

const chunk = <T>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const getProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId ??
  null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const pushNotificationService = {
  async ensurePermissionPromptOnAppOpen(): Promise<void> {
    try {
      const existing = await Notifications.getPermissionsAsync();
      if (existing.status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
        });
      }
    } catch {
      // Ignore permission errors; app should continue.
    }
  },

  async registerStudentDevice(input: {
    userId: string;
    classId: string | null;
  }): Promise<string | null> {
    const projectId = getProjectId();
    if (!projectId) return null;

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;
    if (!token || !isExpoPushToken(token)) {
      return null;
    }

    const lastToken = await AsyncStorage.getItem(TOKEN_CACHE_KEY);
    if (lastToken === token) {
      return token;
    }

    const { error } = await supabase.from("device_push_tokens").upsert(
      {
        user_id: input.userId,
        class_id: input.classId,
        expo_push_token: token,
        platform: Platform.OS,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,expo_push_token" }
    );

    if (!error) {
      await AsyncStorage.setItem(TOKEN_CACHE_KEY, token);
      return token;
    }

    return null;
  },

  async sendToStudents(payload: PushPayload): Promise<void> {
    let studentQuery = supabase
      .from("students")
      .select("user_id")
      .not("user_id", "is", null);

    if (payload.audience.scope === "class") {
      studentQuery = studentQuery.eq("class_id", payload.audience.classId);
    }

    const studentsRes = await studentQuery;
    if (studentsRes.error || !studentsRes.data?.length) {
      return;
    }

    const userIds = Array.from(
      new Set(
        studentsRes.data
          .map((row: any) => String(row.user_id ?? ""))
          .filter(Boolean)
      )
    );
    if (!userIds.length) return;

    const tokensRes = await supabase
      .from("device_push_tokens")
      .select("id, expo_push_token")
      .in("user_id", userIds)
      .eq("is_active", true);

    if (tokensRes.error || !tokensRes.data?.length) {
      return;
    }

    const tokens = Array.from(
      new Set(
        tokensRes.data
          .map((row: any) => String(row.expo_push_token ?? ""))
          .filter(isExpoPushToken)
      )
    );
    if (!tokens.length) return;

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      priority: "high",
    }));

    for (const packet of chunk(messages, 100)) {
      try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(packet),
        });
        const result = (await response.json().catch(() => null)) as any;
        const dataRows = Array.isArray(result?.data) ? result.data : [];
        const badIndexes: number[] = [];
        dataRows.forEach((ticket: any, index: number) => {
          if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
            badIndexes.push(index);
          }
        });
        if (badIndexes.length) {
          const badTokens = badIndexes
            .map((index) => packet[index]?.to)
            .filter(Boolean);
          if (badTokens.length) {
            await supabase
              .from("device_push_tokens")
              .update({ is_active: false })
              .in("expo_push_token", badTokens);
          }
        }
      } catch {
        // Ignore transient push send errors.
      }
    }
  },

  async sendToUser(input: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const userId = String(input.userId ?? "").trim();
    if (!userId) return;

    const tokensRes = await supabase
      .from("device_push_tokens")
      .select("expo_push_token")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (tokensRes.error || !tokensRes.data?.length) {
      return;
    }

    const tokens = Array.from(
      new Set(
        tokensRes.data
          .map((row: any) => String(row.expo_push_token ?? ""))
          .filter(isExpoPushToken)
      )
    );
    if (!tokens.length) return;

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      priority: "high",
    }));

    for (const packet of chunk(messages, 100)) {
      try {
        await fetch(EXPO_PUSH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(packet),
        });
      } catch {
        // Ignore transient push send errors.
      }
    }
  },
};
