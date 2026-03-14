import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import YoutubePlayer from "react-native-youtube-iframe";

const extractYoutubeId = (value) => {
  const raw = String(value ?? "");
  const watch = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1];
  const short = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)?.[1];
  const embed = raw.match(/embed\/([a-zA-Z0-9_-]{6,})/)?.[1];
  return watch || short || embed || null;
};

export default function StudentLivePlayer() {
  const router = useRouter();
  const { url, title } = useLocalSearchParams();
  const safeUrl = String(url ?? "");
  const safeTitle = decodeURIComponent(String(title ?? "Live Class"));
  const [playing, setPlaying] = useState(true);
  const videoId = useMemo(() => extractYoutubeId(safeUrl), [safeUrl]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#E2E8F0" />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.title}>
          {safeTitle}
        </Text>
      </View>
      {videoId ? (
        <View style={styles.playerWrap}>
          <YoutubePlayer
            height={300}
            width={"100%"}
            videoId={videoId}
            play={playing}
            initialPlayerParams={{
              controls: true,
              modestbranding: true,
              rel: false,
              iv_load_policy: 3,
              autoplay: true,
              fs: true,
            }}
          />
          <TouchableOpacity style={styles.playBtn} onPress={() => setPlaying((prev) => !prev)}>
            <Ionicons name={playing ? "pause" : "play"} size={18} color="#E2E8F0" />
          </TouchableOpacity>
        </View>
      ) : (
        <WebView source={{ uri: safeUrl }} style={styles.web} startInLoadingState />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020617" },
  header: {
    height: 52,
    backgroundColor: "#0F172A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(2,6,23,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#E2E8F0", fontWeight: "700", fontSize: 14, flex: 1 },
  playerWrap: { flex: 1, justifyContent: "center", backgroundColor: "#000" },
  web: { flex: 1 },
  playBtn: {
    position: "absolute",
    right: 12,
    bottom: 16,
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,6,23,0.75)",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
});

