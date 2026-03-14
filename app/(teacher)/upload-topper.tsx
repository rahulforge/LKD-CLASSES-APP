import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { topperService } from "../../src/services/topperService";
import { uploadService } from "../../src/services/uploadService";
import { APP_THEME } from "../../src/utils/constants";
import { toastService } from "../../src/services/toastService";

const emptyForm = {
  name: "",
  class: "",
  obtained: "",
  total: "",
  marksLabel: "",
};

export default function UploadTopperScreen() {
  const insets = useSafeAreaInsets();
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedRank, setSelectedRank] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => slots.find((item) => item.rank === selectedRank) ?? null,
    [selectedRank, slots]
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await topperService.getTop3();
      setSlots(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) {
      setForm(emptyForm);
      setImageUrl("");
      return;
    }
    setForm({
      name: selected.name ?? "",
      class: selected.class ?? "",
      obtained: selected.obtained_marks ? String(selected.obtained_marks) : "",
      total: selected.total_marks ? String(selected.total_marks) : "",
      marksLabel: selected.marks ?? "",
    });
    setImageUrl(selected.image_url ?? "");
  }, [selected]);

  const pickImage = async () => {
    try {
      const uploaded = await uploadService.uploadFile({
        type: "image/*",
        resourceType: "image",
      });
      setImageUrl(uploaded);
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to upload image");
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.class.trim()) {
      toastService.error("Missing", "Name and class are required.");
      return;
    }
    if (!imageUrl) {
      toastService.error("Missing", "Topper photo required.");
      return;
    }
    const obtained = Number(form.obtained || 0);
    const total = Number(form.total || 0);
    const marksLabel = form.marksLabel.trim() || (total > 0 ? `${obtained}/${total}` : String(obtained));

    setSaving(true);
    try {
      await topperService.upsertTopper({
        rank: selectedRank,
        name: form.name.trim(),
        class: form.class.trim(),
        marks: marksLabel,
        image_url: imageUrl,
        obtained_marks: total > 0 ? obtained : null,
        total_marks: total > 0 ? total : null,
      });
      toastService.success("Saved", `Top ${selectedRank} updated.`);
      await load();
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to save topper");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.heading}>Top 3 Toppers</Text>
      <Text style={styles.meta}>Edit rank slots directly. No extra add list.</Text>

      <View style={styles.rankRow}>
        {[1, 2, 3].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.rankChip, selectedRank === r && styles.rankChipActive]}
            onPress={() => setSelectedRank(r)}
          >
            <Text style={[styles.rankChipText, selectedRank === r && styles.rankChipTextActive]}>Top {r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Student Name</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />

      <Text style={styles.label}>Class</Text>
      <TextInput style={styles.input} value={form.class} onChangeText={(v) => setForm({ ...form, class: v })} />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Obtained</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={form.obtained}
            onChangeText={(v) => setForm({ ...form, obtained: v })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Total</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={form.total}
            onChangeText={(v) => setForm({ ...form, total: v })}
          />
        </View>
      </View>

      <Text style={styles.label}>Marks Label (optional)</Text>
      <TextInput
        style={styles.input}
        value={form.marksLabel}
        onChangeText={(v) => setForm({ ...form, marksLabel: v })}
        placeholder="e.g. 478/500"
        placeholderTextColor={APP_THEME.muted}
      />

      <TouchableOpacity style={styles.secondaryBtn} onPress={pickImage}>
        <Text style={styles.secondaryText}>{imageUrl ? "Change Photo" : "Upload Photo"}</Text>
      </TouchableOpacity>

      {!!imageUrl && <Text style={styles.urlText} numberOfLines={1}>{imageUrl}</Text>}

      <TouchableOpacity style={styles.btn} disabled={saving || loading} onPress={save}>
        <Text style={styles.btnText}>{saving ? "Saving..." : "Save Topper Slot"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, paddingHorizontal: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  meta: { color: APP_THEME.muted, marginBottom: 12 },
  rankRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  rankChip: { flex: 1, backgroundColor: APP_THEME.card, borderRadius: 999, paddingVertical: 8, alignItems: "center" },
  rankChipActive: { backgroundColor: `${APP_THEME.primary}33` },
  rankChipText: { color: APP_THEME.muted, fontWeight: "700", fontSize: 12 },
  rankChipTextActive: { color: APP_THEME.primary },
  label: { color: APP_THEME.muted, fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: APP_THEME.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
  },
  row: { flexDirection: "row", gap: 8 },
  secondaryBtn: {
    marginTop: 12,
    backgroundColor: `${APP_THEME.primary}22`,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryText: { color: APP_THEME.primary, fontWeight: "700", fontSize: 12 },
  urlText: { color: APP_THEME.muted, marginTop: 6, fontSize: 11 },
  btn: {
    marginTop: 12,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
