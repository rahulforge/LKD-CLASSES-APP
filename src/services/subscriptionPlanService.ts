import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { CACHE_TTL_MS } from "../utils/constants";

const CACHE_KEY = "lkd_subscription_plans_v1";

export type SubscriptionPlan = {
  code: string;
  title: string;
  description: string | null;
  amount: number;
  duration_months: number;
  badge: string | null;
  details: string[];
  is_active: boolean;
  sort_order: number;
};

type PlanCachePayload = {
  time: number;
  data: SubscriptionPlan[];
};

const normalizePlan = (row: any): SubscriptionPlan => ({
  code: String(row.code ?? ""),
  title: String(row.title ?? "Plan"),
  description: row.description ? String(row.description) : null,
  amount: Number(row.amount ?? 0),
  duration_months: Math.max(1, Number(row.duration_months ?? 1)),
  badge: row.badge ? String(row.badge) : null,
  details: Array.isArray(row.details)
    ? row.details.map((item: unknown) => String(item)).filter(Boolean)
    : [],
  is_active: Boolean(row.is_active ?? true),
  sort_order: Number(row.sort_order ?? 99),
});

const getFreshCache = async (): Promise<SubscriptionPlan[] | null> => {
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached) as PlanCachePayload;
    if (Date.now() - parsed.time < CACHE_TTL_MS && Array.isArray(parsed.data)) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
};

const writeCache = async (rows: SubscriptionPlan[]) => {
  await AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      time: Date.now(),
      data: rows,
    } as PlanCachePayload)
  );
};

export const subscriptionPlanService = {
  async listPlans(input?: { activeOnly?: boolean; force?: boolean }): Promise<SubscriptionPlan[]> {
    const activeOnly = Boolean(input?.activeOnly);
    const force = Boolean(input?.force);

    if (!force) {
      const cached = await getFreshCache();
      if (cached) {
        void this.listPlans({ activeOnly: false, force: true });
        return activeOnly ? cached.filter((item) => item.is_active) : cached;
      }
    }

    const { data, error } = await supabase
      .from("subscription_plans")
      .select("code, title, description, amount, duration_months, badge, details, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("duration_months", { ascending: true });

    if (error || !data) {
      const cached = await getFreshCache();
      if (cached?.length) {
        return activeOnly ? cached.filter((item) => item.is_active) : cached;
      }
      return [];
    }

    const rows = (data as any[]).map(normalizePlan);
    await writeCache(rows);
    return activeOnly ? rows.filter((item) => item.is_active) : rows;
  },

  async getPlanByCode(code: string): Promise<SubscriptionPlan | null> {
    const normalized = String(code ?? "").trim().toLowerCase();
    if (!normalized) return null;
    const plans = await this.listPlans({ activeOnly: false, force: true });
    return plans.find((plan) => String(plan.code).trim().toLowerCase() === normalized) ?? null;
  },

  async upsertPlans(
    plans: {
      code: string;
      title: string;
      description?: string | null;
      amount: number;
      duration_months: number;
      badge?: string | null;
      details?: string[];
      is_active?: boolean;
      sort_order?: number;
    }[]
  ): Promise<void> {
    const payload = plans.map((item, index) => ({
      code: String(item.code).trim(),
      title: String(item.title).trim(),
      description: item.description?.trim() || null,
      amount: Math.max(0, Number(item.amount || 0)),
      duration_months: Math.max(1, Number(item.duration_months || 1)),
      badge: item.badge?.trim() || null,
      details: Array.isArray(item.details)
        ? item.details.map((line) => String(line).trim()).filter(Boolean)
        : [],
      is_active: item.is_active ?? true,
      sort_order: Number(item.sort_order ?? index + 1),
    }));

    const { error } = await supabase
      .from("subscription_plans")
      .upsert(payload, { onConflict: "code" });

    if (error) {
      throw new Error(error.message || "Unable to update subscription plans");
    }

    await this.listPlans({ force: true });
  },
};
