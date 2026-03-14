import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { openTrustedUrl } from "../../src/utils/linking";

export default function PublicHome() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={120}
            />
          </View>

          <Text style={styles.brand}>LKD Classes</Text>
          <Text style={styles.tagline}>
            Trusted Coaching for Classes 9-12 and Competitive Exams
          </Text>

          <Text style={styles.desc}>
            LKD Classes is a dedicated coaching institute in Sitalpur, Saran focused
            on concept clarity, discipline, and consistent academic improvement.
          </Text>
        </View>

        <Section title="Our Results">
          <View style={styles.statsRow}>
            <Stat icon="checkmark-circle" value="98.5%" label="Pass Rate" />
            <Stat icon="people" value="1500+" label="Students" />
            <Stat icon="trophy" value="250+" label="Top Performers" />
          </View>
        </Section>

        <Section title="Founder's Message">
          <View style={styles.founderCard}>
            <Image
              source={require("../../assets/images/founder.png")}
              style={styles.founderImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />

            <Text style={styles.founderText}>
              Our aim is not just to help students score marks, but to build
              confidence, discipline, and the right mindset for lifelong success.
            </Text>

            <Text style={styles.founderName}>Founder, LKD Classes</Text>
          </View>
        </Section>

        <Section title="Get in Touch">
          <View style={styles.contactRow}>
            <ContactIcon icon="call" url="tel:8002271522" />
            <ContactIcon icon="logo-whatsapp" url="https://wa.me/918002271522" />
            <ContactIcon icon="mail" url="mailto:lkdclasses@gmail.com" />
            <ContactIcon
              icon="location"
              url="https://www.google.com/maps/search/?api=1&query=lkd+classes+Sitalpur+Saran+Bihar"
            />
          </View>
        </Section>

        <View style={{ height: 24 }} />
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({ icon, value, label }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color="#38BDF8" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ContactIcon({ icon, url }) {
  return (
    <TouchableOpacity
      style={styles.iconBox}
      activeOpacity={0.85}
      onPress={() => void openTrustedUrl(url)}
    >
      <Ionicons name={icon} size={24} color="#38BDF8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  container: {
    padding: 20,
  },
  hero: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 62,
    height: 62,
  },
  brand: {
    fontSize: 26,
    fontWeight: "800",
    color: "#38BDF8",
  },
  tagline: {
    fontSize: 13,
    color: "#E5E7EB",
    marginTop: 4,
    textAlign: "center",
  },
  desc: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 18,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#E5E7EB",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCard: {
    width: "30%",
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E5E7EB",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
    textAlign: "center",
  },
  founderCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
  },
  founderImg: {
    width: 84,
    height: 104,
    borderRadius: 16,
    marginBottom: 8,
  },
  founderText: {
    fontSize: 13,
    color: "#CBD5E1",
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 18,
  },
  founderName: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
});
