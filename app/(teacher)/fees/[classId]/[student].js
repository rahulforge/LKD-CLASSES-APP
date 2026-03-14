import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { classFeeService } from "../../../../src/services/classFeeService";
import { paymentService } from "../../../../src/services/paymentService";
import { studentService } from "../../../../src/services/studentService";
import { toastService } from "../../../../src/services/toastService";
import { APP_THEME } from "../../../../src/utils/constants";

const formatRoll = (roll) => {
  const raw = String(roll ?? "");
  const digits = raw.match(/\d+/g)?.join("") ?? "";
  return digits || raw || "-";
};

export default function StudentFeesDetail() {
  const { classId, student, roll, name } = useLocalSearchParams();
  const resolvedClassId = String(classId ?? "");
  const studentId = String(student ?? "");
  const seedRoll = decodeURIComponent(String(roll ?? ""));
  const seedName = decodeURIComponent(String(name ?? "Student"));
  const insets = useSafeAreaInsets();

  const [studentName, setStudentName] = useState(seedName);
  const [rollNo, setRollNo] = useState(seedRoll);
  const [joinedAt, setJoinedAt] = useState("");
  const [rows, setRows] = useState([]);
  const [feeConfig, setFeeConfig] = useState({
    monthly_fee: 0,
  });
  const [amount, setAmount] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [saving, setSaving] = useState(false);

  const monthlyRows = useMemo(() => {
    const allowed = new Set(["", "offline_monthly", "online_monthly", "monthly_fee"]);
    return rows.filter((r) => {
      const kind = String(r.payment_kind || "").toLowerCase();
      return allowed.has(kind);
    });
  }, [rows]);

  const summary = useMemo(() => {
    const monthly = Number(feeConfig.monthly_fee || 0);
    const paidByMonth = new Map();
    for (const r of monthlyRows) {
      const key = String(r.paid_month || r.paid_date || "").slice(0, 7);
      if (!key) continue;
      const prev = Number(paidByMonth.get(key) || 0);
      const amount = Number(r.amount || 0);
      const mode = String(r.payment_mode || "").toLowerCase();
      const effective = amount > 0 ? amount : mode === "promo" && monthly > 0 ? monthly : 0;
      paidByMonth.set(key, prev + effective);
    }
    let paidMonths = 0;
    if (monthly > 0) {
      for (const value of paidByMonth.values()) {
        if (Number(value) >= monthly) paidMonths += 1;
      }
    }
    const total = monthlyRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { paidMonths, total };
  }, [monthlyRows, feeConfig.monthly_fee]);

  const monthPending = useMemo(() => {
    if (!joinedAt) return 0;
    const start = new Date(joinedAt);
    if (Number.isNaN(start.getTime())) return 0;
    const now = new Date();
    const totalMonths =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth()) +
      1;
    return Math.max(0, totalMonths - summary.paidMonths);
  }, [joinedAt, summary.paidMonths]);

  const dueAmount = useMemo(() => {
    if (!joinedAt) return 0;
    const monthly = Number(feeConfig.monthly_fee || 0);
    if (!monthly) return 0;
    const paidByMonth = new Map();
    for (const row of monthlyRows) {
      const key = String(row.paid_month || row.paid_date || "").slice(0, 7);
      if (!key) continue;
      const prev = Number(paidByMonth.get(key) || 0);
      const amount = Number(row.amount || 0);
      const mode = String(row.payment_mode || "").toLowerCase();
      const effective = amount > 0 ? amount : mode === "promo" && monthly > 0 ? monthly : 0;
      paidByMonth.set(key, prev + effective);
    }

    const start = new Date(joinedAt);
    if (Number.isNaN(start.getTime())) return 0;
    const now = new Date();
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let due = 0;
    while (cursor <= now) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const paid = Number(paidByMonth.get(key) || 0);
      due += Math.max(0, monthly - paid);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return Math.max(0, Math.round(due));
  }, [feeConfig.monthly_fee, joinedAt, monthlyRows]);

  const monthStatus = useMemo(() => {
    if (!joinedAt) return [];
    const start = new Date(joinedAt);
    if (Number.isNaN(start.getTime())) return [];
    const from = new Date(start.getFullYear(), start.getMonth(), 1);
    const now = new Date();
    const monthly = Number(feeConfig.monthly_fee || 0);
    const paidByMonth = new Map();
    for (const r of monthlyRows) {
      const key = String(r.paid_month || r.paid_date || "").slice(0, 7);
      if (!key) continue;
      const prev = Number(paidByMonth.get(key) || 0);
      const amount = Number(r.amount || 0);
      const mode = String(r.payment_mode || "").toLowerCase();
      const effective = amount > 0 ? amount : mode === "promo" && monthly > 0 ? monthly : 0;
      paidByMonth.set(key, prev + effective);
    }
    let maxDate = new Date(now.getFullYear(), now.getMonth(), 1);
    for (const key of paidByMonth.keys()) {
      const [y, m] = String(key).split("-").map(Number);
      if (!y || !m) continue;
      const dt = new Date(y, m - 1, 1);
      if (dt > maxDate) maxDate = dt;
    }

    const out = [];
    const cursor = new Date(from);
    while (cursor <= maxDate) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const paidAmount = Number(paidByMonth.get(key) || 0);
      let status = "PENDING";
      if (paidAmount > 0 && monthly > 0) {
        status = paidAmount >= monthly ? "PAID" : "PARTIAL";
      }
      out.push({
        key,
        label: cursor.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        status,
        paidAmount,
        due: monthly > 0 ? Math.max(0, monthly - paidAmount) : 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out.reverse();
  }, [joinedAt, monthlyRows, feeConfig.monthly_fee]);

  const load = useCallback(async () => {
    if (!rollNo) return;
    const data = await paymentService.getPaymentTrackingByRoll(rollNo, 1, 100);
    setRows(data.rows);
  }, [rollNo]);

  useEffect(() => {
    let mounted = true;
    const loadStudent = async () => {
      if (!resolvedClassId || !studentId) return;
      const list = await studentService.getStudents({
        class_id: resolvedClassId,
        filter: "all",
        page: 1,
        pageSize: 200,
      });
      const s = list.rows.find((item) => item.id === studentId);
      if (!mounted || !s) return;
      setStudentName(s.name);
      setRollNo(s.roll_number || "");
      setJoinedAt(s.joined_at || "");
    };
    void loadStudent();
    return () => {
      mounted = false;
    };
  }, [resolvedClassId, studentId]);

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      if (!resolvedClassId) return;
      const cfg = await classFeeService.getClassFeeConfig(resolvedClassId);
      if (!mounted || !cfg) return;
      setFeeConfig({
        monthly_fee: cfg.monthly_fee,
      });
      setAmount((prev) => prev || String(cfg.monthly_fee || 0));
    };
    void loadConfig();
    return () => {
      mounted = false;
    };
  }, [resolvedClassId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!rollNo) {
      toastService.error("Missing", "Roll number not found.");
      return;
    }
    const defaultAmount = Number(feeConfig.monthly_fee || 0);
    const parsedAmount = Number(amount || 0);
    const finalAmount = parsedAmount > 0 ? parsedAmount : defaultAmount;
    if (!finalAmount || finalAmount <= 0) {
      toastService.error("Missing", "Enter valid amount.");
      return;
    }
    setSaving(true);
    try {
      await paymentService.upsertPaymentTracking({
        roll_number: rollNo,
        amount: finalAmount,
        status: "success",
        paid_month: `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}-01`,
        paid_date: new Date().toISOString().slice(0, 10),
        payment_mode: "offline",
        payment_kind: "offline_monthly",
      });
      setAmount(defaultAmount ? String(defaultAmount) : "");
      await load();
      toastService.success("Saved", "Monthly fee entry added.");
    } catch (error) {
      toastService.error("Failed", error?.message ?? "Unable to save fee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.heading}>{studentName}</Text>
      <Text style={styles.meta}>Roll No: {formatRoll(rollNo)}</Text>
      {!!joinedAt && <Text style={styles.meta}>Joined: {new Date(joinedAt).toLocaleDateString("en-IN")}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly Summary</Text>
        <Text style={styles.row}>Monthly fee: Rs. {feeConfig.monthly_fee}</Text>
        <Text style={styles.row}>Paid months: {summary.paidMonths}</Text>
        <Text style={styles.row}>Total paid: Rs. {summary.total}</Text>
        <Text style={styles.row}>Pending months: {monthPending}</Text>
        <Text style={[styles.row, styles.dueText]}>Estimated due: Rs. {dueAmount}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Monthly Payment</Text>
        <View style={styles.monthRow}>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() =>
              setSelectedMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
          >
            <Text style={styles.monthBtnText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {selectedMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </Text>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() =>
              setSelectedMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
          >
            <Text style={styles.monthBtnText}>Next</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Amount"
          placeholderTextColor={APP_THEME.muted}
        />
        <TouchableOpacity style={styles.saveBtn} disabled={saving} onPress={save}>
          <Text style={styles.saveText}>{saving ? "Saving..." : "Save Entry"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Month Wise Status</Text>
        {monthStatus.map((m) => (
          <View key={m.key} style={styles.entryRow}>
            <Text style={styles.entryDate}>{m.label}</Text>
            <Text style={styles.entryMeta}>
              {m.status === "PAID"
                ? `Paid (Rs.${Math.round(m.paidAmount || 0)})`
                : m.status === "PARTIAL"
                  ? `Partial (Paid Rs.${Math.round(m.paidAmount || 0)}, Due Rs.${Math.round(m.due || 0)})`
                  : "Pending"}
            </Text>
          </View>
        ))}
        {!monthStatus.length && <Text style={styles.empty}>No month data yet.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Entries</Text>
        {rows
          .filter((r) => String(r.payment_kind || "") !== "online_monthly")
          .map((r) => (
          <View key={r.id} style={styles.entryRow}>
            <Text style={styles.entryDate}>{r.paid_date || "-"}</Text>
            <Text style={styles.entryMeta}>
              Rs. {r.amount} | {r.paid_month || r.paid_date || "-"}
            </Text>
          </View>
        ))}
        {!rows.length && <Text style={styles.empty}>No entries yet.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly Payments (App)</Text>
        {rows
          .filter((r) => String(r.payment_kind || "") === "online_monthly")
          .map((r) => (
            <View key={r.id} style={styles.entryRow}>
              <Text style={styles.entryDate}>{r.paid_month || "-"}</Text>
              <Text style={styles.entryMeta}>
                Rs. {r.amount} | App
              </Text>
            </View>
          ))}
        {!rows.some((r) => String(r.payment_kind || "") === "online_monthly") && (
          <Text style={styles.empty}>No online monthly payments yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, paddingHorizontal: 16 },
  heading: { color: APP_THEME.text, fontSize: 19, fontWeight: "800" },
  meta: { color: APP_THEME.muted, fontSize: 12, marginBottom: 10 },
  card: { backgroundColor: APP_THEME.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTitle: { color: APP_THEME.text, fontSize: 14, fontWeight: "800", marginBottom: 8 },
  row: { color: APP_THEME.muted, fontSize: 12, marginBottom: 3 },
  dueText: { color: APP_THEME.warning, fontWeight: "700" },
  input: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
    marginBottom: 8,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthBtn: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  monthBtnText: { color: APP_THEME.text, fontSize: 11, fontWeight: "700" },
  monthText: { color: APP_THEME.text, fontSize: 12, fontWeight: "700" },
  saveBtn: { backgroundColor: APP_THEME.primary, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  saveText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
  entryRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APP_THEME.border,
    paddingVertical: 8,
  },
  entryDate: { color: APP_THEME.text, fontSize: 12, fontWeight: "700" },
  entryMeta: { color: APP_THEME.muted, fontSize: 11, marginTop: 2 },
  empty: { color: APP_THEME.muted, fontSize: 12 },
});
