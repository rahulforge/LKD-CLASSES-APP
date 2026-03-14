import { SafeAreaView, StyleSheet, StatusBar, View, Text, ActivityIndicator, Platform, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import Pdf from "react-native-pdf";
import * as FileSystem from "expo-file-system/legacy";
import useScreenGuard from "../../../src/hooks/useScreenGuard";
import { toastService } from "../../../src/services/toastService";

const hashString = (input) => {
  let hash = 0;
  const str = String(input ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
};

export default function PdfViewer() {
  const { url } = useLocalSearchParams();
  useScreenGuard({ enabled: true });

  const sourceUrl = String(url ?? "").trim();
  const [viewerUri, setViewerUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triedRemote, setTriedRemote] = useState(false);
  const [scale, setScale] = useState(1);
  const [didNudge, setDidNudge] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const pdfRef = useRef(null);

  const resolvedRemote = useMemo(() => {
    if (!sourceUrl) return "";
    try {
      return encodeURI(sourceUrl);
    } catch {
      return sourceUrl;
    }
  }, [sourceUrl]);

  useEffect(() => {
    setScale(1);
    setDidNudge(false);
    setPageCount(0);
    setPageNumber(1);
  }, [viewerUri]);

  const cachePath = useMemo(() => {
    if (!sourceUrl) return "";
    const name = `lkd_pdf_${hashString(sourceUrl)}.pdf`;
    return `${FileSystem.cacheDirectory || ""}${name}`;
  }, [sourceUrl]);

  const offlinePath = useMemo(() => {
    if (!sourceUrl) return "";
    const base = FileSystem.documentDirectory || "";
    if (!base) return "";
    const name = `lkd_pdf_${hashString(sourceUrl)}.pdf`;
    return `${base}${name}`;
  }, [sourceUrl]);

  const refreshOfflineState = async () => {
    if (!offlinePath) {
      setOfflineReady(false);
      return;
    }
    const info = await FileSystem.getInfoAsync(offlinePath);
    setOfflineReady(Boolean(info.exists));
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!sourceUrl || !cachePath) {
        if (mounted) {
          setError("Invalid PDF link.");
          setLoading(false);
        }
        return;
      }
      setError("");
      setTriedRemote(false);
      await refreshOfflineState();
      const isLocal =
        sourceUrl.startsWith("file://") ||
        (FileSystem.documentDirectory &&
          sourceUrl.startsWith(FileSystem.documentDirectory)) ||
        (FileSystem.cacheDirectory &&
          sourceUrl.startsWith(FileSystem.cacheDirectory));
      if (isLocal) {
        if (mounted) {
          setViewerUri(sourceUrl);
          setLoading(false);
        }
        return;
      }
      if (offlinePath) {
        const offlineInfo = await FileSystem.getInfoAsync(offlinePath);
        if (offlineInfo.exists && mounted) {
          setViewerUri(offlinePath);
          setLoading(false);
          return;
        }
      }
      try {
        const info = await FileSystem.getInfoAsync(cachePath);
        if (!info.exists) {
          await FileSystem.downloadAsync(resolvedRemote, cachePath);
        }
        if (mounted) {
          setViewerUri(cachePath);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setViewerUri(resolvedRemote);
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [cachePath, sourceUrl, resolvedRemote]);

  const handleOfflineToggle = async () => {
    if (!offlinePath || !resolvedRemote) return;
    setOfflineBusy(true);
    try {
      if (offlineReady) {
        await FileSystem.deleteAsync(offlinePath, { idempotent: true });
        setOfflineReady(false);
        if (cachePath) {
          const cacheInfo = await FileSystem.getInfoAsync(cachePath);
          if (cacheInfo.exists) {
            setViewerUri(cachePath);
          } else {
            setViewerUri(resolvedRemote);
          }
        }
        toastService.success("Removed", "Offline copy deleted.");
      } else {
        const source = viewerUri.startsWith("file://") ? viewerUri : resolvedRemote;
        if (source.startsWith("file://")) {
          await FileSystem.copyAsync({ from: source, to: offlinePath });
        } else {
          await FileSystem.downloadAsync(resolvedRemote, offlinePath);
        }
        setOfflineReady(true);
        setViewerUri(offlinePath);
        toastService.success("Saved", "Saved for offline use.");
      }
    } catch {
      toastService.error("Failed", "Unable to update offline copy.");
    } finally {
      setOfflineBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LKD Classes</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#38BDF8" />
            <Text style={styles.info}>Preparing PDF...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : (
          <Pdf
            ref={pdfRef}
            source={{ uri: viewerUri, cache: true }}
            trustAllCerts={false}
            style={styles.pdf}
            enableAntialiasing
            scale={scale}
            minScale={1}
            maxScale={3}
            onLoadComplete={(pages) => {
              setPageCount(Number(pages || 0));
              if (Platform.OS === "android" && !didNudge) {
                setDidNudge(true);
                setTimeout(() => setScale(1.02), 30);
              }
            }}
            onPageChanged={(page) => {
              const current = Number(page || 1);
              setPageNumber(current);
            }}
            onError={() => {
              if (!triedRemote && resolvedRemote && viewerUri !== resolvedRemote) {
                setTriedRemote(true);
                setViewerUri(resolvedRemote);
                return;
              }
              setError("Unable to render PDF.");
            }}
          />
        )}
      </View>
      {!loading && !error && pageCount > 0 ? (
        <View style={styles.pageBar}>
          <View>
            <Text style={styles.pageText}>
              Page {pageNumber} / {pageCount}
            </Text>
            <Text style={styles.pageHint}>
              {offlineReady ? "Saved to in-app library" : "View only"}
            </Text>
          </View>
          <View />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
  header: {
    height: 38,
    backgroundColor: "#0F172A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  body: { flex: 1 },
  pdf: { flex: 1, width: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  info: { marginTop: 8, color: "#94A3B8", fontSize: 12 },
  error: { color: "#F87171", fontSize: 12 },
  pageBar: {
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageText: { color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  pageHint: { color: "#94A3B8", fontSize: 10, marginTop: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  offlineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "transparent",
  },
  offlineBtnActive: {
    backgroundColor: "#1E293B",
  },
  offlineText: { color: "#CBD5E1", fontSize: 11, fontWeight: "700" },
  offlineTextActive: { color: "#A7F3D0" },
  deleteBtn: {
    borderColor: "#F87171",
    backgroundColor: "transparent",
  },
  deleteText: { color: "#FCA5A5", fontSize: 11, fontWeight: "800" },
});
