import { useCallback, useEffect, useState } from "react";
import { subscriptionPlanService, type SubscriptionPlan } from "../services/subscriptionPlanService";

export function useSubscriptionPlans(activeOnly = true) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (force = false) => {
      const first = await subscriptionPlanService.listPlans({ activeOnly, force });
      setPlans(first);
      setLoading(false);

      if (!force) {
        const fresh = await subscriptionPlanService.listPlans({
          activeOnly,
          force: true,
        });
        setPlans(fresh);
      }
    },
    [activeOnly]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    plans,
    loading,
    refresh: () => load(true),
  };
}
