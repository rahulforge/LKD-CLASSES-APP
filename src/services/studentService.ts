import { supabase } from "../../lib/supabase";
import { pushNotificationService } from "./pushNotificationService";
import type {
  PaginatedResult,
  StudentFilter,
  TeacherStudent,
} from "../types/teacher";

type FetchStudentsInput = {
  search?: string;
  filter?: StudentFilter;
  class_id?: string;
  page?: number;
  pageSize?: number;
};

type UpdateStudentInput = Partial<
  Pick<
    TeacherStudent,
    | "name"
    | "roll_number"
    | "phone"
    | "class_id"
    | "student_type"
    | "admission_paid"
    | "app_access_paid"
  >
> & {
  category?: "school" | "competitive";
};

type CreateStudentInput = {
  name: string;
  phone?: string | null;
  class_id: string;
  category: "school" | "competitive";
  student_type: "online" | "offline";
  admission_paid?: boolean;
  roll_number?: string | null;
};

const normalizePhone = (value?: string | null) => {
  const digits = String(value ?? "").replace(/\D/g, "").trim();
  return digits || null;
};

const classFilterCache = new Map<string, { ids: string[]; time: number }>();
const CLASS_FILTER_CACHE_TTL_MS = 5 * 60 * 1000;

const normalizeClassName = (value: string) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

const normalizeRollNumber = (value?: string | null) => {
  const digits = String(value ?? "").replace(/\D/g, "").trim();
  if (!digits) return null;
  return digits.slice(-5).padStart(5, "0");
};

async function resolveClassFilterIds(classId: string): Promise<string[]> {
  const id = String(classId ?? "").trim();
  if (!id) return [];

  const cached = classFilterCache.get(id);
  if (cached && Date.now() - cached.time < CLASS_FILTER_CACHE_TTL_MS) {
    return cached.ids;
  }

  const ownClass = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (ownClass.error || !ownClass.data?.id) {
    const fallback = [id];
    classFilterCache.set(id, { ids: fallback, time: Date.now() });
    return fallback;
  }

  const normalized = normalizeClassName(String(ownClass.data.name ?? ""));
  if (!normalized) {
    const fallback = [id];
    classFilterCache.set(id, { ids: fallback, time: Date.now() });
    return fallback;
  }

  const aliases = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true });

  if (aliases.error || !aliases.data?.length) {
    const fallback = [id];
    classFilterCache.set(id, { ids: fallback, time: Date.now() });
    return fallback;
  }

  const ids = Array.from(
    new Set(
      (aliases.data as any[])
        .filter(
          (row) =>
            normalizeClassName(String(row.name ?? "")) === normalized && row.id
        )
        .map((row) => String(row.id))
        .concat(id)
    )
  );

  classFilterCache.set(id, { ids, time: Date.now() });
  return ids;
}

const normalizeCategory = (
  input: string | null
): "school" | "competitive" =>
  input === "competitive" ? "competitive" : "school";

const normalizeFromStudents = (row: any): TeacherStudent => ({
  id: row.id,
  user_id: row.user_id ?? null,
  name: row.name ?? "",
  roll_number: row.roll_number ?? null,
  phone: row.phone ?? null,
  class_id: row.class_id ?? null,
  class_name: row.classes?.name ?? null,
  category: normalizeCategory(row.category ?? null),
  student_type: row.student_type === "offline" ? "offline" : "online",
  admission_paid: Boolean(row.admission_paid),
  app_access_paid: Boolean(row.app_access_paid),
  joined_at: row.admission_date ?? row.created_at ?? null,
});

const normalizeFromProfiles = (row: any): TeacherStudent => ({
  id: row.id,
  user_id: row.id,
  name: row.name ?? "",
  roll_number: row.roll_number ?? null,
  phone: row.phone ?? null,
  class_id: row.class ?? null,
  class_name: row.class ?? null,
  category: normalizeCategory(row.program_type ?? null),
  student_type: row.student_type === "offline" ? "offline" : "online",
  admission_paid: Boolean(row.admission_paid),
  app_access_paid: Boolean(row.app_access_paid),
  joined_at: row.created_at ?? null,
});

export const studentService = {
  async ensureRollNumberForStudentId(studentId: string): Promise<string | null> {
    const id = String(studentId ?? "").trim();
    if (!id) return null;

    const studentRes = await supabase
      .from("students")
      .select("id, user_id, class_id, student_type, roll_number, app_access_paid")
      .eq("id", id)
      .maybeSingle();

    if (studentRes.error || !studentRes.data) {
      return null;
    }

    const student = studentRes.data as {
      id: string;
      user_id: string | null;
      class_id: string | null;
      student_type: "online" | "offline" | null;
      roll_number: string | null;
    };

    if (student.roll_number) {
      const existing = String(student.roll_number);
      if (student.user_id) {
        await supabase
          .from("profiles")
          .update({ roll_number: existing })
          .eq("id", student.user_id)
          .eq("role", "student");
      }
      return existing;
    }

    if (student.user_id) {
      try {
        const fromUser = await this.ensureRollNumberForUser(String(student.user_id));
        if (fromUser) {
          return fromUser;
        }
      } catch {
        // fall through to class-based assignment
      }
    }

    if (!student.class_id) {
      return null;
    }

    const rpc = await supabase.rpc("assign_roll_for_class", {
      p_class_id: student.class_id,
      p_student_type: student.student_type ?? "online",
    });
    if (rpc.error || !rpc.data) {
      return null;
    }

    const rollNumber = String(rpc.data);
    await supabase
      .from("students")
      .update({ roll_number: rollNumber })
      .eq("id", student.id);

    if (student.user_id) {
      await supabase
        .from("profiles")
        .update({ roll_number: rollNumber })
        .eq("id", student.user_id);

      try {
        await pushNotificationService.sendToUser({
          userId: String(student.user_id),
          title: "Roll Number Allotted",
          body: `Your roll number is ${rollNumber}.`,
          data: {
            type: "roll_allotted",
            rollNumber,
          },
        });
      } catch {
        // Notification dispatch should not break roll assignment.
      }
    }

    return rollNumber;
  },

  async getStudents(
    input: FetchStudentsInput
  ): Promise<PaginatedResult<TeacherStudent>> {
    const search = (input.search ?? "").trim();
    const filter = input.filter ?? "all";
    const classId = (input.class_id ?? "").trim();
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.max(1, input.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const classFilterIds = classId
      ? await resolveClassFilterIds(classId)
      : [];

    let studentQuery = supabase
      .from("students")
      .select(
        "id, user_id, name, roll_number, phone, class_id, category, student_type, admission_paid, app_access_paid, admission_date, created_at, classes(name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filter !== "all") {
      studentQuery = studentQuery.eq("student_type", filter);
    }
    if (classFilterIds.length === 1) {
      studentQuery = studentQuery.eq("class_id", classFilterIds[0]);
    } else if (classFilterIds.length > 1) {
      studentQuery = studentQuery.in("class_id", classFilterIds);
    }

    if (search) {
      const escaped = search.replace(/,/g, "");
      studentQuery = studentQuery.or(
        `name.ilike.%${escaped}%,roll_number.ilike.%${escaped}%`
      );
    }

    const studentsRes = await studentQuery;
    if (!studentsRes.error && studentsRes.data) {
      const rows = studentsRes.data.map(normalizeFromStudents);
      if (page !== 1 || rows.length >= pageSize) {
        return {
          rows,
          total: studentsRes.count ?? 0,
          page,
          pageSize,
        };
      }

      // Include profile-only students (rare desync) so newly signed-up users are not hidden.
      let profileRepairQuery = supabase
        .from("profiles")
        .select(
          "id, name, roll_number, phone, class, program_type, student_type, admission_paid, app_access_paid, created_at",
          { count: "exact" }
        )
        .eq("role", "student")
        .order("created_at", { ascending: false })
        .limit(Math.max(pageSize * 2, 40));

      if (filter !== "all") {
        profileRepairQuery = profileRepairQuery.eq("student_type", filter);
      }
      if (classFilterIds.length === 1) {
        profileRepairQuery = profileRepairQuery.eq("class", classFilterIds[0]);
      } else if (classFilterIds.length > 1) {
        profileRepairQuery = profileRepairQuery.in("class", classFilterIds);
      }
      if (search) {
        const escaped = search.replace(/,/g, "");
        profileRepairQuery = profileRepairQuery.or(
          `name.ilike.%${escaped}%,roll_number.ilike.%${escaped}%`
        );
      }

      const profilesRepairRes = await profileRepairQuery;
      if (profilesRepairRes.error || !profilesRepairRes.data?.length) {
        return {
          rows,
          total: studentsRes.count ?? rows.length,
          page,
          pageSize,
        };
      }

      const studentUserIds = new Set(
        rows
          .map((row) => String(row.user_id ?? "").trim())
          .filter(Boolean)
      );
      const profileExtras = profilesRepairRes.data
        .map(normalizeFromProfiles)
        .filter((row) => !studentUserIds.has(String(row.id)));

      const mergedRows = [...profileExtras, ...rows].slice(0, pageSize);
      return {
        rows: mergedRows,
        total: (studentsRes.count ?? rows.length) + profileExtras.length,
        page,
        pageSize,
      };
    }

    let profileQuery = supabase
      .from("profiles")
      .select(
        "id, name, roll_number, phone, class, program_type, student_type, admission_paid, app_access_paid, created_at",
        { count: "exact" }
      )
      .eq("role", "student")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filter !== "all") {
      profileQuery = profileQuery.eq("student_type", filter);
    }
    if (classFilterIds.length === 1) {
      profileQuery = profileQuery.eq("class", classFilterIds[0]);
    } else if (classFilterIds.length > 1) {
      profileQuery = profileQuery.in("class", classFilterIds);
    }

    if (search) {
      const escaped = search.replace(/,/g, "");
      profileQuery = profileQuery.or(
        `name.ilike.%${escaped}%,roll_number.ilike.%${escaped}%`
      );
    }

    const profilesRes = await profileQuery;
    if (profilesRes.error || !profilesRes.data) {
      return { rows: [], total: 0, page, pageSize };
    }

    return {
      rows: profilesRes.data.map(normalizeFromProfiles),
      total: profilesRes.count ?? 0,
      page,
      pageSize,
    };
  },

  async getStudentCounts(): Promise<{
    total: number;
    online: number;
    offline: number;
  }> {
    const countFromStudents = (filters?: {
      student_type?: "online" | "offline";
    }) => {
      let query = supabase
        .from("students")
        .select("id", { count: "exact", head: true });

      if (filters?.student_type) {
        query = query.eq("student_type", filters.student_type);
      }

      return query;
    };

    const [totalRes, onlineRes, offlineRes] = await Promise.all([
      countFromStudents(),
      countFromStudents({ student_type: "online" }),
      countFromStudents({ student_type: "offline" }),
    ]);

    if (!totalRes.error && !onlineRes.error && !offlineRes.error) {
      return {
        total: totalRes.count ?? 0,
        online: onlineRes.count ?? 0,
        offline: offlineRes.count ?? 0,
      };
    }

    const countFromProfiles = (filters?: {
      student_type?: "online" | "offline";
    }) => {
      let query = supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student");

      if (filters?.student_type) {
        query = query.eq("student_type", filters.student_type);
      }

      return query;
    };

    const [total, online, offline] =
      await Promise.all([
        countFromProfiles(),
        countFromProfiles({ student_type: "online" }),
        countFromProfiles({ student_type: "offline" }),
      ]);

    return {
      total: total.count ?? 0,
      online: online.count ?? 0,
      offline: offline.count ?? 0,
    };
  },

  async updateStudent(
    studentId: string,
    updates: UpdateStudentInput
  ): Promise<void> {
    const shouldEnsureRoll =
      updates.admission_paid === true || updates.app_access_paid === true;
    const studentsPayload: Record<string, unknown> = {};
    const existingStudent = await supabase
      .from("students")
      .select("user_id")
      .eq("id", studentId)
      .maybeSingle();
    const linkedUserId =
      !existingStudent.error && existingStudent.data?.user_id
        ? String(existingStudent.data.user_id)
        : null;

    if (updates.name !== undefined) studentsPayload.name = updates.name;
    if (updates.roll_number !== undefined) {
      studentsPayload.roll_number = normalizeRollNumber(updates.roll_number);
    }
    if (updates.phone !== undefined) studentsPayload.phone = updates.phone;
    if (updates.class_id !== undefined) studentsPayload.class_id = updates.class_id;
    if (updates.student_type !== undefined) {
      studentsPayload.student_type = updates.student_type;
    }
    if (updates.admission_paid !== undefined) {
      studentsPayload.admission_paid = updates.admission_paid;
    }
    if (updates.app_access_paid !== undefined) {
      studentsPayload.app_access_paid = updates.app_access_paid;
    }
    if (updates.category !== undefined) {
      studentsPayload.category = updates.category;
    }

    const studentsUpdate = await supabase
      .from("students")
      .update(studentsPayload)
      .eq("id", studentId);

    if (!studentsUpdate.error) {
      if (linkedUserId) {
        const profilePayload: Record<string, unknown> = {};
        if (updates.name !== undefined) profilePayload.name = updates.name;
        if (updates.roll_number !== undefined) {
          profilePayload.roll_number = normalizeRollNumber(updates.roll_number);
        }
        if (updates.phone !== undefined) profilePayload.phone = updates.phone;
        if (updates.class_id !== undefined) profilePayload.class = updates.class_id;
        if (updates.student_type !== undefined) {
          profilePayload.student_type = updates.student_type;
        }
        if (updates.admission_paid !== undefined) {
          profilePayload.admission_paid = updates.admission_paid;
        }
        if (updates.app_access_paid !== undefined) {
          profilePayload.app_access_paid = updates.app_access_paid;
        }
        if (updates.category !== undefined) {
          profilePayload.program_type = updates.category;
        }

        if (Object.keys(profilePayload).length) {
          const profileSync = await supabase
            .from("profiles")
            .update(profilePayload)
            .eq("id", linkedUserId)
            .eq("role", "student");
          if (profileSync.error) {
            throw new Error(profileSync.error.message || "Failed to sync student profile");
          }
        }
      }

      if (shouldEnsureRoll) {
        await this.ensureRollNumberForStudentId(studentId);
      }
      return;
    }

    const profilePayload: Record<string, unknown> = {};
    if (updates.name !== undefined) profilePayload.name = updates.name;
    if (updates.roll_number !== undefined) {
      profilePayload.roll_number = normalizeRollNumber(updates.roll_number);
    }
    if (updates.phone !== undefined) profilePayload.phone = updates.phone;
    if (updates.class_id !== undefined) profilePayload.class = updates.class_id;
    if (updates.student_type !== undefined) profilePayload.student_type = updates.student_type;
    if (updates.admission_paid !== undefined) profilePayload.admission_paid = updates.admission_paid;
    if (updates.app_access_paid !== undefined) profilePayload.app_access_paid = updates.app_access_paid;
    if (updates.category !== undefined) profilePayload.program_type = updates.category;

    const profileUpdate = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("id", studentId)
      .eq("role", "student");

    if (profileUpdate.error) {
      throw new Error(
        profileUpdate.error.message || studentsUpdate.error.message || "Failed to update student"
      );
    }

    if (shouldEnsureRoll) {
      await this.ensureRollNumberForUser(studentId);
    }
  },

  async getStudentAccess(input: {
    studentId: string;
    userId?: string | null;
  }): Promise<{ is_active: boolean; expires_at: string | null } | null> {
    const userId = String(input.userId ?? "").trim();
    if (!userId) return null;

    const { data, error } = await supabase
      .from("subscriptions")
      .select("is_active, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      is_active: Boolean(data.is_active),
      expires_at: data.expires_at ?? null,
    };
  },

  async setStudentAccess(input: {
    studentId?: string | null;
    userId?: string | null;
    isActive: boolean;
    expiresAt: string | null;
    planCode?: string | null;
  }): Promise<void> {
    const studentId = String(input.studentId ?? "").trim();
    const userId = String(input.userId ?? "").trim();
    if (!userId) {
      throw new Error("Student signup not linked yet. Access can be set after student login/signup.");
    }

    const expiresAt =
      input.expiresAt && /^\d{4}-\d{2}-\d{2}$/.test(input.expiresAt.trim())
        ? `${input.expiresAt.trim()}T23:59:59.000Z`
        : null;

    const upsert = await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        is_active: input.isActive,
        expires_at: expiresAt,
        plan_type: "online",
        plan_code: input.planCode ?? null,
      },
      { onConflict: "user_id" }
    );

    if (upsert.error) {
      throw new Error(upsert.error.message || "Unable to update student access");
    }

    const accessPayload: Record<string, unknown> = {};
    if (input.isActive) {
      accessPayload.admission_paid = true;
    }

    const studentUpdate = studentId
      ? supabase.from("students").update(accessPayload).eq("id", studentId)
      : supabase.from("students").update(accessPayload).eq("user_id", userId);

    await Promise.all([
      studentUpdate,
      supabase.from("profiles").update(accessPayload).eq("id", userId),
    ]);

    if (input.isActive) {
      if (studentId) {
        await this.ensureRollNumberForStudentId(studentId);
      } else {
        await this.ensureRollNumberForUser(userId);
      }
    }
  },

  async createStudent(input: CreateStudentInput): Promise<void> {
    const normalizedPhone = normalizePhone(input.phone);
    const payload: Record<string, unknown> = {
      name: input.name.trim(),
      phone: normalizedPhone,
      class_id: input.class_id,
      category: input.category,
      student_type: input.student_type,
      admission_paid: Boolean(input.admission_paid),
      roll_number:
        normalizeRollNumber(input.roll_number)
          ? normalizeRollNumber(input.roll_number)
          : null,
      admission_date: new Date().toISOString().slice(0, 10),
    };

    if (!payload.name) {
      throw new Error("Student name is required");
    }
    if (!payload.class_id) {
      throw new Error("Class is required");
    }

    let linkedUserId: string | null = null;
    if (normalizedPhone) {
      const profileMatch = await supabase
        .from("profiles")
        .select("id, roll_number")
        .eq("role", "student")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (!profileMatch.error && profileMatch.data?.id) {
        linkedUserId = String(profileMatch.data.id);
        payload.user_id = linkedUserId;
        if (!payload.roll_number && profileMatch.data.roll_number) {
          payload.roll_number = normalizeRollNumber(
            String(profileMatch.data.roll_number)
          );
        }
      }
    }

    if (linkedUserId) {
      const existingByUser = await supabase
        .from("students")
        .select("id")
        .eq("user_id", linkedUserId)
        .maybeSingle();

      if (!existingByUser.error && existingByUser.data?.id) {
        const updateRes = await supabase
          .from("students")
          .update(payload)
          .eq("id", existingByUser.data.id);
        if (updateRes.error) {
          throw new Error(updateRes.error.message || "Unable to link student profile");
        }

        await supabase
          .from("profiles")
          .update({
            class: payload.class_id as string,
            student_type: payload.student_type as string,
            admission_paid: Boolean(payload.admission_paid),
          })
          .eq("id", linkedUserId)
          .eq("role", "student");
        return;
      }
    }

    if (!payload.roll_number) {
      const nextRoll = await supabase.rpc("assign_roll_for_class", {
        p_class_id: payload.class_id as string,
        p_student_type: "online",
      });
      if (!nextRoll.error && nextRoll.data) {
        payload.roll_number = String(nextRoll.data);
      }

      const config = await this.getRollConfig(payload.class_id as string);
      if (!config) {
        await this.upsertRollConfig({
          class_id: payload.class_id as string,
          start: 10001,
        });
      }
    }

    const { error } = await supabase.from("students").insert(payload);

    if (error) {
      const message = error.message ?? "Unable to create student";
      if (
        message.toLowerCase().includes("duplicate key") &&
        message.toLowerCase().includes("roll")
      ) {
        const retryRoll = await supabase.rpc("assign_roll_for_class", {
          p_class_id: payload.class_id as string,
          p_student_type: "online",
        });
        if (!retryRoll.error && retryRoll.data) {
          const retry = await supabase.from("students").insert({
            ...payload,
            roll_number: String(retryRoll.data),
          });
          if (!retry.error) return;
          throw new Error(retry.error.message || "Unable to create student");
        }
      }
      if (message.toLowerCase().includes("roll number config missing")) {
        await this.upsertRollConfig({
          class_id: payload.class_id as string,
          start: 10001,
        });
        const retry = await supabase.from("students").insert(payload);
        if (!retry.error) {
          return;
        }
        throw new Error(retry.error.message || "Unable to create student");
      }
      throw new Error(error.message || "Unable to create student");
    }

    if (linkedUserId) {
      await supabase
        .from("profiles")
        .update({
          class: payload.class_id as string,
          student_type: payload.student_type as string,
          admission_paid: Boolean(payload.admission_paid),
          roll_number:
            typeof payload.roll_number === "string" && payload.roll_number
              ? String(payload.roll_number)
              : null,
        })
        .eq("id", linkedUserId)
        .eq("role", "student");
    }
  },

  async markAdmissionPaid(studentId: string): Promise<void> {
    const studentsUpdate = await supabase
      .from("students")
      .update({ admission_paid: true })
      .eq("id", studentId);

    if (!studentsUpdate.error) {
      await this.ensureRollNumberForStudentId(studentId);
      return;
    }

    const profileUpdate = await supabase
      .from("profiles")
      .update({ admission_paid: true })
      .eq("id", studentId)
      .eq("role", "student");

    if (profileUpdate.error) {
      throw new Error(
        profileUpdate.error.message || studentsUpdate.error.message || "Unable to mark admission paid"
      );
    }

    await this.ensureRollNumberForUser(studentId);
  },

  async setAppAccessPaidForUser(userId: string, paymentId: string): Promise<void> {
    const uid = String(userId ?? "").trim();
    const pid = String(paymentId ?? "").trim();
    if (!uid || !pid) {
      throw new Error("Payment verification required.");
    }

    const rpc = await supabase.rpc("verify_app_access_payment", { p_payment_id: pid });
    if (!rpc.error && rpc.data === true) {
      return;
    }

    const allowFallback =
      String(process.env.EXPO_PUBLIC_DEV_TEST_PAYMENTS ?? "").toLowerCase() === "true";
    if (!allowFallback) {
      throw new Error(rpc.error?.message || "Payment verification failed.");
    }

    const [profileUpdate, studentUpdate] = await Promise.all([
      supabase
        .from("profiles")
        .update({ app_access_paid: true })
        .eq("id", uid)
        .eq("role", "student"),
      supabase.from("students").update({ app_access_paid: true }).eq("user_id", uid),
    ]);

    if (profileUpdate.error && studentUpdate.error) {
      throw new Error(
        profileUpdate.error?.message ||
          studentUpdate.error?.message ||
          rpc.error?.message ||
          "Payment verification failed."
      );
    }

    await this.ensureRollNumberForUser(uid);
  },

  async setAdmissionPaidForUser(userId: string): Promise<void> {
    const uid = String(userId ?? "").trim();
    if (!uid) return;

    await Promise.all([
      supabase
        .from("profiles")
        .update({ admission_paid: true })
        .eq("id", uid)
        .eq("role", "student"),
      supabase
        .from("students")
        .update({ admission_paid: true })
        .eq("user_id", uid),
    ]);

    await this.ensureRollNumberForUser(uid);
  },

  async deleteStudent(studentId: string): Promise<void> {
    const studentDelete = await supabase
      .from("students")
      .delete()
      .eq("id", studentId);

    if (!studentDelete.error) {
      return;
    }

    const profileDelete = await supabase
      .from("profiles")
      .delete()
      .eq("id", studentId)
      .eq("role", "student");

    if (profileDelete.error) {
      throw new Error(
        profileDelete.error.message ||
          studentDelete.error.message ||
          "Unable to delete student"
      );
    }
  },

  async getRollConfig(classId: string): Promise<{
    start: number;
    next: number;
  } | null> {
    const classIds = await resolveClassFilterIds(classId);
    const targetIds = classIds.length ? classIds : [classId];

    const { data, error } = await supabase
      .from("roll_number_configs")
      .select(
        "class_id, online_start, online_next, updated_at"
      )
      .in("class_id", targetIds)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error || !data?.length) {
      return null;
    }

    const row = data[0] as any;
    return {
      start: Number(row.online_start ?? 10001),
      next: Number(row.online_next ?? 10001),
    };
  },

  async upsertRollConfig(input: {
    class_id: string;
    start: number;
  }): Promise<void> {
    const start = Number(input.start || 10001);
    const classIds = await resolveClassFilterIds(input.class_id);
    const targetIds = classIds.length ? classIds : [input.class_id];

    const { error } = await supabase
      .from("roll_number_configs")
      .upsert(
        targetIds.map((classId) => ({
          class_id: classId,
          online_start: start,
          online_next: start,
          offline_start: start,
          offline_next: start,
        })),
        { onConflict: "class_id" }
      );

    if (error) {
      throw new Error(error.message || "Unable to save roll config");
    }
  },

  async ensureRollNumberForUser(userId: string): Promise<string | null> {
    const uid = String(userId ?? "").trim();
    if (!uid) return null;

    const byStudent = await supabase
      .from("students")
      .select("id, user_id, class_id, roll_number")
      .eq("user_id", uid)
      .maybeSingle();

    if (!byStudent.error && byStudent.data?.roll_number) {
      const roll = String(byStudent.data.roll_number);
      await supabase
        .from("profiles")
        .update({ roll_number: roll })
        .eq("id", uid)
        .eq("role", "student");
      return roll;
    }

    if (!byStudent.data || byStudent.error) {
      const profileRes = await supabase
        .from("profiles")
        .select(
          "id, name, phone, class, program_type, student_type, admission_paid, app_access_paid, roll_number, created_at"
        )
        .eq("id", uid)
        .eq("role", "student")
        .maybeSingle();

      if (!profileRes.error && profileRes.data) {
        const profile = profileRes.data as any;
        const classId = String(profile.class ?? "").trim();
        const hasClassId =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            classId
          );

        if (hasClassId) {
          await supabase.from("students").upsert(
            {
              user_id: uid,
              name: String(profile.name ?? "Student"),
              phone: profile.phone ?? null,
              class_id: classId,
              category:
                profile.program_type === "competitive"
                  ? "competitive"
                  : "school",
              student_type:
                profile.student_type === "offline" ? "offline" : "online",
              admission_paid: Boolean(profile.admission_paid),
              app_access_paid: Boolean(profile.app_access_paid),
              roll_number: normalizeRollNumber(profile.roll_number),
              admission_date: profile.created_at
                ? new Date(profile.created_at).toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10),
            },
            { onConflict: "user_id" }
          );
        } else if (profile.roll_number) {
          return String(profile.roll_number);
        }
      }
    }

    const rpc = await supabase.rpc("assign_roll_for_user", { p_user_id: uid });
    if (rpc.error) {
      throw new Error(rpc.error.message || "Unable to assign roll number");
    }

    const check = await supabase
      .from("students")
      .select("roll_number")
      .eq("user_id", uid)
      .maybeSingle();

    if (check.error || !check.data?.roll_number) {
      return null;
    }
    const roll = String(check.data.roll_number);
    await supabase
      .from("profiles")
      .update({ roll_number: roll })
      .eq("id", uid)
      .eq("role", "student");
    return roll;
  },
};
