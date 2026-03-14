import useProfile from "./useProfile";
import useSubscription from "./useSubscription";
import {
  accessService,
  type ContentFeature,
} from "../services/accessService";

export function useAccessGuard(feature: ContentFeature) {
  const { profile, loading: profileLoading } = useProfile();
  const { isActive, loading: subLoading, subscription } = useSubscription();

  const loading = profileLoading || subLoading;
  const allowed = accessService.canAccessFeature(
    feature,
    profile,
    Boolean(isActive)
  );

  return {
    loading,
    allowed,
    profile,
    subscription,
  };
}
