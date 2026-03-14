import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { classService } from "../../../../src/services/classService";
import useProfile from "../../../../src/hooks/useProfile";
import { useAccessGuard } from "../../../../src/hooks/useAccessGuard";
import useAppConfig from "../../../../src/hooks/useAppConfig";
import { openSupportContact } from "../../../../src/utils/support";
import { toastService } from "../../../../src/services/toastService";

export default function ChapterPage() {
  const { subject, chapter } = useLocalSearchParams();
  const router = useRouter();
  const { className } = useProfile();
  const { allowed } = useAccessGuard("video");
  const { config } = useAppConfig();
  const supportPhone = config?.support_phone || "8002271522";

  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!className || !subject || !chapter) {
      setLectures([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    classService
      .getLectures(className, String(subject), String(chapter))
      .then((data) => {
        if (!mounted) return;
        const sorted = [...(data || [])].sort(
          (a, b) => Number(Boolean(b?.is_free)) - Number(Boolean(a?.is_free))
        );
        setLectures(sorted);
      })
      .catch(() => {
        if (!mounted) return;
        setLectures([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [className, subject, chapter, allowed]);

  const renderLecture = ({ item: lecture }) => {
    const locked = !lecture?.is_free && !allowed;
    return (
      <TouchableOpacity
        style={[styles.card, locked && styles.cardLocked]}
        onPress={() => {
          if (locked) {
            toastService.info("Paid lecture", "Buy subscription to watch this lecture.");
            router.push("/(student)/subscription");
            return;
          }
          router.push({
            pathname: "/(student)/classes/player",
            params: { lectureId: lecture.id },
          });
        }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.name} numberOfLines={2}>{lecture.title}</Text>
          <Text style={styles.badgeText}>
            {lecture?.is_free ? "Free" : "Paid"}
          </Text>
        </View>
        <Ionicons
          name={locked ? "lock-closed" : "play-circle"}
          size={20}
          color={locked ? "#F87171" : "#38BDF8"}
        />
        {locked && (
          <View style={styles.blurCover}>
            <Text style={styles.blurText}>Paid</Text>
            <Text style={styles.getAccessText}>Get Access</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.muted}>Loading lectures...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="videocam-off" size={28} color="#64748B" />
        <Text style={styles.muted}>No lectures added yet</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Recorded Lectures</Text>

        {!allowed && lectures.length === 0 ? (
          <View style={styles.lockCard}>
            <Ionicons name="lock-closed" size={22} color="#F87171" />
            <Text style={styles.lockTitle}>Subscription required</Text>
            <Text style={styles.lockText}>
              No free lecture in this chapter. Buy subscription for full access.
            </Text>
            {!!supportPhone && <Text style={styles.helpText}>Support: {supportPhone}</Text>}
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => {
                void openSupportContact({
                  phone: supportPhone,
                  text: config?.support_whatsapp_text,
                });
              }}
            >
              <Text style={styles.unlockText}>Contact Staff</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={lectures}
            renderItem={renderLecture}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={8}
            windowSize={7}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={32}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: { padding: 20, paddingTop: 30 },
  title: { fontSize: 22, fontWeight: "800", color: "#E5E7EB" },
  muted: { color: "#94A3B8", marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardLocked: {
    borderWidth: 1,
    borderColor: "#7F1D1D",
    opacity: 0.85,
  },
  name: { color: "#E5E7EB", fontWeight: "600", width: "90%" },
  badgeText: { marginTop: 6, color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  blurCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.52)",
    borderRadius: 18,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 14,
  },
  blurText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "800",
  },
  getAccessText: {
    marginTop: 2,
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "800",
  },
  lockCard: { backgroundColor: "#020617", borderRadius: 16, padding: 14, marginTop: 10 },
  lockTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "800", marginTop: 8 },
  lockText: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  helpText: { color: "#CBD5E1", fontSize: 12, marginTop: 6 },
  unlockBtn: {
    marginTop: 10,
    backgroundColor: "#334155",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  unlockText: { color: "#E2E8F0", fontSize: 12, fontWeight: "800" },
  emptyCard: {
    marginTop: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
