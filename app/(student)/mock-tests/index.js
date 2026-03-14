import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useProfile from "../../../src/hooks/useProfile";
import { mockTestService } from "../../../src/services/mockTestService";
import { useAccessGuard } from "../../../src/hooks/useAccessGuard";
import useAuth from "../../../src/hooks/useAuth";

const toBool = (value) =>
  value === true || value === 1 || String(value ?? "").toLowerCase() === "true";

export default function MockTestsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();
  const guard = useAccessGuard("mock_test");
  const [tests, setTests] = useState([]);
  const [paidSet, setPaidSet] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const rows = await mockTestService.getAvailableTestsForStudent({
        class_id: profile?.class ?? null,
        program_type: profile?.program_type ?? null,
      });
      if (!mounted) return;
      setTests(rows);
      const ids = rows.map((t) => String(t.id));
      if (user?.id && ids.length) {
        const paid = await mockTestService.getPaidTestIds(user.id, ids);
        if (mounted) setPaidSet(paid);
      } else if (mounted) {
        setPaidSet(new Set());
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [profile?.class, profile?.program_type, guard.allowed, user?.id]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        padding: 16,
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 110 + insets.bottom,
      }}
    >
      <Text style={styles.heading}>Mock Tests</Text>
      <Text style={styles.meta}>Attempt tests assigned by teacher.</Text>
      <>
        {tests.map((t) => {
          const isFree = toBool(t.is_free);
          const price = Math.max(0, Number(t.price ?? 0));
          const hasSubscription = guard.allowed;
          const hasTestPaid = paidSet.has(String(t.id));
          const needsSubscription = !isFree && !hasSubscription;
          const needsTestPay = price > 0 && !hasTestPaid;
          const locked = needsSubscription || needsTestPay;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.card, locked && styles.cardLocked]}
              onPress={() => {
                if (needsSubscription) {
                  router.push("/(student)/subscription");
                  return;
                }
                if (needsTestPay) {
                  router.push({
                    pathname: "/(student)/checkout",
                    params: {
                      flow: "mock_test",
                      amount: String(price),
                      mock_test_id: String(t.id),
                      title: encodeURIComponent(`Mock Test: ${String(t.title || "Test")}`),
                    },
                  });
                  return;
                }
                router.push(`/(student)/mock-tests/${t.id}`);
              }}
            >
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.sub}>
                {t.scheduled_for || "No due date"} | {t.duration_minutes || 60} min | +{Number(t.marks_per_question ?? 1)} / -{Number(t.negative_marks ?? 0)}
              </Text>
              <View style={styles.badgeRow}>
                <Text style={[styles.badge, isFree ? styles.badgeFree : styles.badgePaid]}>
                  {isFree ? "FREE" : "PAID"}
                </Text>
                {price > 0 && (
                  <Text style={styles.priceText}>Rs.{price}</Text>
                )}
                {needsSubscription && <Text style={styles.lockedText}>Buy subscription to unlock</Text>}
                {needsTestPay && <Text style={styles.lockedText}>Pay for this test to unlock</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
        {!tests.length && <Text style={styles.empty}>No mock tests available.</Text>}
      </>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1220" },
  heading: { color: "#E5E7EB", fontSize: 20, fontWeight: "800" },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 2, marginBottom: 10 },
  card: { backgroundColor: "#020617", borderRadius: 12, padding: 12, marginBottom: 8 },
  title: { color: "#E5E7EB", fontWeight: "700", fontSize: 14 },
  sub: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  empty: { color: "#94A3B8", fontSize: 12 },
  badgeRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  badgeFree: { backgroundColor: "#22C55E", color: "#0B1220" },
  badgePaid: { backgroundColor: "#FACC15", color: "#0B1220" },
  priceText: { color: "#38BDF8", fontSize: 11, fontWeight: "700" },
  cardLocked: { opacity: 0.8, borderWidth: 1, borderColor: "#7F1D1D" },
  lockedText: { color: "#FCA5A5", fontSize: 11, fontWeight: "700" },
});
