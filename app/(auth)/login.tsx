import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import useAuth from "../../src/hooks/useAuth";
import AppLogo from "../../src/components/AppLogo";
import { sanitizeDigits } from "../../src/utils/sanitize";
import { profileService } from "../../src/services/profileService";

const resolveUserRole = async (
  userId: string
): Promise<"teacher" | "student" | null> => {
  const quick = await Promise.race([
    profileService.getMyRole(userId),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
  ]);
  if (quick === "teacher" || quick === "student") {
    return quick;
  }

  const retry = await profileService.getMyRole(userId);
  if (retry === "teacher" || retry === "student") {
    return retry;
  }

  const profile = await profileService.getMyProfile(userId);
  if (profile?.role === "teacher" || profile?.role === "student") {
    return profile.role;
  }

  return null;
};

export default function Login() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { login: loginUser } = useAuth();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const prefPhone =
    typeof params.phone === "string" ? params.phone : "";
  const created =
    typeof params.created === "string" ? params.created : "";

  const handleLogin = async () => {
    const cleanPhone = sanitizeDigits(phone, 10);

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Enter valid mobile number");
      return;
    }

    if (!password) {
      setError("Enter password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const user = await loginUser(cleanPhone, password);

      if (!user?.id) {
        throw new Error("Unable to login");
      }

      const role = await resolveUserRole(user.id);
      if (role === "teacher") {
        router.replace("/(teacher)/home");
        return;
      }
      // Never send authenticated user to public home because role fetch timed out.
      router.replace("/(student)/app-access");
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Unable to login right now";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!phone && prefPhone) {
      setPhone(sanitizeDigits(prefPhone, 10));
    }
  }, [phone, prefPhone]);

  useEffect(() => {
    if (!info && created === "1") {
      setInfo("Account created. Please login to continue payment.");
    }
  }, [created, info]);

  return (
    <View style={styles.container}>
      <AppLogo size={78} showTitle />
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.sub}>Login to continue learning</Text>

      {info ? <Text style={styles.info}>{info}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        placeholder="Mobile number"
        placeholderTextColor="#94A3B8"
        style={styles.input}
        keyboardType="phone-pad"
        maxLength={10}
        value={phone}
        onChangeText={(value) =>
          setPhone(sanitizeDigits(value, 10))
        }
      />

      <View style={styles.passwordBox}>
        <TextInput
          placeholder="Password"
          placeholderTextColor="#94A3B8"
          style={styles.passwordInput}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword((prev) => !prev)}
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
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#020617" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(auth)/forgot-password")}
        style={{ marginTop: 14 }}
      >
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(auth)/signup/step1")}
        style={{ marginTop: 16 }}
      >
        <Text style={styles.link}>New student? Create account</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/(public)/home")}
        style={{ marginTop: 26 }}
      >
        <Text style={styles.guest}>Continue as Guest</Text>
      </TouchableOpacity>
    </View>
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
    marginBottom: 6,
  },
  sub: {
    color: "#9CA3AF",
    marginBottom: 24,
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
  link: {
    color: "#38BDF8",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  guest: {
    color: "#9CA3AF",
    textAlign: "center",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  error: {
    color: "#F87171",
    marginBottom: 12,
    fontSize: 13,
  },
  info: {
    color: "#38BDF8",
    marginBottom: 12,
    fontSize: 13,
  },
});
