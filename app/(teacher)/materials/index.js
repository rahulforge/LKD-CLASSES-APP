import { ScrollView, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherClasses } from "../../../src/hooks/useTeacherClasses";
import { APP_THEME } from "../../../src/utils/constants";

export default function MaterialClasses() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { classes } = useTeacherClasses();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.title}>Materials</Text>
      <Text style={styles.sub}>Select Class</Text>

      {classes.map((cls) => (
        <TouchableOpacity
          key={cls.id}
          style={styles.card}
          onPress={() =>
            router.push(`/(teacher)/materials/${cls.id}`)
          }
        >
          <Text style={styles.cardText}>{cls.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, padding: 16 },
  title: {
    color: APP_THEME.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  sub: {
    color: APP_THEME.muted,
    fontSize: 13,
    marginBottom: 10,
  },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardText: {
    color: APP_THEME.text,
    fontSize: 15,
    fontWeight: "700",
  },
});
