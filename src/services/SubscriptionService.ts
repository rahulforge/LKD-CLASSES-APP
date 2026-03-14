import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { cacheService } from "./cacheService";
import type {
  SubscriptionRow,
  SubscriptionSnapshot,
  SubscriptionStatus,
} from "../types/subscription";
import type { StudentType } from "../types/user";

const SUB_KEY_PREFIX = "lkd_subscription_v2";
const SUB_TTL_MS = 2 * 60 * 1000;

const getCacheKey = (userId: string) =>
  `${SUB_KEY_PREFIX}_${userId}`;

const getStatus = (
  isActive: boolean,
  expiresAt: string | null
): SubscriptionStatus => {
  if (!isActive) return "free";
  if (!expiresAt) return "active";
  return new Date(expiresAt).getTime() > Date.now()
    ? "active"
    : "expired";
};

const normalize = (
  userId: string,
  row: SubscriptionRow | null,
  studentType: StudentType
): SubscriptionSnapshot => {
  const isOffline = studentType === "offline";
  const isActive = isOffline ? true : Boolean(row?.is_active);
  const expiresAt = row?.expires_at ?? null;

  return {
    userId,
    status: isOffline
      ? "active"
      : getStatus(isActive, expiresAt),
    isActive,
    expiresAt,
    planType: row?.plan_type ?? (isOffline ? "offline" : "online"),
    planCode: row?.plan_code ?? null,
    studentType,
    updatedAt: row?.updated_at ?? null,
  };
};

type UserSubListeners = {
  callbacks: Set<() => void>;
  subscriptionChannel: ReturnType<typeof supabase.channel>;
  paymentChannel: ReturnType<typeof supabase.channel>;
};

const listenerRegistry = new Map<string, UserSubListeners>();

export const subscriptionService = {
  async getSubscription(
    userId: string,
    studentType: StudentType
  ): Promise<SubscriptionSnapshot> {
    const cacheKey = getCacheKey(userId);
    return cacheService.getOrFetch<SubscriptionSnapshot>(
      cacheKey,
      SUB_TTL_MS,
      () => this.refreshSubscription(userId, studentType),
      { revalidate: true }
    );
  },

  async refreshSubscription(
    userId: string,
    studentType: StudentType
  ): Promise<SubscriptionSnapshot> {
    let { data, error } = await supabase
      .from("subscriptions")
      .select(
        "user_id, is_active, expires_at, plan_type, plan_code, updated_at"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (
      error &&
      String(error.message ?? "")
        .toLowerCase()
        .includes("plan_code") &&
      String(error.message ?? "")
        .toLowerCase()
        .includes("does not exist")
    ) {
      const fallback = await supabase
        .from("subscriptions")
        .select("user_id, is_active, expires_at, plan_type, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      data = fallback.data
        ? ({
            ...fallback.data,
            plan_code: null,
          } as SubscriptionRow)
        : null;
      error = fallback.error;
    }

    const snapshot = normalize(
      userId,
      error || !data ? null : (data as SubscriptionRow),
      studentType
    );

    await cacheService.set(getCacheKey(userId), snapshot);

    return snapshot;
  },

  async clear(userId?: string): Promise<void> {
    if (userId) {
      await AsyncStorage.removeItem(getCacheKey(userId));
      return;
    }

    const allKeys = await AsyncStorage.getAllKeys();
    const keys = allKeys.filter((key) => key.startsWith(SUB_KEY_PREFIX));
    if (keys.length) {
      await AsyncStorage.multiRemove(keys);
    }
  },

  listen(
    userId: string,
    onChange: () => void
  ): () => void {
    if (!listenerRegistry.has(userId)) {
      const callbacks = new Set<() => void>();
      const trigger = () => {
        callbacks.forEach((cb) => cb());
      };
      const subChannel = supabase
        .channel(`subscription_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "subscriptions",
            filter: `user_id=eq.${userId}`,
          },
          trigger
        )
        .subscribe();

      const paymentChannel = supabase
        .channel(`payments_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "payments",
            filter: `user_id=eq.${userId}`,
          },
          trigger
        )
        .subscribe();
      listenerRegistry.set(userId, {
        callbacks,
        subscriptionChannel: subChannel,
        paymentChannel,
      });
    }

    const entry = listenerRegistry.get(userId)!;
    entry.callbacks.add(onChange);

    return () => {
      const active = listenerRegistry.get(userId);
      if (!active) return;
      active.callbacks.delete(onChange);
      if (active.callbacks.size === 0) {
        supabase.removeChannel(active.subscriptionChannel);
        supabase.removeChannel(active.paymentChannel);
        listenerRegistry.delete(userId);
      }
    };
  },
};
