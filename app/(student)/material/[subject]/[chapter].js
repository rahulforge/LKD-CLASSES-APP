import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { materialService } from "../../../../src/services/materialService";
import useProfile from "../../../../src/hooks/useProfile";
import { useAccessGuard } from "../../../../src/hooks/useAccessGuard";
import { classService } from "../../../../src/services/classService";
import { toastService } from "../../../../src/services/toastService";

export default function ChapterMaterial() {
  const { subject, chapter, chapterId } = useLocalSearchParams();
  const router = useRouter();
  const { className } = useProfile();
  const guard = useAccessGuard("material");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedMap, setSavedMap] = useState({});
  const [busyMap, setBusyMap] = useState({});

  const hashString = (input) => {
    let hash = 0;
    const str = String(input ?? "");
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  };

  const getOfflinePath = (url) => {
    const base = FileSystem.documentDirectory || "";
    if (!base || !url) return "";
    const name = `lkd_pdf_${hashString(url)}.pdf`;
    return `${base}${name}`;
  };

  const getResolvedUrl = (item) =>
    String(item?.pdf_url || item?.file_url || "").trim();

  useEffect(() => {
    let mounted = true;
    if (!className || !subject || !chapter) {
      setList([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const directChapterId = String(chapterId ?? "").trim();
    const loadPromise = directChapterId
      ? materialService.getMaterialsByChapterId(directChapterId, true)
      : classService.getChapters(className, String(subject)).then((chapters) => {
          const matchedChapter = chapters.find(
            (item) => item.slug === String(chapter)
          );
          if (!matchedChapter?.id) {
            return [];
          }
          return materialService.getMaterialsByChapterId(matchedChapter.id, true);
        });

    loadPromise
      .then((data) => {
        if (!mounted) return;
        const sorted = [...(data || [])].sort(
          (a, b) =>
            Number(Boolean(b?.is_preview)) - Number(Boolean(a?.is_preview))
        );
        setList(sorted);
      })
      .catch(() => {
        if (!mounted) return;
        setList([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [className, subject, chapter, chapterId, guard.allowed]);

  useEffect(() => {
    let mounted = true;
    const syncSaved = async () => {
      const next = {};
      await Promise.all(
        (list || []).map(async (item) => {
          const url = getResolvedUrl(item);
          if (!url) return;
          const path = getOfflinePath(url);
          if (!path) return;
          const info = await FileSystem.getInfoAsync(path);
          next[item.id] = Boolean(info.exists);
        })
      );
      if (mounted) setSavedMap(next);
    };
    void syncSaved();
    return () => {
      mounted = false;
    };
  }, [list]);

  const toggleSave = async (item) => {
    const url = getResolvedUrl(item);
    if (!url) return;
    const path = getOfflinePath(url);
    if (!path) return;
    if (busyMap[item.id]) return;

    const wasSaved = Boolean(savedMap[item.id]);
    setBusyMap((prev) => ({ ...prev, [item.id]: true }));
    if (!wasSaved) {
      setSavedMap((prev) => ({ ...prev, [item.id]: true }));
    }
    if (!wasSaved) {
      toastService.info("Saving", "Saving to in-app library...");
    }
    try {
      if (wasSaved) {
        await FileSystem.deleteAsync(path, { idempotent: true });
        setSavedMap((prev) => ({ ...prev, [item.id]: false }));
        toastService.success("Removed", "Offline copy deleted.");
      } else {
        try {
          await FileSystem.downloadAsync(encodeURI(url), path);
        } catch {
          await FileSystem.downloadAsync(url, path);
        }
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) {
          throw new Error("Offline save failed");
        }
        setSavedMap((prev) => ({ ...prev, [item.id]: true }));
        toastService.success("Saved", "Saved to in-app library.");
      }
    } catch {
      if (!wasSaved) {
        setSavedMap((prev) => ({ ...prev, [item.id]: false }));
      }
      toastService.error("Failed", "Unable to update offline save.");
    } finally {
      setBusyMap((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const openPdf = async (item) => {
    if (!guard.allowed && !item?.is_preview) {
      toastService.info("Paid material", "Buy subscription to open this file.");
      router.push("/(student)/subscription");
      return;
    }

    const resolvedUrl = String(item?.pdf_url || item?.file_url || "").trim();
    if (!resolvedUrl) {
      return;
    }
    const path = getOfflinePath(resolvedUrl);
    if (path) {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        router.push({
          pathname: "/(student)/material/pdf",
          params: { url: path },
        });
        return;
      }
    }
    router.push({
      pathname: "/(student)/material/pdf",
      params: { url: resolvedUrl },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Study Material</Text>
        <Text style={styles.sub}>{String(chapter).toUpperCase()}</Text>

        {!guard.allowed && list.length === 0 ? (
          <View style={styles.lockCard}>
            <Ionicons name="lock-closed" size={20} color="#F87171" />
            <Text style={styles.lockTitle}>Subscription required</Text>
            <Text style={styles.lockText}>
              No free PDF in this chapter. Buy subscription for full material.
            </Text>
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => router.push("/(student)/subscription")}
            >
              <Text style={styles.unlockText}>Get Access</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="small" color="#38BDF8" />
            <Text style={styles.empty}>Loading material...</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color="#64748B" />
            <Text style={styles.empty}>No material added yet</Text>
          </View>
        ) : (
          list.map((item) => (
            <View key={item.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => openPdf(item)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={item?.is_preview || guard.allowed ? "document-text" : "lock-closed"}
                  size={22}
                  color={item?.is_preview || guard.allowed ? "#38BDF8" : "#F87171"}
                />
                <View style={styles.textWrap}>
                  <Text style={styles.cardText}>{item.title}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.modeText}>{item?.is_preview ? "Free" : "Paid"}</Text>
                    {savedMap[item.id] && (
                      <View style={styles.savedBadge}>
                        <Text style={styles.savedText}>Saved</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              {(item?.is_preview || guard.allowed) && (
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    savedMap[item.id] && styles.saveBtnActive,
                  ]}
                  onPress={() => toggleSave(item)}
                  disabled={busyMap[item.id]}
                >
                  <Text
                    style={[
                      styles.saveText,
                      savedMap[item.id] && styles.saveTextActive,
                    ]}
                  >
                    {busyMap[item.id]
                      ? "Saving..."
                      : savedMap[item.id]
                        ? "Delete"
                        : "Save"}
                  </Text>
                </TouchableOpacity>
              )}
              {!guard.allowed && !item?.is_preview && (
                <View style={styles.blurCover}>
                  <Text style={styles.getAccessText}>Get Access</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: { padding: 20, paddingTop: 30 },
  title: { fontSize: 22, fontWeight: "800", color: "#E5E7EB" },
  sub: { color: "#9CA3AF", marginBottom: 20 },
  empty: { color: "#94A3B8", marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
    marginLeft: 12,
  },
  saveBtn: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  saveBtnActive: {
    borderColor: "#F87171",
  },
  saveText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "800",
  },
  saveTextActive: {
    color: "#FCA5A5",
  },
  cardText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  modeText: {
    marginTop: 2,
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  savedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.18)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.35)",
  },
  savedText: {
    color: "#86EFAC",
    fontSize: 10,
    fontWeight: "800",
  },
  blurCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.55)",
    borderRadius: 18,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 14,
  },
  getAccessText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "800",
  },
  lockCard: { backgroundColor: "#020617", borderRadius: 16, padding: 14, marginTop: 8 },
  lockTitle: { color: "#E5E7EB", fontWeight: "800", marginTop: 8 },
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
  unlockText: { color: "#E2E8F0", fontWeight: "800", fontSize: 12 },
  emptyCard: {
    marginTop: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
