import { uploadService } from "../../src/services/uploadService";
import { APP_THEME } from "../../src/utils/constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toastService } from "../../src/services/toastService";

export default function CreateOfferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [validTill, setValidTill] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [registrationLink, setRegistrationLink] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!title.trim() || !description.trim() || !price.trim() || !validTill.trim() || !registrationLink.trim()) {
      toastService.error("Missing fields", "Please fill all fields.");
      return;
    }

    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice)) {
      toastService.error("Invalid price", "Price must be a number.");
      return;
    }

    setLoading(true);
    try {
      await uploadService.createOffer({
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        valid_till: validTill.trim(),
        promo_code: promoCode.trim() || null,
        registration_link: registrationLink.trim(),
      });
      toastService.success("Offer created");
      router.back();
    } catch (error: any) {
      toastService.error("Create failed", error?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.heading}>Create Offer</Text>
      <Input label="Title" value={title} onChangeText={setTitle} />
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      <Input label="Price" value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Input label="Valid Till (YYYY-MM-DD)" value={validTill} onChangeText={setValidTill} />
      <Input label="Promo Code (optional)" value={promoCode} onChangeText={setPromoCode} />
      <Input label="Registration Link" value={registrationLink} onChangeText={setRegistrationLink} />

      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? "Saving..." : "Create Offer"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Input({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={APP_THEME.muted}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, padding: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800", marginBottom: 10 },
  label: { color: APP_THEME.muted, fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: APP_THEME.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  btn: {
    marginTop: 14,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
