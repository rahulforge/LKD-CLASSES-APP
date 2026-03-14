import { useEffect } from "react";
import useAuth from "./useAuth";
import useProfile from "./useProfile";
import { pushNotificationService } from "../services/pushNotificationService";

export function usePushNotifications() {
  const { user } = useAuth();
  const { profile } = useProfile();

  useEffect(() => {
    if (!user?.id) return;
    if (profile?.role !== "student") return;

    void pushNotificationService.registerStudentDevice({
      userId: user.id,
      classId: profile.class ?? null,
    });
  }, [profile?.class, profile?.role, user?.id]);
}

