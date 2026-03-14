import useAuth from "../../src/hooks/useAuth";
import { useNotices } from "../../src/hooks/useNotices";
import { APP_THEME } from "../../src/utils/constants";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NoticesScreen() {
  const { user } = useAuth();
  const { notices, loading, refreshing, refresh, createNotice, updateNotice, deleteNotice } = useNotices();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  const submit = async () => {
    if (!title.trim() || !message.trim() || !user?.id) {
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateNotice(editingId, {
          title,
          message,
        });
      } else {
        await createNotice({
          title,
          message,
          createdBy: user.id,
        });
      }
      setEditingId(null);
      setTitle("");
      setMessage("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(10, insets.top), paddingBottom: 80 + insets.bottom },
      ]}
    >
      <Text style={styles.heading}>Notices</Text>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editingId ? "Edit Notice" : "Create Notice"}</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          placeholder="Notice title"
          placeholderTextColor={APP_THEME.muted}
        />
        <TextInput
          value={message}
          onChangeText={setMessage}
          style={[styles.input, styles.textArea]}
          placeholder="Notice message"
          placeholderTextColor={APP_THEME.muted}
          multiline
        />
        <TouchableOpacity onPress={submit} disabled={saving} style={styles.submitBtn}>
          <Text style={styles.submitText}>{saving ? "Saving..." : editingId ? "Update Notice" : "Publish Notice"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing && !loading} onRefresh={refresh} tintColor={APP_THEME.primary} />
        }
      >
        {notices.map((notice) => (
          <View key={notice.id} style={styles.noticeCard}>
            <View style={styles.row}>
              <Text style={styles.noticeTitle}>{notice.title}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingId(notice.id);
                    setTitle(notice.title);
                    setMessage(notice.message);
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={APP_THEME.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert("Delete Notice", "Are you sure?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          void deleteNotice(notice.id);
                        },
                      },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={18} color={APP_THEME.danger} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.noticeMessage}>{notice.message}</Text>
            <Text style={styles.noticeDate}>{new Date(notice.created_at).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_THEME.bg,
    padding: 14,
  },
  heading: {
    color: APP_THEME.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  formCard: {
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  formTitle: {
    color: APP_THEME.text,
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 14,
  },
  input: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: APP_THEME.text,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  submitText: {
    color: APP_THEME.bg,
    fontWeight: "800",
    fontSize: 13,
  },
  list: {
    gap: 8,
    paddingBottom: 110,
  },
  noticeCard: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  noticeTitle: {
    color: APP_THEME.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    paddingRight: 8,
  },
  noticeMessage: {
    color: APP_THEME.muted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  noticeDate: {
    color: APP_THEME.muted,
    fontSize: 11,
    marginTop: 8,
  },
});
