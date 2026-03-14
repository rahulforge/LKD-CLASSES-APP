import type { StudentType } from "./user";

export type SubscriptionStatus =
  | "loading"
  | "free"
  | "active"
  | "expired";

export type PlanType = "online" | "offline";

export type SubscriptionRow = {
  user_id: string;
  is_active: boolean;
  expires_at: string | null;
  plan_type: PlanType | null;
  plan_code?: string | null;
  updated_at: string;
};

export type SubscriptionSnapshot = {
  userId: string;
  status: SubscriptionStatus;
  isActive: boolean;
  expiresAt: string | null;
  planType: PlanType | null;
  planCode?: string | null;
  studentType: StudentType;
  updatedAt: string | null;
};
