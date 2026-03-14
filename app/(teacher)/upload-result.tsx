import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resultService } from "../../src/services/resultService";
import { APP_THEME } from "../../src/utils/constants";
import { toastService } from "../../src/services/toastService";
import { pushNotificationService } from "../../src/services/pushNotificationService";

export default function UploadResultScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const importExcel = async () => {
    setLoading(true);
    try {
      const result = await resultService.importResultsFromExcel();
      try {
        await pushNotificationService.sendToStudents({
          title: "New Results Published",
          body: `${result.imported} result records uploaded. Check your results section.`,
          audience: { scope: "all" },
          data: {
            type: "result_upload",
            imported: result.imported,
          },
        });
      } catch {
        // Result import should not fail due to push dispatch issues.
      }
      toastService.success("Import complete", `${result.imported} results uploaded.`);
    } catch (error: any) {
      toastService.error("Import failed", error?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.heading}>Upload Results (Excel/CSV)</Text>
      <Text style={styles.meta}>
        Required: roll_number, student_name, test_name/exam, year.{"\n"}
        Recommended: subject, total_marks, obtained_marks.{"\n"}
        Auto scoring supported: correct, wrong, plus_mark, negative_mark.
      </Text>

      <TouchableOpacity style={styles.btn} onPress={importExcel} disabled={loading}>
        <Text style={styles.btnText}>{loading ? "Importing..." : "Select Excel File & Import"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, padding: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  meta: { color: APP_THEME.muted, marginBottom: 14 },
  btn: {
    marginTop: 14,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
