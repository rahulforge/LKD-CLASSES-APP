import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LoadingView from "../../src/components/LoadingView";
import { galleryService } from "../../src/services/galleryService";
import { uploadService } from "../../src/services/uploadService";
import { APP_THEME } from "../../src/utils/constants";
import { toastService } from "../../src/services/toastService";

export default function UploadGalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [albums, setAlbums] = useState<{ id: string; title: string }[]>([]);
  const [albumPhotos, setAlbumPhotos] = useState<{ id: string; image_url: string }[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState("");
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setNewAlbumTitle("");
      };
    }, [])
  );

  useEffect(() => {
    let mounted = true;

    const loadAlbums = async () => {
      const data = await galleryService.getAlbums();
      if (!mounted) return;
      setAlbums(data.map((item) => ({ id: item.id, title: item.title })));
      if (data[0]?.id) {
        setSelectedAlbumId(data[0].id);
      }
      setScreenLoading(false);
    };

    void loadAlbums();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadPhotos = async () => {
      if (!selectedAlbumId) {
        setAlbumPhotos([]);
        return;
      }
      const data = await galleryService.getAlbumImages(selectedAlbumId);
      if (!mounted) return;
      setAlbumPhotos((data ?? []).slice(0, 8));
    };
    void loadPhotos();
    return () => {
      mounted = false;
    };
  }, [selectedAlbumId]);

  const upload = async () => {
    if (!selectedAlbumId && !newAlbumTitle.trim()) {
      toastService.error("Missing", "Select existing album or enter new album title.");
      return;
    }

    setLoading(true);
    try {
      const secureUrl = await uploadService.uploadFile({
        type: "image/*",
        resourceType: "image",
      });

      let targetAlbumId = selectedAlbumId;

      if (!targetAlbumId && newAlbumTitle.trim()) {
        const created = await galleryService.createAlbum({
          title: newAlbumTitle.trim(),
          cover_url: secureUrl,
        });

        targetAlbumId = created.id;
        setAlbums((prev) => [
          { id: created.id, title: created.title },
          ...prev,
        ]);
        setSelectedAlbumId(created.id);
        setNewAlbumTitle("");
      }

      await galleryService.saveAlbumImage({
        album_id: targetAlbumId,
        image_url: secureUrl,
      });

      if (targetAlbumId) {
        const refreshed = await galleryService.getAlbumImages(targetAlbumId);
        setAlbumPhotos((refreshed ?? []).slice(0, 8));
      }
      toastService.success("Success", "Gallery photo uploaded");
    } catch (error: any) {
      toastService.error("Upload failed", error?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (screenLoading) {
    return <LoadingView text="Loading albums..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: Math.max(10, insets.top),
        paddingBottom: 110 + insets.bottom,
      }}
    >
      <Text style={styles.heading}>Upload Gallery Photo</Text>
      <Text style={styles.meta}>Choose existing album or create a new one.</Text>

      <Text style={styles.label}>Existing Albums</Text>
      <View style={styles.chips}>
        {albums.map((album) => (
          <TouchableOpacity
            key={album.id}
            style={[styles.chip, selectedAlbumId === album.id && styles.chipActive]}
            onPress={() => {
              setSelectedAlbumId(album.id);
              setNewAlbumTitle("");
            }}
          >
            <Text style={styles.chipText}>{album.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Or Create New Album</Text>
      <TextInput
        value={newAlbumTitle}
        onChangeText={(v) => {
          setNewAlbumTitle(v);
          if (v.trim()) {
            setSelectedAlbumId("");
          }
        }}
        style={styles.input}
        placeholder="e.g. Annual Function 2026"
        placeholderTextColor={APP_THEME.muted}
      />

      {!!selectedAlbumId && (
        <View style={styles.previewWrap}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Selected Album Photos</Text>
            <TouchableOpacity onPress={() => router.push(`/(public)/gallery/${selectedAlbumId}`)}>
              <Text style={styles.openLink}>Open Album</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {albumPhotos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photo.image_url }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ))}
            {!albumPhotos.length && <Text style={styles.empty}>No photos yet.</Text>}
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.btn} onPress={upload} disabled={loading}>
        <Text style={styles.btnText}>{loading ? "Uploading..." : "Select Image & Upload"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, padding: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  meta: { color: APP_THEME.muted, marginBottom: 12 },
  label: { color: APP_THEME.muted, fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: APP_THEME.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: APP_THEME.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: `${APP_THEME.primary}33`,
  },
  chipText: {
    color: APP_THEME.text,
    fontSize: 12,
    fontWeight: "700",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewWrap: {
    marginTop: 8,
    marginBottom: 6,
  },
  openLink: {
    color: APP_THEME.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  grid: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thumb: {
    width: "23%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: APP_THEME.card,
  },
  empty: {
    color: APP_THEME.muted,
    fontSize: 12,
  },
  btn: {
    marginTop: 16,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
