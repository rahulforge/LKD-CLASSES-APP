import { useCallback, useEffect, useState } from "react";
import { subscriptionService } from "../services/SubscriptionService";
import useAuth from "./useAuth";
import useProfile from "./useProfile";
import type { SubscriptionSnapshot } from "../types/subscription";

export default function useSubscription() {
  const { user } = useAuth();
  const { studentType } = useProfile();

  const [subscription, setSubscription] =
    useState<SubscriptionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const data = await subscriptionService.refreshSubscription(
      user.id,
      studentType
    );
    setSubscription(data);
    setLoading(false);
  }, [user?.id, studentType]);

  useEffect(() => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    let cleanup = () => {};

    const load = async () => {
      const cached =
        await subscriptionService.getSubscription(
          user.id,
          studentType
        );
      setSubscription(cached);
      setLoading(false);

      cleanup = subscriptionService.listen(
        user.id,
        refresh
      );
    };

    load();

    return () => cleanup();
  }, [user?.id, studentType, refresh]);

  const status = subscription?.status ?? "loading";

  return {
    loading,
    subscription,
    status,
    isFree: status === "free",
    isActive: status === "active",
    isExpired: status === "expired",
    canWatchVideo: status === "active",
    canViewMaterial: status === "active",
    canViewResults: status === "active",
    refresh,
  };
}
