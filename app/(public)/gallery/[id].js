import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { galleryService } from "../../../src/services/galleryService";

export default function AlbumScreen() {
  const { id } = useLocalSearchParams();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await galleryService.getAlbumImages(
          String(id)
        );
        if (!mounted) return;
        setPhotos(data || []);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => (mounted = false);
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {photos.length === 0 && (
          <Text style={styles.empty}>
            No photos in this album yet.
          </Text>
        )}

        <View style={styles.grid}>
          {photos.map((item) => (
            <Image
              key={item.id}
              source={{ uri: item.image_url }}
              style={styles.photo}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0B1220",
    paddingTop: 20,
  },
  container: {
    padding: 20,
  },
  empty: {
    color: "#9CA3AF",
    marginBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  photo: {
    width: "48%",
    height: 150,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: "#111827",
  },
});
