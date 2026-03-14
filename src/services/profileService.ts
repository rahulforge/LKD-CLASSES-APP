import { supabase } from "../../lib/supabase";
import type {
  ProgramType,
  StudentType,
  UserProfile,
  UserRole,
} from "../types/user";

type CreateStudentProfilePayload = {
  userId: string;
  name: string;
  phone: string;
  rollNumber?: string | null;
  studentClass?: string | null;
  programType?: ProgramType;
  competitiveExam?: string | null;
  studentType: StudentType;
  admissionPaid?: boolean;
  appAccessPaid?: boolean;
};

type CreatedStudentProfileMeta = {
  studentType: StudentType;
  admissionPaid: boolean;
};

const defaultStudentType: StudentType = "online";
const defaultProgramType: ProgramType = "school";

const profileSelect =
  "id, name, phone, role, class, program_type, competitive_exam, student_type, admission_paid, app_access_paid, roll_number, is_active, created_at";

const classNameCache = new Map<string, string>();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isMissingColumnError = (message: string) => {
  const msg = String(message ?? "").toLowerCase();
  return (
    msg.includes("column") &&
    (msg.includes("does not exist") || msg.includes("schema cache"))
  );
};

async function resolveClassNameById(classId: string | null): Promise<string | null> {
  const id = String(classId ?? "").trim();
  if (!id) return null;
  if (classNameCache.has(id)) {
    return classNameCache.get(id) ?? null;
  }

  const { data, error } = await supabase
    .from("classes")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (error || !data?.name) {
    return null;
  }

  const name = String(data.name);
  classNameCache.set(id, name);
  return name;
}

const normalizeProfile = (data: any): UserProfile =>
  ({
    ...data,
    program_type:
      (data.program_type as ProgramType | null) ??
      defaultProgramType,
    competitive_exam:
      (data.competitive_exam as string | null) ?? null,
    student_type:
      (data.student_type as StudentType | null) ??
      defaultStudentType,
    admission_paid: Boolean(data.admission_paid),
    app_access_paid: Boolean(data.app_access_paid),
    roll_number: data.roll_number ?? null,
    class_name: data.class_name ?? null,
    role: data.role as UserRole,
  } as UserProfile);

export const profileService = {
  async getMyRole(userId: string): Promise<UserRole | null> {
    try {
      const profileRes = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      const role = profileRes.data?.role as UserRole | undefined;
      if (role === "teacher" || role === "student") {
        return role;
      }

      const studentRes = await supabase
        .from("students")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!studentRes.error && studentRes.data) {
        return "student";
      }

      return null;
    } catch {
      return null;
    }
  },

  async findTeacherCreatedStudentByPhone(phone: string): Promise<any | null> {
    const normalizedPhone = String(phone ?? "").replace(/\D/g, "").trim();
    if (!normalizedPhone) return null;

    // Prefer unlinked rows first so signup can attach auth user_id.
    const unlinkedPrimary = await supabase
      .from("students")
      .select(
        "id, user_id, name, phone, class_id, category, student_type, admission_paid, app_access_paid, roll_number, admission_date"
      )
      .eq("phone", normalizedPhone)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!unlinkedPrimary.error && unlinkedPrimary.data) {
      return unlinkedPrimary.data;
    }

    const primary = await supabase
      .from("students")
      .select(
        "id, user_id, name, phone, class_id, category, student_type, admission_paid, app_access_paid, roll_number, admission_date"
      )
      .eq("phone", normalizedPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!primary.error && primary.data) {
      return primary.data;
    }

    const unlinkedFallback = await supabase
      .from("students")
      .select(
        "id, user_id, name, phone, class_id, category, student_type, admission_paid, app_access_paid, roll_number, admission_date"
      )
      .eq("phone", phone)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!unlinkedFallback.error && unlinkedFallback.data) {
      return unlinkedFallback.data;
    }

    const fallback = await supabase
      .from("students")
      .select(
        "id, user_id, name, phone, class_id, category, student_type, admission_paid, app_access_paid, roll_number, admission_date"
      )
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallback.error || !fallback.data) {
      return null;
    }

    return fallback.data;
  },

  async findTeacherCreatedStudentByRoll(rollNumber: string): Promise<any | null> {
    const normalizedRoll = String(rollNumber ?? "").trim();
    if (!normalizedRoll) return null;

    const unlinkedPrimary = await supabase
      .from("students")
      .select(
        "id, user_id, name, phone, class_id, category, student_type, admission_paid, app_access_paid, roll_number, admission_date"
      )
      .eq("roll_number", normalizedRoll)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!unlinkedPrimary.error && unlinkedPrimary.data) {
      return unlinkedPrimary.data;
    }

    const primary = await supabase
      .from("students")
      .select(
        "id, user_id, name, phone, class_id, category, student_type, admission_paid, app_access_paid, roll_number, admission_date"
      )
      .eq("roll_number", normalizedRoll)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!primary.error && primary.data) {
      return primary.data;
    }

    return null;
  },

  async resolveClassId(
    studentClass?: string | null,
    programType?: ProgramType
  ): Promise<string | null> {
    const raw = String(studentClass ?? "").trim();
    const className = raw
      ? /^class\s+/i.test(raw)
        ? raw
        : /^(\d+)$/.test(raw)
          ? `Class ${raw}`
          : raw
      : programType === "competitive"
        ? "Competitive"
        : "";

    if (!className) {
      return null;
    }

    const classesRes = await supabase
      .from("classes")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(200);

    if (classesRes.error || !classesRes.data?.length) {
      return null;
    }

    const normalized = className.toLowerCase().replace(/\s+/g, "");
    const match = (classesRes.data as any[]).find((row) => {
      const name = String(row.name ?? "").toLowerCase().replace(/\s+/g, "");
      return name === normalized || name.endsWith(normalized) || normalized.endsWith(name);
    });
    if (match?.id) {
      return String(match.id);
    }

    if (programType === "competitive") {
      const comp = (classesRes.data as any[]).find((row) =>
        String(row.name ?? "").toLowerCase().includes("competitive")
      );
      if (comp?.id) {
        return String(comp.id);
      }
    }

    return null;
  },

  async getMyProfile(
    userId: string
  ): Promise<UserProfile | null> {
    try {
      let { data, error } = await supabase
        .from("profiles")
        .select(profileSelect)
        .eq("id", userId)
        .maybeSingle();

      if (error && isMissingColumnError(error.message)) {
        const fallback = await supabase
          .from("profiles")
          .select(
            "id, name, phone, role, class, program_type, competitive_exam, student_type, admission_paid, roll_number, is_active, created_at"
          )
          .eq("id", userId)
          .maybeSingle();
        data = fallback.data as any;
        error = fallback.error;
        if (data && data.app_access_paid === undefined) {
          (data as any).app_access_paid = false;
        }
      }

      if (error || !data) {
        const fromStudent = await supabase
          .from("students")
          .select(
            "user_id, name, phone, class_id, category, student_type, admission_paid, app_access_paid, roll_number, created_at"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!fromStudent.error && fromStudent.data) {
          const s = fromStudent.data as any;
          data = {
            id: userId,
            name: s.name ?? "Student",
            phone: s.phone ?? null,
            role: "student",
            class: s.class_id ?? null,
            program_type: s.category === "competitive" ? "competitive" : "school",
            competitive_exam: null,
            student_type: s.student_type === "offline" ? "offline" : "online",
            admission_paid: Boolean(s.admission_paid),
            app_access_paid: Boolean(s.app_access_paid),
            roll_number: s.roll_number ?? null,
            is_active: true,
            created_at: s.created_at ?? new Date().toISOString(),
          };

          // Self-heal missing profile row if allowed by policies.
          await supabase
            .from("profiles")
            .upsert(data, { onConflict: "id" });
        } else {
          return null;
        }
      }

      const normalized = normalizeProfile(data);

      const studentRes = await supabase
        .from("students")
        .select("class_id, roll_number, student_type, admission_paid, app_access_paid")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!studentRes.error && studentRes.data) {
        const classId = studentRes.data.class_id
          ? String(studentRes.data.class_id)
          : null;
        const roll = studentRes.data.roll_number
          ? String(studentRes.data.roll_number)
          : null;
        const studentType =
          studentRes.data.student_type === "offline" ? "offline" : "online";
        const admissionPaid = Boolean(studentRes.data.admission_paid);
        const appAccessPaid = Boolean(studentRes.data.app_access_paid);

        if (classId && normalized.class !== classId) {
          normalized.class = classId;
        }
        if (roll && normalized.roll_number !== roll) {
          normalized.roll_number = roll;
        }
        if (normalized.student_type !== studentType) {
          normalized.student_type = studentType;
        }
        if (normalized.admission_paid !== admissionPaid) {
          normalized.admission_paid = admissionPaid;
        }
        if (normalized.app_access_paid !== appAccessPaid) {
          normalized.app_access_paid = appAccessPaid;
        }

        // Keep profile table in sync with students for stable student-side display.
        if (
          (classId && data.class !== classId) ||
          (roll && data.roll_number !== roll) ||
          data.student_type !== studentType ||
          Boolean(data.admission_paid) !== admissionPaid ||
          Boolean(data.app_access_paid) !== appAccessPaid
        ) {
          await supabase
            .from("profiles")
            .update({
              class: classId ?? data.class ?? null,
              roll_number: roll ?? data.roll_number ?? null,
              student_type: studentType,
              admission_paid: admissionPaid,
              app_access_paid: appAccessPaid,
            })
            .eq("id", userId)
            .eq("role", "student");
        }
      }

      if (!normalized.class) {
        const studentRes = await supabase
          .from("students")
          .select("class_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!studentRes.error && studentRes.data?.class_id) {
          normalized.class = String(studentRes.data.class_id);
        }
      }

      if (!normalized.class_name && normalized.class) {
        normalized.class_name = await resolveClassNameById(normalized.class);
      }
      return normalized;
    } catch {
      return null;
    }
  },

  async createStudentProfile(
    payload: CreateStudentProfilePayload
  ): Promise<CreatedStudentProfileMeta> {
    const normalizedPhone = String(payload.phone ?? "").replace(/\D/g, "").trim();
    const normalizedRoll = String(payload.rollNumber ?? "").trim();
    let existing = await this.findTeacherCreatedStudentByPhone(normalizedPhone);
    if (!existing && normalizedRoll) {
      existing = await this.findTeacherCreatedStudentByRoll(normalizedRoll);
    }

    if (existing?.user_id && String(existing.user_id) !== payload.userId) {
      throw new Error("This phone is already linked with another student account.");
    }

    const linkedClassId = existing?.class_id ? String(existing.class_id) : null;
    const linkedCategory = existing?.category === "competitive" ? "competitive" : "school";
    const linkedStudentType =
      existing?.student_type === "offline" ? "offline" : null;
    const linkedAdmissionPaid = Boolean(existing?.admission_paid);
    const resolvedClassId =
      linkedClassId ??
      (await this.resolveClassId(payload.studentClass, payload.programType));

    const finalProgramType: ProgramType =
      linkedCategory === "competitive"
        ? "competitive"
        : payload.programType ?? defaultProgramType;
    const finalStudentType: StudentType =
      linkedStudentType ?? payload.studentType ?? defaultStudentType;
    const finalAdmissionPaid =
      existing ? linkedAdmissionPaid : payload.admissionPaid ?? false;
    const finalAppAccessPaid = existing
      ? Boolean(existing?.app_access_paid)
      : Boolean(
          payload.appAccessPaid ?? false
        ) ||
        finalAdmissionPaid ||
        finalStudentType === "offline";

    if (!resolvedClassId) {
      throw new Error(
        payload.programType === "competitive"
          ? "Competitive class is not configured. Please contact admin."
          : "Class is not configured. Please contact admin."
      );
    }

    // Claim teacher-created student row before profile upsert.
    // This prevents trigger-created duplicate rows for the same user_id.
    if (existing?.id && !existing?.user_id) {
      const claim = await supabase
        .from("students")
        .update({
          user_id: payload.userId,
          name: String(existing?.name ?? payload.name).trim(),
          phone: String(existing?.phone ?? normalizedPhone )|| payload.phone,
          class_id: existing?.class_id ?? resolvedClassId,
          category:
            existing?.category ??
            (finalProgramType === "competitive" ? "competitive" : "school"),
          student_type: existing?.student_type ?? finalStudentType,
          admission_paid: existing?.admission_paid ?? finalAdmissionPaid,
          app_access_paid: existing?.app_access_paid ?? finalAppAccessPaid,
          roll_number: (existing?.roll_number ?? normalizedRoll) || null,
        })
        .eq("id", existing.id)
        .is("user_id", null);

      if (claim.error) {
        throw new Error(claim.error.message || "Unable to link existing student row");
      }
    }

    const upsertProfile = await supabase
      .from("profiles")
      .upsert({
        id: payload.userId,
        name: String(existing?.name ?? payload.name).trim(),
        phone: String(existing?.phone ?? normalizedPhone) || payload.phone,
        role: "student",
        class: existing?.class_id ?? resolvedClassId,
        program_type:
          existing?.category === "competitive" ? "competitive" : finalProgramType,
        competitive_exam:
          payload.competitiveExam ?? null,
        student_type: existing?.student_type ?? finalStudentType,
        admission_paid: existing?.admission_paid ?? finalAdmissionPaid,
        app_access_paid: existing?.app_access_paid ?? finalAppAccessPaid,
        roll_number: (existing?.roll_number ?? normalizedRoll) || null,
        is_active: true,
      }, { onConflict: "id" });

    if (upsertProfile.error) {
      throw new Error(upsertProfile.error.message || "Profile creation failed");
    }

    const studentPayload = {
      user_id: payload.userId,
      name: String(existing?.name ?? payload.name).trim(),
      phone: String(existing?.phone ?? normalizedPhone) || payload.phone,
      class_id: existing?.class_id ?? resolvedClassId,
      category:
        existing?.category ??
        (finalProgramType === "competitive" ? "competitive" : "school"),
      student_type: existing?.student_type ?? finalStudentType,
      admission_paid: existing?.admission_paid ?? finalAdmissionPaid,
      app_access_paid: existing?.app_access_paid ?? finalAppAccessPaid,
      admission_date:
        existing?.admission_date ?? new Date().toISOString().slice(0, 10),
      roll_number: (existing?.roll_number ?? normalizedRoll) || null,
    };

    const studentInsert = existing?.id
      ? await supabase
          .from("students")
          .update(studentPayload)
          .eq("id", existing.id)
      : await supabase
          .from("students")
          .upsert(studentPayload, { onConflict: "user_id" });

    if (studentInsert.error) {
      throw new Error(studentInsert.error.message || "Student record creation failed");
    }

    return {
      studentType: finalStudentType,
      admissionPaid: finalAdmissionPaid,
    };
  },

  async isProfileActive(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .maybeSingle();

      if (error || !data) return false;
      return data.is_active === true;
    } catch {
      return false;
    }
  },
};
