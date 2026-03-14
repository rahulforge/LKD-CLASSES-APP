import { useAppSessionContext } from "../context/AppSessionContext";

export default function useProfile() {
  const { profile, profileLoading, profileError, refreshProfile } = useAppSessionContext();

  return {
    profile,
    loading: profileLoading,
    error: profileError,
    refreshProfile,
    isStudent: profile?.role === "student",
    isTeacher: profile?.role === "teacher",
    classId: profile?.class ?? null,
    classLabel: profile?.class_name ?? null,
    className: profile?.class ?? profile?.class_name ?? null,
    studentType: profile?.student_type ?? "online",
  };
}
