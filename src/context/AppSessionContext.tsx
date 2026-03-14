import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { authService } from "../services/authService";
import { profileService } from "../services/profileService";
import type { UserProfile } from "../types/user";

const AUTH_CACHE_KEY = "auth_user_v2";
const PROFILE_CACHE_KEY = "user_profile_v2";
const HOME_CACHE_KEY = "student_home_v2";
const HOME_CACHE_V3_PREFIX = "student_home_v3_";
const CLASS_CACHE_PREFIX = "lkd_class_v2_";
const MATERIAL_CACHE_PREFIX = "material_cache_v2_";
const SUB_CACHE_PREFIX = "lkd_subscription_v2_";
const PROFILE_CACHE_TTL_MS = 1000 * 60 * 5;

type CachedProfile = {
  userId: string;
  data: UserProfile;
  time: number;
};

type AppSessionContextValue = {
  user: User | null;
  authLoading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

async function clearSessionCaches() {
  const keys = await AsyncStorage.getAllKeys();
  const homeV3Keys = keys.filter((key) => key.startsWith(HOME_CACHE_V3_PREFIX));
  const classKeys = keys.filter((key) => key.startsWith(CLASS_CACHE_PREFIX));
  const materialKeys = keys.filter((key) => key.startsWith(MATERIAL_CACHE_PREFIX));
  const subKeys = keys.filter((key) => key.startsWith(SUB_CACHE_PREFIX));
  const targets = [
    AUTH_CACHE_KEY,
    PROFILE_CACHE_KEY,
    HOME_CACHE_KEY,
    ...homeV3Keys,
    ...classKeys,
    ...materialKeys,
    ...subKeys,
  ];
  await AsyncStorage.multiRemove(targets);
}

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const profileUserIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string, force = false) => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      if (!force) {
        const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as CachedProfile;
            const isValid = parsed?.userId === userId && !!parsed.data;
            const isFresh =
              typeof parsed?.time === "number" &&
              Date.now() - parsed.time < PROFILE_CACHE_TTL_MS;
            const hasClassContext = Boolean(
              parsed?.data?.class || parsed?.data?.class_name
            );
            if (isValid && isFresh && hasClassContext && mountedRef.current) {
              setProfile(parsed.data);
              setProfileLoading(false);
              // Keep cache-first UX but refresh in background for cross-device sync updates.
              void (async () => {
                const fresh = await profileService.getMyProfile(userId);
                if (!mountedRef.current || !fresh) return;
                setProfile(fresh);
                await AsyncStorage.setItem(
                  PROFILE_CACHE_KEY,
                  JSON.stringify({
                    userId,
                    data: fresh,
                    time: Date.now(),
                  } as CachedProfile)
                );
              })();
              return;
            }
          } catch {
            await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
          }
        }
      }

      let data = await profileService.getMyProfile(userId);
      if (!data) {
        data = await profileService.getMyProfile(userId);
      }

      if (!mountedRef.current) {
        return;
      }

      if (!data) {
        setProfile(null);
        setProfileError("Unable to load profile");
        setProfileLoading(false);
        return;
      }

      setProfile(data);
      setProfileLoading(false);
      await AsyncStorage.setItem(
        PROFILE_CACHE_KEY,
        JSON.stringify({
          userId,
          data,
          time: Date.now(),
        } as CachedProfile)
      );
    } catch {
      if (!mountedRef.current) return;
      setProfile(null);
      setProfileError("Unable to load profile");
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    profileUserIdRef.current = profile?.id ?? null;
  }, [profile?.id]);

  useEffect(() => {
    mountedRef.current = true;

    const bootstrap = async () => {
      try {
        const cachedUserRaw = await AsyncStorage.getItem(AUTH_CACHE_KEY);
        if (cachedUserRaw && mountedRef.current) {
          try {
            setUser(JSON.parse(cachedUserRaw) as User);
          } catch {
            await AsyncStorage.removeItem(AUTH_CACHE_KEY);
          }
        }

        const session = await authService.getSession();
        const sessionUser = session?.user ?? null;
        if (!mountedRef.current) return;

        setUser(sessionUser);
        if (sessionUser) {
          await AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(sessionUser));
          await loadProfile(sessionUser.id);
        } else {
          setProfile(null);
          setProfileLoading(false);
          setProfileError(null);
          await clearSessionCaches();
        }
      } finally {
        if (mountedRef.current) {
          setAuthLoading(false);
        }
      }
    };

    void bootstrap();

    const unsubscribe = authService.onAuthStateChange(async (event, session) => {
      const nextUser = session?.user ?? null;
      if (!mountedRef.current) return;

      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setProfileLoading(false);
        setProfileError(null);
        await clearSessionCaches();
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        return;
      }

      await AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(nextUser));
      await loadProfile(nextUser.id, true);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(async (phone: string, password: string) => {
    const nextUser = await authService.login(phone, password);
    setUser(nextUser);
    await AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(nextUser));
    void loadProfile(nextUser.id, true);
    return nextUser;
  }, [loadProfile]);

  const logout = useCallback(async () => {
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setProfileLoading(false);
    await clearSessionCaches();
    await authService.logout();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await loadProfile(user.id, true);
  }, [loadProfile, user?.id]);

  const value = useMemo<AppSessionContextValue>(
    () => ({
      user,
      authLoading,
      profile,
      profileLoading,
      profileError,
      login,
      logout,
      refreshProfile,
    }),
    [authLoading, login, logout, profile, profileError, profileLoading, refreshProfile, user]
  );

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSessionContext() {
  const context = useContext(AppSessionContext);
  if (!context) {
    return {
      user: null,
      authLoading: true,
      profile: null,
      profileLoading: true,
      profileError: "Session not ready",
      login: async () => {
        throw new Error("Session not ready");
      },
      logout: async () => {},
      refreshProfile: async () => {},
    } as AppSessionContextValue;
  }
  return context;
}
