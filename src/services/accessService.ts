import type { UserProfile } from "../types/user";

export type ContentFeature =
  | "video"
  | "material"
  | "mock_test";

export const accessService = {
  canAccessPaidContent(
    profile: UserProfile | null,
    subscriptionActive: boolean
  ): boolean {
    if (!profile) return false;
    if (!profile.is_active) return false;
    return subscriptionActive;
  },

  canAccessFeature(
    feature: ContentFeature,
    profile: UserProfile | null,
    subscriptionActive: boolean
  ): boolean {
    if (!profile || !profile.is_active) return false;
    if (profile.role !== "student") return false;

    if (feature === "video" || feature === "material" || feature === "mock_test") {
      return this.canAccessPaidContent(profile, subscriptionActive);
    }

    return false;
  },
};
