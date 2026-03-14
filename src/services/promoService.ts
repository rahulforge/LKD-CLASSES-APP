import { supabase } from "../../lib/supabase";
import type { StudentType } from "../types/user";

export type PromoValidationResult = {
  valid: boolean;
  code: string | null;
  studentType: StudentType;
  discountPercent: number;
};

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

export const promoService = {
  async validatePromoCode(
    inputCode: string
  ): Promise<PromoValidationResult> {
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      return {
        valid: false,
        code: null,
        studentType: "online",
        discountPercent: 0,
      };
    }

    const { data, error } = await supabase
      .from("promo_codes")
      .select(
        "code, discount_percent, student_type, is_active"
      )
      .eq("code", code)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return {
        valid: false,
        code,
        studentType: "online",
        discountPercent: 0,
      };
    }

    return {
      valid: true,
      code: data.code,
      studentType: data.student_type as StudentType,
      discountPercent: clampPercent(data.discount_percent ?? 0),
    };
  },

  async upsertPromoCode(input: {
    code: string;
    studentType: StudentType;
    discountPercent?: number;
    classId?: string | null;
    isActive?: boolean;
  }): Promise<void> {
    const code = input.code.trim().toUpperCase();
    if (!code) {
      throw new Error("Promo code is required");
    }
    const { error } = await supabase.from("promo_codes").upsert(
      {
        code,
        student_type: input.studentType,
        discount_percent: clampPercent(input.discountPercent ?? 0),
        class_id: input.classId ?? null,
        is_active: input.isActive ?? true,
      },
      { onConflict: "code" }
    );
    if (error) {
      throw new Error(error.message || "Unable to save promo code");
    }
  },

  async listPromoCodes(limit = 50): Promise<
    {
      code: string;
      student_type: StudentType;
      discount_percent: number;
      is_active: boolean;
      class_id: string | null;
    }[]
  > {
    const { data, error } = await supabase
      .from("promo_codes")
      .select("code, student_type, discount_percent, is_active, class_id")
      .order("code", { ascending: true })
      .limit(Math.max(1, Math.min(100, limit)));
    if (error || !data) return [];
    return data as any[];
  },
};
