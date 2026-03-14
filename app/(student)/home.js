import React from "react";
import {
  Animated,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import AppScroll from "../../src/components/AppScroll";
import LoadingView from "../../src/components/LoadingView";

import useStudentHome from "../../src/hooks/useStudentHome";
import useAppConfig from "../../src/hooks/useAppConfig";
import { openTrustedUrl } from "../../src/utils/linking";

const formatLiveTime = (value) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function StudentHome() {
  const router = useRouter();
  const { data, loading, initialSetup, refreshing, refresh } = useStudentHome();
  const { config } = useAppConfig();

  const pulse = React.useRef(new Animated.Value(0.5)).current;
  const fallbackLive = data
    ? data.liveToday || data.todayLives?.[0] || data.tomorrowLives?.[0] || null
    : null;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  if (loading && !data) {
    if (initialSetup) {
      return (
        <LoadingView
          text="This may take a few seconds only for first-time setup."
          variant="setup"
        />
      );
    }
    return <LoadingView text="Loading dashboard..." variant="skeleton" />;
  }

  if (!data) {
    return <LoadingView text="Preparing your dashboard..." variant="skeleton" />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppScroll
        refreshing={refreshing}
        onRefresh={refresh}
        style={styles.container}
      >
        <Text style={styles.welcome}>Welcome</Text>
        <Text style={styles.sub}>Your learning dashboard</Text>

        <Card title="Live Classes" icon="radio" color="#EF4444">
          {data.liveNow ? (
            <TouchableOpacity
              style={styles.liveCard}
              onPress={() =>
                router.push({
                  pathname: "/(student)/classes/player",
                  params: {
                    url: data.liveNow.youtube_unlisted_url,
                    title: encodeURIComponent(data.liveNow.title),
                    liveSessionId: data.liveNow.id,
                  },
                })
              }
            >
              <View style={styles.liveRow}>
                <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
                <Text style={styles.liveText}>LIVE NOW</Text>
              </View>
              <Text style={styles.liveTitle}>{data.liveNow.title}</Text>
              <Text style={styles.liveMeta}>Tap to join instantly</Text>
            </TouchableOpacity>
          ) : fallbackLive ? (
            <TouchableOpacity
              style={styles.scheduledCard}
              onPress={() =>
                router.push({
                  pathname: "/(student)/classes/player",
                  params: {
                    url: fallbackLive.youtube_unlisted_url,
                    title: encodeURIComponent(fallbackLive.title),
                    liveSessionId: fallbackLive.id,
                  },
                })
              }
            >
              <Text style={styles.scheduledTitle}>{fallbackLive.title}</Text>
              <Text style={styles.liveMeta}>Scheduled at {formatLiveTime(fallbackLive.starts_at)}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.muted}>No live class today</Text>
          )}
        </Card>

        <Card title="Tomorrow's Plan" icon="checkmark-circle" color="#22C55E">
          {data.tomorrowLives?.length > 0 ? (
            data.tomorrowLives.map((item) => (
              <Text key={item.id} style={styles.info}>
                - {item.title} at {formatLiveTime(item.starts_at)}
              </Text>
            ))
          ) : data.todos.length === 0 ? (
            <Text style={styles.muted}>No tasks assigned</Text>
          ) : (
            data.todos.map((t) => (
              <Text key={t.id} style={styles.info}>
                - {t.text}
              </Text>
            ))
          )}
        </Card>

        <Card title="Notices" icon="information-circle" color="#38BDF8">
          {(data.notices || []).length === 0 ? (
            <Text style={styles.muted}>No new notices</Text>
          ) : (
            data.notices.map((n) => (
              <Text key={n.id} style={styles.info}>
                - {n.message}
              </Text>
            ))
          )}
          {config?.payment_notice_enabled && !!config?.payment_notice_url && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => void openTrustedUrl(config.payment_notice_url)}
            >
              <Text style={styles.payText}>Open Notice Link</Text>
            </TouchableOpacity>
          )}
        </Card>

        <View style={styles.quickRow}>
          <QuickCard
            icon="calendar"
            label="Monthly Fee"
            onPress={() => router.push("/(student)/monthly-pay")}
          />
          <QuickCard
            icon="document-text"
            label="Test Fee"
            onPress={() => router.push("/(student)/admit-card")}
          />
          <QuickCard
            icon="clipboard"
            label="Mock Test"
            onPress={() => router.push("/(student)/mock-tests")}
          />
          <QuickCard
            icon="wallet"
            label="Subscription"
            onPress={() => router.push("/(student)/subscription")}
          />
        </View>

        {data.offers?.length > 0 && (
          <Card title="Active Offers" icon="pricetag" color="#FACC15">
            {data.offers.map((offer) => (
              <View key={offer.id} style={styles.offerRow}>
                <View style={styles.offerTextWrap}>
                  <Text style={styles.info}>- {offer.title} | Rs.{offer.price}</Text>
                </View>
                {offer.registration_link ? (
                  <TouchableOpacity
                    style={styles.offerBtn}
                    onPress={() => void openTrustedUrl(offer.registration_link)}
                  >
                    <Text style={styles.offerBtnText}>Register</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </Card>
        )}
      </AppScroll>
    </SafeAreaView>
  );
}

function Card({ title, icon, color, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function QuickCard({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={onPress}>
      <Ionicons name={icon} size={20} color="#38BDF8" />
      <Text style={styles.quickLabel}>{label}</Text>
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
  welcome: {
    fontSize: 26,
    fontWeight: "800",
    color: "#E5E7EB",
  },
  sub: {
    color: "#9CA3AF",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    color: "#E5E7EB",
    fontWeight: "700",
    marginLeft: 8,
  },
  muted: {
    color: "#94A3B8",
    fontSize: 13,
  },
  info: {
    color: "#CBD5E1",
    marginTop: 6,
  },
  payBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#38BDF8",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  payText: {
    color: "#020617",
    fontWeight: "800",
    fontSize: 12,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  quickCard: {
    width: "48%",
    backgroundColor: "#020617",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  quickLabel: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "700",
  },
  liveCard: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    borderRadius: 12,
    padding: 10,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#EF4444",
  },
  liveText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "800",
  },
  liveTitle: {
    color: "#FEE2E2",
    fontWeight: "800",
    fontSize: 14,
  },
  liveMeta: {
    color: "#FCA5A5",
    fontSize: 12,
    marginTop: 3,
  },
  scheduledCard: {
    backgroundColor: "rgba(56,189,248,0.12)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.35)",
    borderRadius: 12,
    padding: 10,
  },
  scheduledTitle: {
    color: "#BAE6FD",
    fontWeight: "800",
    fontSize: 14,
  },
  offerRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  offerTextWrap: { flex: 1 },
  offerBtn: {
    backgroundColor: "#38BDF8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  offerBtnText: {
    color: "#020617",
    fontWeight: "800",
    fontSize: 11,
  },
});
