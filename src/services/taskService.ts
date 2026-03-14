import { supabase } from "../../lib/supabase";

export const taskService = {
  async listTasksByTeacher(teacherId?: string): Promise<
    { id: string; text: string; due_date: string | null; created_at: string | null }[]
  > {
    const id = String(teacherId ?? "").trim();
    if (!id) return [];

    const { data, error } = await supabase
      .from("student_todos")
      .select("id, text, due_date, created_at")
      .eq("created_by", id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error || !data) return [];
    const deduped = new Map<
      string,
      { id: string; text: string; due_date: string | null; created_at: string | null }
    >();
    for (const row of data as any[]) {
      const key = `${String(row.text ?? "").trim()}__${String(
        row.due_date ?? ""
      )}__${String(row.created_at ?? "")}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          id: String(row.id),
          text: String(row.text ?? ""),
          due_date: row.due_date ?? null,
          created_at: row.created_at ?? null,
        });
      }
    }
    return Array.from(deduped.values());
  },

  async updateTask(input: {
    id: string;
    text: string;
    dueDate?: string | null;
    teacherId?: string;
  }): Promise<void> {
    const id = String(input.id ?? "").trim();
    if (!id) {
      throw new Error("Task id is required");
    }

    const source = await supabase
      .from("student_todos")
      .select("id, created_by, text, due_date, created_at")
      .eq("id", id)
      .maybeSingle();
    if (source.error || !source.data) {
      throw new Error(source.error?.message || "Task not found");
    }

    let query = supabase
      .from("student_todos")
      .update({
        text: input.text.trim(),
        due_date: input.dueDate ?? null,
      })
      .eq("text", source.data.text ?? "")
      .eq("created_at", source.data.created_at ?? "");
    if (source.data.created_by) {
      query = query.eq("created_by", source.data.created_by);
    } else {
      query = query.is("created_by", null);
    }

    if (source.data.due_date) {
      query = query.eq("due_date", source.data.due_date);
    } else {
      query = query.is("due_date", null);
    }

    const teacherId = String(input.teacherId ?? "").trim();
    if (teacherId) {
      query = query.eq("created_by", teacherId);
    }

    const { error } = await query;
    if (error) {
      throw new Error(error.message || "Unable to update task");
    }
  },

  async deleteTask(input: { id: string; teacherId?: string }): Promise<void> {
    const id = String(input.id ?? "").trim();
    if (!id) return;

    const source = await supabase
      .from("student_todos")
      .select("id, created_by, text, due_date, created_at")
      .eq("id", id)
      .maybeSingle();
    if (source.error || !source.data) {
      throw new Error(source.error?.message || "Task not found");
    }

    let query = supabase
      .from("student_todos")
      .delete()
      .eq("text", source.data.text ?? "")
      .eq("created_at", source.data.created_at ?? "");
    if (source.data.created_by) {
      query = query.eq("created_by", source.data.created_by);
    } else {
      query = query.is("created_by", null);
    }
    if (source.data.due_date) {
      query = query.eq("due_date", source.data.due_date);
    } else {
      query = query.is("due_date", null);
    }
    const teacherId = String(input.teacherId ?? "").trim();
    if (teacherId) {
      query = query.eq("created_by", teacherId);
    }
    const { error } = await query;
    if (error) {
      throw new Error(error.message || "Unable to delete task");
    }
  },

  async clearAllTasksByTeacher(teacherId?: string): Promise<void> {
    const id = String(teacherId ?? "").trim();
    if (!id) return;
    const { error } = await supabase
      .from("student_todos")
      .delete()
      .eq("created_by", id);
    if (error) {
      throw new Error(error.message || "Unable to clear tasks");
    }
  },

  async createStudentTask(input: {
    text: string;
    classId?: string | null;
    programType?: "school" | "competitive" | "all";
    dueDate?: string | null;
    teacherId?: string;
  }): Promise<number> {
    const teacherId = String(input.teacherId ?? "").trim();
    if (!teacherId) {
      throw new Error("Teacher session not ready. Please reopen and try again.");
    }

    let query = supabase.from("profiles").select("id").eq("role", "student");
    if (input.classId) {
      query = query.eq("class", input.classId);
    }
    if (input.programType && input.programType !== "all") {
      query = query.eq("program_type", input.programType);
    }

    const students = await query;
    if (students.error || !students.data?.length) {
      return 0;
    }

    const batchTime = new Date().toISOString();
    const payload = students.data.map((s) => ({
      student_id: s.id,
      text: input.text.trim(),
      due_date: input.dueDate ?? null,
      created_by: teacherId,
      created_at: batchTime,
    }));

    const { error } = await supabase.from("student_todos").insert(payload);
    if (error) {
      throw new Error(error.message || "Unable to create student task");
    }
    return payload.length;
  },

  async createMockTestTask(input: {
    title: string;
    classId?: string | null;
    programType?: "school" | "competitive" | "all";
    dueDate?: string | null;
    teacherId?: string;
  }): Promise<number> {
    return this.createStudentTask({
      text: input.title,
      classId: input.classId,
      programType: input.programType,
      dueDate: input.dueDate,
      teacherId: input.teacherId,
    });
  },
};
