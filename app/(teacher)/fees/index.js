import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherClasses } from "../../../src/hooks/useTeacherClasses";
import { paymentService } from "../../../src/services/paymentService";
import { toastService } from "../../../src/services/toastService";
import { APP_THEME } from "../../../src/utils/constants";

export default function FeesRoot() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { classes } = useTeacherClasses();
  const ordered = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [classes]
  );

  const [roll, setRoll] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const addQuickPayment = async () => {
    if (!roll.trim()) {
      toastService.error("Missing", "Enter roll number");
      return;
    }
    if (!amount.trim() || Number(amount) <= 0) {
      toastService.error("Missing", "Enter valid amount");
      return;
    }

    setSaving(true);
    try {
      await paymentService.upsertPaymentTracking({
        roll_number: roll.trim(),
        amount: Number(amount),
        status: "success",
        paid_month: `${new Date().toISOString().slice(0, 7)}-01`,
        paid_date: new Date().toISOString().slice(0, 10),
        payment_mode: "offline",
        payment_kind: "offline_monthly",
      });
      toastService.success("Saved", "Monthly fee entry added.");
      setRoll("");
      setAmount("");
    } catch (error) {
      toastService.error("Failed", error?.message ?? "Unable to save payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.heading}>Fees Control</Text>
      <Text style={styles.meta}>Monthly entry and class-wise tracking.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Monthly Entry</Text>
        <TextInput
          style={styles.input}
          value={roll}
          onChangeText={setRoll}
          placeholder="Roll Number"
          placeholderTextColor={APP_THEME.muted}
        />
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Amount"
          placeholderTextColor={APP_THEME.muted}
        />

        <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={addQuickPayment}>
          <Text style={styles.primaryText}>{saving ? "Saving..." : "Save Payment"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Browse By Class</Text>
      {ordered.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.classCard}
          onPress={() => router.push(`/(teacher)/fees/${item.id}?className=${encodeURIComponent(item.name)}`)}
        >
          <Text style={styles.classText}>{item.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, paddingHorizontal: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800" },
  meta: { color: APP_THEME.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  card: { backgroundColor: APP_THEME.card, borderRadius: 14, padding: 12, marginBottom: 12 },
  cardTitle: { color: APP_THEME.text, fontSize: 14, fontWeight: "800", marginBottom: 8 },
  input: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 2,
  },
  primaryText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
  sectionTitle: { color: APP_THEME.text, fontWeight: "800", fontSize: 14, marginBottom: 8 },
  classCard: { backgroundColor: APP_THEME.card, borderRadius: 12, padding: 12, marginBottom: 8 },
  classText: { color: APP_THEME.text, fontWeight: "700", fontSize: 14 },
});
