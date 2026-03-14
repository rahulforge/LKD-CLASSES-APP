import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../../../src/services/authService";
import AppLogo from "../../../src/components/AppLogo";

export default function Signup() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const normalizeError = (value) => {
    const raw = String(value ?? "").toLowerCase();
    if (raw.includes("already") && raw.includes("account")) {
      return "Is number se account pehle se bana hua hai.";
    }
    if (raw.includes("invalid") && raw.includes("login")) {
      return "Invalid details. Please try again.";
    }
    if (raw.includes("network")) {
      return "Network issue. Please try again.";
    }
    return "Something went wrong. Please try again.";
  };

  const validate = () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!name.trim()) return "Enter your full name";
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return "Enter valid 10 digit mobile number";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }
    return null;
  };

  const createAccount = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await authService.registerStudent({
        name,
        phone: cleanPhone,
        password,
        rollNumber: rollNumber.trim() || null,
        studentClass:
          typeof params.class === "string"
            ? params.class
            : null,
        programType:
          params.category === "competitive"
            ? "competitive"
            : "school",
        competitiveExam:
          typeof params.competitive_exam === "string"
            ? params.competitive_exam
            : null,
      });

      setSuccess("Profile created successfully. Please login to continue.");
      router.replace({
        pathname: "/(auth)/login",
        params: { phone: cleanPhone, created: "1" },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      const raw = message.toLowerCase();
      if (raw.includes("stack") || raw.includes("full") || raw.includes("depth")) {
        setSuccess("Profile created successfully. Please login to continue.");
        router.replace({
          pathname: "/(auth)/login",
          params: { phone: cleanPhone, created: "1" },
        });
      } else {
        setError(normalizeError(message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <AppLogo size={72} showTitle />
        <Text style={styles.title}>Create Account</Text>
        {null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? (
          <Text style={styles.success}>{success}</Text>
        ) : null}

        <TextInput
          placeholder="Full name"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          value={name}
          onChangeText={setName}
        />

        <TextInput
          placeholder="Mobile number"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={(value) =>
            setPhone(value.replace(/\D/g, ""))
          }
        />

        <TextInput
          placeholder="Roll number (if given by teacher)"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          value={rollNumber}
          onChangeText={setRollNumber}
        />

        <View style={styles.passwordBox}>
          <TextInput
            placeholder="Create password"
            placeholderTextColor="#94A3B8"
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? "eye-off" : "eye"}
              size={22}
              color="#94A3B8"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={createAccount}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#020617" />
          ) : (
            <Text style={styles.buttonText}>
              Create Account
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={styles.link}>
            Already have an account? Login
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: "#E5E7EB",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 4,
  },
  sub: {
    color: "#9CA3AF",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#020617",
    borderRadius: 14,
    padding: 14,
    color: "#E5E7EB",
    marginBottom: 12,
  },
  passwordBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#020617",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    color: "#E5E7EB",
    paddingVertical: 14,
  },
  button: {
    backgroundColor: "#38BDF8",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: {
    color: "#020617",
    fontWeight: "700",
    fontSize: 15,
  },
  error: {
    color: "#F87171",
    marginBottom: 10,
    fontSize: 13,
  },
  success: {
    color: "#34D399",
    marginBottom: 10,
    fontSize: 13,
  },
  link: {
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 18,
    fontSize: 13,
  },
});
