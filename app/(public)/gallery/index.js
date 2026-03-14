import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { galleryService } from "../../../src/services/galleryService";

export default function Gallery() {
  const router = useRouter();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await galleryService.getAlbums();
        if (!mounted) return;
        setAlbums(data || []);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => (mounted = false);
  }, []);

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
        <Text style={styles.title}>Gallery</Text>
        <Text style={styles.subtitle}>
          Moments from LKD Classes
        </Text>

        {albums.length === 0 && (
          <Text style={styles.empty}>
            Gallery will be updated soon.
          </Text>
        )}

        <View style={styles.grid}>
          {albums.map((album) => (
            <TouchableOpacity
              key={album.id}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() =>
                router.push(`/gallery/${album.id}`)
              }
            >
              <Image
                source={{ uri: album.cover_url }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <View style={styles.overlay}>
                <Text style={styles.caption}>
                  {album.title}
                </Text>
              </View>
            </TouchableOpacity>
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
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#38BDF8",
  },
  subtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 20,
  },
  empty: {
    color: "#9CA3AF",
    marginTop: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    height: 160,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#111827",
    marginBottom: 14,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  caption: {
    fontSize: 12,
    fontWeight: "600",
    color: "#E5E7EB",
  },
});
