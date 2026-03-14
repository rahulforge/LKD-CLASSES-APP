export type UserRole = "student" | "teacher";

export type StudentType = "online" | "offline";
export type ProgramType = "school" | "competitive";

export type UserProfile = {
  id: string;
  name: string;
  phone: string | null;
  role: UserRole;
  class: string | null;
  class_name?: string | null;
  roll_number?: string | null;
  program_type: ProgramType;
  competitive_exam: string | null;
  student_type: StudentType;
  admission_paid: boolean;
  app_access_paid?: boolean;
  is_active: boolean;
  created_at: string;
};
