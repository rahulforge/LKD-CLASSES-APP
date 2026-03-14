import { supabase } from "../../lib/supabase";

export type ClassFeeConfig = {
  class_id: string;
  monthly_fee: number;
  test_fee?: number;
  updated_at?: string | null;
};

const CLASS_CACHE_TTL = 5 * 60 * 1000;
let classCache: { time: number; rows: { id: string; name: string }[] } | null = null;
const feeCache = new Map<string, { time: number; data: ClassFeeConfig }>();
const normalizeClassName = (value: string) =>
  String(value ?? "").toLowerCase().replace(/\s+/g, "");
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "")
  );

const normalize = (row: any): ClassFeeConfig => ({
  class_id: String(row.class_id),
  monthly_fee: Number(row.monthly_fee ?? 0),
  test_fee:
    row?.test_fee === undefined || row?.test_fee === null
      ? Number(row.monthly_fee ?? 0)
      : Number(row.test_fee ?? 0),
  updated_at: row.updated_at ?? null,
});

export const classFeeService = {
  async resolveClassId(input: string): Promise<string> {
    const raw = String(input ?? "").trim();
    if (!raw) return raw;
    if (isUuid(raw)) return raw;

    const normalized = raw.toLowerCase().replace(/\s+/g, "");
    let rows = classCache;
    if (!rows || Date.now() - rows.time > CLASS_CACHE_TTL) {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(200);
      if (error || !data?.length) return raw;
      rows = { time: Date.now(), rows: data as any[] };
      classCache = rows;
    }

    const match = rows.rows.find((row: any) => {
      const name = normalizeClassName(row.name);
      return name === normalized || name.endsWith(normalized) || normalized.endsWith(name);
    });
    return match?.id ? String(match.id) : raw;
  },

  async resolveClassCandidates(input: string): Promise<string[]> {
    const raw = String(input ?? "").trim();
    if (!raw) return [];

    let rows = classCache;
    if (!rows || Date.now() - rows.time > CLASS_CACHE_TTL) {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(200);
      if (!error && data?.length) {
        rows = { time: Date.now(), rows: data as any[] };
        classCache = rows;
      }
    }

    if (!rows?.rows?.length) return [raw];

    const normalizedTarget = (() => {
      if (!isUuid(raw)) return normalizeClassName(raw);
      const row = rows.rows.find((item) => String(item.id) === raw);
      return row ? normalizeClassName(String(row.name ?? "")) : "";
    })();

    if (!normalizedTarget) return [raw];
    const ids = rows.rows
      .filter((row) => normalizeClassName(row.name) === normalizedTarget)
      .map((row) => String(row.id));
    if (!ids.includes(raw)) ids.push(raw);
    return Array.from(new Set(ids));
  },

  async getClassFeeConfig(classId: string): Promise<ClassFeeConfig | null> {
    const resolvedId = await this.resolveClassId(classId);
    const cached = feeCache.get(resolvedId);
    if (cached && Date.now() - cached.time < CLASS_CACHE_TTL) {
      return cached.data;
    }
    const candidates = await this.resolveClassCandidates(resolvedId);
    const uuidCandidates = Array.from(
      new Set(candidates.filter((item) => isUuid(String(item ?? ""))))
    );
    if (!uuidCandidates.length && isUuid(resolvedId)) {
      uuidCandidates.push(resolvedId);
    }
    if (!uuidCandidates.length) {
      return null;
    }

    let query = supabase
      .from("class_fee_configs")
      .select("class_id, monthly_fee, test_fee, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (uuidCandidates.length === 1) {
      query = query.eq("class_id", uuidCandidates[0]);
    } else {
      query = query.in("class_id", uuidCandidates);
    }
    let { data, error } = await query.maybeSingle();
    if (error) {
      const msg = String(error.message ?? "").toLowerCase();
      if (msg.includes("test_fee") && msg.includes("column")) {
        let fallbackQuery = supabase
          .from("class_fee_configs")
          .select("class_id, monthly_fee, updated_at")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (uuidCandidates.length === 1) {
          fallbackQuery = fallbackQuery.eq("class_id", uuidCandidates[0]);
        } else {
          fallbackQuery = fallbackQuery.in("class_id", uuidCandidates);
        }
        const fallback = await fallbackQuery.maybeSingle();
        data = fallback.data as any;
        error = fallback.error;
      }
    }

    if ((!data || error) && uuidCandidates.length) {
      for (const classUuid of uuidCandidates) {
        const rpc = await supabase.rpc("get_class_fee_config", { p_class_id: classUuid });
        if (rpc.error || !Array.isArray(rpc.data) || !rpc.data.length) continue;
        data = rpc.data[0] as any;
        error = null;
        break;
      }
    }

    if (error || !data) return null;
    const normalized = normalize(data);
    feeCache.set(resolvedId, { time: Date.now(), data: normalized });
    return normalized;
  },

  async upsertClassFeeConfig(input: ClassFeeConfig): Promise<void> {
    const monthlyFee = Math.max(0, Number(input.monthly_fee || 0));
    const testFee =
      input.test_fee === undefined || input.test_fee === null
        ? undefined
        : Math.max(0, Number(input.test_fee || 0));
    const payload: Record<string, unknown> = {
      class_id: input.class_id,
      monthly_fee: monthlyFee,
    };
    if (testFee !== undefined) {
      payload.test_fee = testFee;
    }

    const writePayload = { ...payload };
    const runUpdate = async () =>
      supabase
        .from("class_fee_configs")
        .update(writePayload)
        .eq("class_id", input.class_id)
        .select("class_id")
        .maybeSingle();
    const runInsert = async () =>
      supabase
        .from("class_fee_configs")
        .insert(writePayload)
        .select("class_id")
        .maybeSingle();

    let updated = await runUpdate();
    if (
      updated.error &&
      String(updated.error.message ?? "").toLowerCase().includes("test_fee") &&
      String(updated.error.message ?? "").toLowerCase().includes("column")
    ) {
      delete writePayload.test_fee;
      updated = await runUpdate();
    }
    if (updated.error) {
      throw new Error(updated.error.message || "Unable to save class fee config");
    }

    if (!updated.data) {
      let inserted = await runInsert();
      if (
        inserted.error &&
        String(inserted.error.message ?? "").toLowerCase().includes("test_fee") &&
        String(inserted.error.message ?? "").toLowerCase().includes("column")
      ) {
        delete writePayload.test_fee;
        inserted = await runInsert();
      }
      if (inserted.error) {
        throw new Error(inserted.error.message || "Unable to save class fee config");
      }
    }
    feeCache.delete(input.class_id);
  },
};
