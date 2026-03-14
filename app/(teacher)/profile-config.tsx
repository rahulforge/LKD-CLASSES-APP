import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherClasses } from "../../src/hooks/useTeacherClasses";
import { classFeeService } from "../../src/services/classFeeService";
import { toastService } from "../../src/services/toastService";
import { studentService } from "../../src/services/studentService";
import { APP_THEME } from "../../src/utils/constants";
import { subscriptionPlanService, type SubscriptionPlan } from "../../src/services/subscriptionPlanService";
import { promoService } from "../../src/services/promoService";
import { paymentService } from "../../src/services/paymentService";

export default function ProfileConfigScreen() {
  const insets = useSafeAreaInsets();
  const { classes } = useTeacherClasses();
  const [configClassId, setConfigClassId] = useState("");
  const [rollStart, setRollStart] = useState("10001");
  const [configSaving, setConfigSaving] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState("0");
  const [feeSaving, setFeeSaving] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansSaving, setPlansSaving] = useState(false);
  const [appAccessFee, setAppAccessFee] = useState(0);
  const [promoCodes, setPromoCodes] = useState<
    { code: string; discount_percent: number; is_active: boolean }[]
  >([]);
  const [promoInput, setPromoInput] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("0");
  const [promoSaving, setPromoSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const loadPlans = async () => {
        setPlansLoading(true);
        try {
          const rows = await subscriptionPlanService.listPlans({ activeOnly: false, force: true });
          if (mounted) setPlans(rows);
        } finally {
          if (mounted) setPlansLoading(false);
        }
      };
      const loadPromos = async () => {
        const rows = await promoService.listPromoCodes(100);
        if (mounted) {
          setPromoCodes(
            rows.map((row) => ({
              code: row.code,
              discount_percent: row.discount_percent,
              is_active: row.is_active,
            }))
          );
        }
      };
      const loadAppFee = async () => {
        try {
          const fee = await paymentService.getAppAccessFee();
          if (mounted) setAppAccessFee(fee);
        } catch {
          if (mounted) setAppAccessFee(0);
        }
      };
      void loadPlans();
      void loadPromos();
      void loadAppFee();
      return () => {
        mounted = false;
        setConfigClassId("");
        setRollStart("10001");
        setMonthlyFee("0");
      };
    }, [])
  );

  const onClassSelect = async (classId: string) => {
    setConfigClassId(classId);
    const fee = await classFeeService.getClassFeeConfig(classId);
    setMonthlyFee(String(fee?.monthly_fee ?? 0));
  };

  const saveRollConfig = async () => {
    if (!configClassId) {
      toastService.error("Missing", "Select class first");
      return;
    }
    setConfigSaving(true);
    try {
      await studentService.upsertRollConfig({
        class_id: configClassId,
        start: Number(rollStart),
      });
      toastService.success("Saved", "Roll configuration updated");
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to save roll config");
    } finally {
      setConfigSaving(false);
    }
  };

  const saveFeeConfig = async () => {
    if (!configClassId) {
      toastService.error("Missing", "Select class first");
      return;
    }
    setFeeSaving(true);
    try {
      await classFeeService.upsertClassFeeConfig({
        class_id: configClassId,
        monthly_fee: Number(monthlyFee || 0),
      });
      toastService.success("Saved", "Monthly fee configuration updated");
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to save class fee");
    } finally {
      setFeeSaving(false);
    }
  };

  const updatePlan = (code: string, patch: Partial<SubscriptionPlan>) => {
    setPlans((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  };

  const savePlans = async () => {
    if (!plans.length) {
      toastService.error("Missing", "No plans available to update");
      return;
    }
    setPlansSaving(true);
    try {
      await subscriptionPlanService.upsertPlans(
        plans.map((plan, index) => ({
          code: plan.code,
          title: plan.title,
          amount: Number(plan.amount || 0),
          duration_months: Math.max(1, Number(plan.duration_months || 1)),
          is_active: plan.is_active,
          sort_order: plan.sort_order || index + 1,
          description: plan.description,
          badge: plan.badge,
          details: plan.details,
        }))
      );
      toastService.success("Saved", "Subscription plans updated");
    } catch (e: any) {
      toastService.error("Failed", e?.message ?? "Unable to save plans");
    } finally {
      setPlansSaving(false);
    }
  };

  const savePromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      toastService.error("Missing", "Enter promo code");
      return;
    }
    setPromoSaving(true);
    try {
      await promoService.upsertPromoCode({
        code,
        studentType: "online",
        discountPercent: Number(promoDiscount || 0),
        isActive: true,
      });
      const rows = await promoService.listPromoCodes(100);
      setPromoCodes(
        rows.map((row) => ({
          code: row.code,
          discount_percent: row.discount_percent,
          is_active: row.is_active,
        }))
      );
      setPromoInput("");
      setPromoDiscount("0");
      toastService.success("Saved", "Promo code updated");
    } catch (e: any) {
      toastService.error("Failed", e?.message ?? "Unable to save promo code");
    } finally {
      setPromoSaving(false);
    }
  };

  const togglePromo = async (code: string, active: boolean, discount: number) => {
    setPromoSaving(true);
    try {
      await promoService.upsertPromoCode({
        code,
        studentType: "online",
        discountPercent: discount,
        isActive: active,
      });
      setPromoCodes((prev) =>
        prev.map((p) => (p.code === code ? { ...p, is_active: active } : p))
      );
    } catch (e: any) {
      toastService.error("Failed", e?.message ?? "Unable to update promo");
    } finally {
      setPromoSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 110 + insets.bottom,
      }}
    >
      <Text style={styles.heading}>Fees & Subscription</Text>
      <Text style={styles.meta}>Monthly fee, roll config, and subscription plans.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Select Class</Text>
        <View style={styles.chips}>
          {classes.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, configClassId === item.id && styles.chipActive]}
              onPress={() => onClassSelect(item.id)}
            >
              <Text style={styles.chipText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Roll Start</Text>
            <TextInput
              style={styles.input}
              value={rollStart}
              onChangeText={setRollStart}
              keyboardType="numeric"
              placeholder="Roll start"
              placeholderTextColor={APP_THEME.muted}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} disabled={configSaving} onPress={saveRollConfig}>
          <Text style={styles.saveText}>{configSaving ? "Saving..." : "Save Configuration"}</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Monthly Fee</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Monthly Fee</Text>
            <TextInput
              style={styles.input}
              value={monthlyFee}
              onChangeText={setMonthlyFee}
              keyboardType="numeric"
              placeholderTextColor={APP_THEME.muted}
            />
          </View>
        </View>
        <TouchableOpacity style={styles.saveBtn} disabled={feeSaving} onPress={saveFeeConfig}>
          <Text style={styles.saveText}>{feeSaving ? "Saving..." : "Save Fee Config"}</Text>
        </TouchableOpacity>

        <Text style={styles.section}>App Access Fee</Text>
        <Text style={styles.label}>App access fee (read-only): Rs.{appAccessFee}</Text>

        <Text style={styles.section}>Subscription Plans</Text>
        <Text style={styles.label}>Configure subscription price and duration.</Text>

        {plansLoading ? (
          <Text style={styles.meta}>Loading plans...</Text>
        ) : (
          plans.map((plan) => (
            <View key={plan.code} style={styles.subCard}>
              <Text style={styles.subTitle}>{plan.title || plan.code}</Text>

              <Text style={styles.label}>Amount (Rs)</Text>
              <TextInput
                style={styles.input}
                value={String(plan.amount)}
                onChangeText={(v) =>
                  updatePlan(plan.code, { amount: Number(v.replace(/[^0-9.]/g, "") || 0) })
                }
                keyboardType="numeric"
                placeholderTextColor={APP_THEME.muted}
              />

              <Text style={styles.label}>Duration (months)</Text>
              <TextInput
                style={styles.input}
                value={String(plan.duration_months)}
                onChangeText={(v) =>
                  updatePlan(plan.code, { duration_months: Math.max(1, Number(v.replace(/\D/g, "") || 1)) })
                }
                keyboardType="numeric"
                placeholderTextColor={APP_THEME.muted}
              />

              <View style={styles.choiceRow}>
                <TouchableOpacity
                  style={[styles.choice, plan.is_active && styles.choiceActive]}
                  onPress={() => updatePlan(plan.code, { is_active: true })}
                >
                  <Text style={styles.choiceText}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.choice, !plan.is_active && styles.choiceActive]}
                  onPress={() => updatePlan(plan.code, { is_active: false })}
                >
                  <Text style={styles.choiceText}>Inactive</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={savePlans} disabled={plansSaving}>
          <Text style={styles.saveText}>{plansSaving ? "Saving..." : "Save Subscription"}</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Promo Codes</Text>
        <Text style={styles.label}>Use promo codes for fee discounts (not for app access).</Text>

        {promoCodes.map((promo) => (
          <View key={promo.code} style={styles.promoRow}>
            <Text style={styles.promoText}>{promo.code}</Text>
            <Text style={styles.promoMeta}>{promo.discount_percent}%</Text>
            <TouchableOpacity
              style={[styles.promoBadge, promo.is_active ? styles.promoOn : styles.promoOff]}
              onPress={() => togglePromo(promo.code, !promo.is_active, promo.discount_percent)}
              disabled={promoSaving}
            >
              <Text style={styles.promoBadgeText}>{promo.is_active ? "Active" : "Inactive"}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.subCard}>
          <Text style={styles.subTitle}>Add / Update Promo</Text>
          <TextInput
            style={styles.input}
            value={promoInput}
            onChangeText={setPromoInput}
            placeholder="PROMO CODE"
            autoCapitalize="characters"
            placeholderTextColor={APP_THEME.muted}
          />
          <TextInput
            style={styles.input}
            value={promoDiscount}
            onChangeText={(v) => setPromoDiscount(v.replace(/\D/g, ""))}
            placeholder="Discount %"
            keyboardType="numeric"
            placeholderTextColor={APP_THEME.muted}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={savePromo} disabled={promoSaving}>
            <Text style={styles.saveText}>{promoSaving ? "Saving..." : "Save Promo"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, paddingHorizontal: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800" },
  meta: { color: APP_THEME.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  card: { backgroundColor: APP_THEME.card, borderRadius: 14, padding: 12 },
  label: { color: APP_THEME.muted, fontSize: 11, marginBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: { backgroundColor: APP_THEME.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipActive: { backgroundColor: `${APP_THEME.primary}33` },
  chipText: { color: APP_THEME.text, fontSize: 11, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  input: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: APP_THEME.text,
  },
  saveBtn: {
    marginTop: 12,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  saveText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
  section: {
    color: APP_THEME.text,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 6,
  },
  subCard: {
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    padding: 10,
  },
  choiceRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  choice: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: APP_THEME.bg,
    alignItems: "center",
  },
  choiceActive: {
    backgroundColor: `${APP_THEME.primary}22`,
    borderWidth: 1,
    borderColor: APP_THEME.primary,
  },
  choiceText: { color: APP_THEME.text, fontWeight: "700", fontSize: 12 },
  subTitle: {
    color: APP_THEME.text,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 8,
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  promoText: { color: APP_THEME.text, fontWeight: "800", fontSize: 12 },
  promoMeta: { color: APP_THEME.muted, fontSize: 11 },
  promoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  promoOn: { backgroundColor: "#22C55E" },
  promoOff: { backgroundColor: "#F87171" },
  promoBadgeText: { color: "#0B1220", fontWeight: "800", fontSize: 10 },
});
