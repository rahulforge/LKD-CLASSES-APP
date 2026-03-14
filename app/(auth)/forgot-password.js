import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { openTrustedUrl } from "../../src/utils/linking";
import { sanitizeDigits, sanitizeMultiline, sanitizeText } from "../../src/utils/sanitize";

export default function ForgotPassword() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");

  const sendWhatsApp = () => {
    const safeName = sanitizeText(name, 60);
    const safePhone = sanitizeDigits(phone, 10);
    const safeDetails = sanitizeMultiline(details, 140);

    if (!safeName || safePhone.length !== 10) {
      alert("Please enter valid name and phone number");
      return;
    }

    const message = `
Forgot Password Request

Name: ${safeName}
Phone: ${safePhone}
Details: ${safeDetails || "N/A"}

Please reset my password.
    `.trim();

    const url =
      "https://wa.me/918002271522?text=" +
      encodeURIComponent(message);

    void openTrustedUrl(url);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.brand}>LKD Classes</Text>
          <Text style={styles.sub}>
            Password recovery assistance
          </Text>
        </View>

        {/* CARD */}
        <View style={styles.card}>
          <Text style={styles.title}>Forgot Password</Text>

          <TextInput
            placeholder="Student name"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={name}
            onChangeText={(value) => setName(sanitizeText(value, 60))}
          />

          <TextInput
            placeholder="Registered mobile number"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            keyboardType="phone-pad"
            value={phone}
            maxLength={10}
            onChangeText={(value) => setPhone(sanitizeDigits(value, 10))}
          />

          <TextInput
            placeholder="Class / Exam (optional)"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={details}
            onChangeText={(value) => setDetails(sanitizeMultiline(value, 140))}
          />

          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.9}
            onPress={sendWhatsApp}
          >
            <Ionicons
              name="logo-whatsapp"
              size={18}
              color="#020617"
            />
            <Text style={styles.btnText}>
              Send on WhatsApp
            </Text>
          </TouchableOpacity>

          {/* NAV LINKS */}
          <TouchableOpacity
            onPress={() =>
              router.replace("/(auth)/login")
            }
          >
            <Text style={styles.link}>
              Back to Login
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              router.replace("/(auth)/signup/step1")
            }
          >
            <Text style={styles.link}>
              Create New Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ===== STYLES (THIS WAS MISSING) ===== */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 10,
  },
  brand: {
    fontSize: 24,
    fontWeight: "800",
    color: "#38BDF8",
  },
  sub: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 20,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#E5E7EB",
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    color: "#E5E7EB",
    marginBottom: 12,
    fontSize: 14,
  },
  btn: {
    backgroundColor: "#25D366",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  btnText: {
    color: "#020617",
    fontWeight: "700",
    fontSize: 15,
  },
  link: {
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 14,
    fontSize: 13,
  },
});
