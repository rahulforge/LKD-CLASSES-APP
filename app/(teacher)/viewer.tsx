import { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import YoutubePlayer from "react-native-youtube-iframe";
import { Ionicons } from "@expo/vector-icons";

const extractYoutubeId = (value: string) => {
  const raw = String(value ?? "");
  const watch = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1];
  const short = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)?.[1];
  const embed = raw.match(/embed\/([a-zA-Z0-9_-]{6,})/)?.[1];
  return watch || short || embed || null;
};

export default function TeacherViewerScreen() {
  const { url, mode } = useLocalSearchParams();
  const safeUrl = String(url ?? "");
  const viewerMode = String(mode ?? "").toLowerCase();
  const [playing, setPlaying] = useState(false);
  const videoId = useMemo(() => extractYoutubeId(safeUrl), [safeUrl]);
  const isPdf = useMemo(() => {
    if (viewerMode === "pdf") return true;
    const lower = safeUrl.toLowerCase();
    return lower.includes(".pdf") || lower.includes("application/pdf");
  }, [safeUrl, viewerMode]);
  const safePdfViewerUrl = useMemo(
    () => `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(safeUrl)}`,
    [safeUrl]
  );

  if (videoId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.playerWrap}>
          <YoutubePlayer
            height={320}
            width={"100%"}
            videoId={videoId}
            play={playing}
            webViewStyle={styles.web}
            initialPlayerParams={{
              controls: false,
              modestbranding: true,
              rel: false,
              iv_load_policy: 3,
              fs: false,
              autoplay: false,
              disablekb: true,
            }}
            webViewProps={{
              onShouldStartLoadWithRequest: (request) => {
                const nextUrl = String(request?.url ?? "");
                if (
                  nextUrl.includes("youtube.com/watch") ||
                  nextUrl.includes("youtu.be/") ||
                  nextUrl.startsWith("intent:") ||
                  nextUrl.startsWith("market:")
                ) {
                  return false;
                }
                return true;
              },
              setSupportMultipleWindows: false,
            }}
          />
          <TouchableOpacity
            style={styles.playBtn}
            onPress={() => setPlaying((prev) => !prev)}
          >
            <Ionicons name={playing ? "pause" : "play"} size={18} color="#E2E8F0" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isPdf) {
    return (
      <SafeAreaView style={styles.safe}>
        <WebView
          source={{ uri: safePdfViewerUrl }}
          style={styles.web}
          startInLoadingState
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          onShouldStartLoadWithRequest={(request) => {
            const nextUrl = String(request?.url ?? "").toLowerCase();
            if (
              nextUrl.includes("download") ||
              nextUrl.includes("export=download") ||
              nextUrl.includes("print") ||
              nextUrl.startsWith("intent:") ||
              nextUrl.startsWith("market:") ||
              nextUrl.startsWith("blob:")
            ) {
              return false;
            }
            return true;
          }}
          injectedJavaScript={`
            const hide = () => {
              const style = document.createElement('style');
              style.innerHTML = \`
                a[href*="download"], a[href*="print"], button[aria-label*="Print"], button[aria-label*="Download"] { display:none !important; }
              \`;
              document.head.appendChild(style);
            };
            hide();
            setInterval(hide, 1000);
            document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, false);
            document.addEventListener('keydown', function(e){
              if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) e.preventDefault();
            }, false);
            true;
          `}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <WebView
        source={{ uri: safeUrl }}
        style={styles.web}
        startInLoadingState
        originWhitelist={["*"]}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) => {
          const nextUrl = String(request?.url ?? "");
          if (
            nextUrl.startsWith("intent:") ||
            nextUrl.startsWith("market:") ||
            nextUrl.startsWith("vnd.youtube:")
          ) {
            return false;
          }
          return true;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  playerWrap: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  web: { flex: 1 },
  playBtn: {
    position: "absolute",
    right: 12,
    bottom: 20,
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
