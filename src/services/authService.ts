import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { profileService } from "./profileService";
import type { ProgramType } from "../types/user";
import { sanitizeDigits, sanitizeText } from "../utils/sanitize";

const SESSION_KEY = "lkd_session_v2";

const normalizePhone = (input: string) =>
  sanitizeDigits(input, 10);

type RegisterInput = {
  name: string;
  phone: string;
  password: string;
  rollNumber?: string | null;
  studentClass?: string | null;
  programType?: ProgramType;
  competitiveExam?: string | null;
};

type AuthChangeCallback = (
  event: string,
  session: Session | null
) => void | Promise<void>;

export const authService = {
  async login(
    phone: string,
    password: string
  ): Promise<User> {
    const normalizedPhone = normalizePhone(phone);

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      throw new Error("Enter valid mobile number");
    }

    const email = `${normalizedPhone}@lkd.app`;
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error || !data?.session?.user) {
      const raw = String(error?.message ?? "").toLowerCase();
      if (raw.includes("invalid login credentials")) {
        throw new Error("Invalid phone or password");
      }
      if (raw.includes("email not confirmed")) {
        throw new Error("Account verification pending");
      }
      throw new Error(error?.message || "Unable to login right now");
    }

    await AsyncStorage.setItem(
      SESSION_KEY,
      JSON.stringify(data.session)
    );

    return data.session.user;
  },

  async registerStudent(input: RegisterInput) {
    const normalizedPhone = normalizePhone(input.phone);

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      throw new Error("Enter valid 10 digit mobile number");
    }

    const email = `${normalizedPhone}@lkd.app`;
    const finalStudentType = "online";

    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
    });

    if (error || !data?.user) {
      const rawMessage = String(error?.message ?? "").toLowerCase();
      const rawCode = String((error as any)?.code ?? "").toLowerCase();
      const isAlreadyExists =
        rawMessage.includes("already registered") ||
        rawMessage.includes("already exists") ||
        rawCode.includes("already") ||
        rawCode.includes("exists") ||
        rawCode.includes("user_already_exists");

      if (isAlreadyExists) {
        throw new Error(
          "Is number se account pehle se bana hua hai. Login karein ya Forgot Password use karein."
        );
      }

      throw new Error("Unable to create account");
    }

    let linked: { studentType: "online" | "offline"; admissionPaid: boolean } = {
      studentType: finalStudentType,
      admissionPaid: false,
    };
    try {
      linked = await profileService.createStudentProfile({
        userId: data.user.id,
        name: sanitizeText(input.name, 80),
        phone: normalizedPhone,
        rollNumber: input.rollNumber ?? null,
        studentClass: input.studentClass ?? null,
        programType: input.programType ?? "school",
        competitiveExam: input.competitiveExam ?? null,
        studentType: finalStudentType,
        admissionPaid: false,
        appAccessPaid: false,
      });
    } catch (createError) {
      const raw = String((createError as any)?.message ?? "").toLowerCase();
      const isStackNoise =
        raw.includes("stack") || raw.includes("depth") || raw.includes("full");
      if (!isStackNoise) {
        throw createError;
      }

      const profileCheck = await supabase
        .from("profiles")
        .select("id, student_type")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileCheck.error || !profileCheck.data) {
        throw new Error("Profile creation in progress. Please login and continue.");
      }

      linked = {
        studentType:
          profileCheck.data.student_type === "offline" ? "offline" : "online",
        admissionPaid: false,
      };
    }

    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: data.user.id,
        is_active: linked.studentType === "offline",
        expires_at: null,
        plan_type: linked.studentType,
      });

    if (subError) {
      throw new Error("Unable to initialize subscription");
    }

    await supabase.auth.signOut();

    return {
      user: data.user,
    };
  },

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();

    if (data?.session) {
      await AsyncStorage.setItem(
        SESSION_KEY,
        JSON.stringify(data.session)
      );
      return data.session;
    }

    const cached = await AsyncStorage.getItem(
      SESSION_KEY
    );
    if (!cached) return null;

    try {
      return JSON.parse(cached) as Session;
    } catch {
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
  },

  onAuthStateChange(callback: AuthChangeCallback) {
    const { data } = supabase.auth.onAuthStateChange(
      callback
    );
    return () => data.subscription.unsubscribe();
  },

  async logout() {
    await AsyncStorage.removeItem(SESSION_KEY);
    const local = await supabase.auth.signOut({
      scope: "local",
    });
    if (local.error) {
      await supabase.auth.signOut();
    }
  },
};
