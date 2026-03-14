import { useAppSessionContext } from "../context/AppSessionContext";

export default function useAuth() {
  const { user, authLoading, login, logout } = useAppSessionContext();

  return {
    user,
    loading: authLoading,
    isLoggedIn: Boolean(user),
    login,
    logout,
  };
}
