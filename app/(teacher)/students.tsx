import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherClasses } from "../../src/hooks/useTeacherClasses";
import { useTeacherStudents } from "../../src/hooks/useTeacherStudents";
import type { TeacherStudent } from "../../src/types/teacher";
import { APP_THEME } from "../../src/utils/constants";

type FilterType = "all";
type ProgramFilter = "all" | "school" | "competitive";

const EMPTY_NEW_STUDENT = {
  name: "",
  phone: "",
  class_id: "",
  category: "school" as "school" | "competitive",
  roll_number: "",
};

const formatRoll = (roll: string | null | undefined) => {
  const raw = String(roll ?? "");
  const digits = raw.match(/\d+/g)?.join("") ?? "";
  return digits || raw || "-";
};

const isCompetitiveClassName = (name: string) =>
  String(name ?? "").toLowerCase().includes("competitive");

export default function StudentsScreen() {
  const insets = useSafeAreaInsets();
  const { classes } = useTeacherClasses();
  const [activeClassId, setActiveClassId] = useState("");
  const [classFilter, setClassFilter] = useState<ProgramFilter>("all");
  const [editing, setEditing] = useState<TeacherStudent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newStudent, setNewStudent] = useState(EMPTY_NEW_STUDENT);
  const [saving, setSaving] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessActive, setAccessActive] = useState(false);
  const [accessUntil, setAccessUntil] = useState("");

  const {
    search,
    setSearch,
    filter,
    setFilter,
    page,
    setPage,
    rows,
    pageCount,
    loading,
    refreshing,
    refresh,
    updateStudent,
    addStudent,
    deleteStudent,
    getStudentAccess,
    setStudentAccess,
  } = useTeacherStudents({ classId: activeClassId || undefined });

  const filterOptions = useMemo(() => ["all"] as FilterType[], []);

  const orderedClasses = useMemo(
    () =>
      [...classes].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      ),
    [classes]
  );
  const schoolClasses = useMemo(
    () => orderedClasses.filter((item) => !isCompetitiveClassName(item.name)),
    [orderedClasses]
  );
  const competitiveClasses = useMemo(
    () => orderedClasses.filter((item) => isCompetitiveClassName(item.name)),
    [orderedClasses]
  );
  const visibleClasses = useMemo(() => {
    if (classFilter === "school") return schoolClasses;
    if (classFilter === "competitive") return competitiveClasses;
    return orderedClasses;
  }, [classFilter, competitiveClasses, orderedClasses, schoolClasses]);

  const activeClassName =
    classes.find((item) => item.id === activeClassId)?.name ?? "Students";

  const goBackToClassList = () => {
    setActiveClassId("");
    setSearch("");
    setPage(1);
  };

  useEffect(() => {
    if (!activeClassId) return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setActiveClassId("");
      setSearch("");
      setPage(1);
      return true;
    });

    return () => sub.remove();
  }, [activeClassId, setPage, setSearch]);

  useEffect(() => {
    let mounted = true;
    const loadAccess = async () => {
      if (!editing) return;
      setAccessLoading(true);
      try {
        const data = await getStudentAccess({
          studentId: editing.id,
          userId: editing.user_id,
        });
        if (!mounted) return;
        setAccessActive(Boolean(data?.is_active));
        setAccessUntil(data?.expires_at ? String(data.expires_at).slice(0, 10) : "");
      } finally {
        if (mounted) setAccessLoading(false);
      }
    };
    void loadAccess();
    return () => {
      mounted = false;
    };
  }, [editing, getStudentAccess]);

  const resetCreateForm = () => {
    setNewStudent({ ...EMPTY_NEW_STUDENT, class_id: activeClassId || "" });
  };

  const onCreate = async () => {
    if (!newStudent.name.trim() || !newStudent.class_id) return;
    setSaving(true);
    try {
      await addStudent({
        ...newStudent,
        name: newStudent.name.trim(),
        phone: newStudent.phone.trim() || null,
        roll_number: newStudent.roll_number.trim() || null,
        student_type: "online",
      });
      setCreateOpen(false);
      resetCreateForm();
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateStudent(editing.id, {
        name: editing.name,
        roll_number: editing.roll_number,
        phone: editing.phone,
        class_id: editing.class_id,
        category: editing.category,
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteStudent = (student: TeacherStudent) => {
    Alert.alert(
      "Delete Student",
      `Delete ${student.name}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteStudent(student.id);
            setEditing(null);
          },
        },
      ]
    );
  };

  const onSaveAccess = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await setStudentAccess({
        studentId: editing.id,
        userId: editing.user_id,
        isActive: accessActive,
        expiresAt: accessUntil.trim() || null,
      });
      Alert.alert("Updated", "Student access updated successfully.");
      setEditing(null);
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Unable to update access");
    } finally {
      setSaving(false);
    }
  };

  if (!activeClassId) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: Math.max(10, insets.top), paddingBottom: 88 + insets.bottom },
        ]}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.heading}>Students</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            <Ionicons name="person-add" size={14} color={APP_THEME.bg} />
            <Text style={styles.addBtnText}>Add Student</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.metaText}>Select class to open student list.</Text>
        <View style={styles.filterRow}>
          <Choice label="All" active={classFilter === "all"} onPress={() => setClassFilter("all")} />
          <Choice
            label="School"
            active={classFilter === "school"}
            onPress={() => setClassFilter("school")}
          />
          <Choice
            label="Competitive"
            active={classFilter === "competitive"}
            onPress={() => setClassFilter("competitive")}
          />
        </View>

        <FlatList
          data={visibleClasses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.classCard}
              onPress={() => setActiveClassId(item.id)}
            >
              <Text style={styles.className}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={APP_THEME.muted} />
            </TouchableOpacity>
          )}
        />

        <StudentCreateModal
          visible={createOpen}
          saving={saving}
          classes={classes}
          data={newStudent}
          onClose={() => setCreateOpen(false)}
          onChange={setNewStudent}
          onSubmit={onCreate}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(10, insets.top), paddingBottom: 80 + insets.bottom },
      ]}
    >
      <View style={styles.rowBetween}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={goBackToClassList}
        >
          <Ionicons name="arrow-back" size={16} color={APP_THEME.text} />
          <Text style={styles.backText}>Classes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
        >
          <Ionicons name="person-add" size={14} color={APP_THEME.bg} />
          <Text style={styles.addBtnText}>Add Student</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.heading}>{activeClassName}</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or roll number"
        placeholderTextColor={APP_THEME.muted}
        style={styles.search}
      />

      {filterOptions.map(() => null)}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && !loading}
            onRefresh={refresh}
            tintColor={APP_THEME.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setEditing(item)}>
            <View style={styles.rowBetween}>
              <Text style={styles.rollCell}>{formatRoll(item.roll_number)}</Text>
              <Text style={styles.nameCell}>{item.name}</Text>
              <Ionicons name="create-outline" size={18} color={APP_THEME.primary} />
            </View>
          </TouchableOpacity>
        )}
      />

      <View style={[styles.pager, { bottom: 66 + insets.bottom }]}>
        <TouchableOpacity disabled={page <= 1} onPress={() => setPage(page - 1)}>
          <Text style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}>Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pageText}>
          Page {page} / {pageCount}
        </Text>
        <TouchableOpacity disabled={page >= pageCount} onPress={() => setPage(page + 1)}>
          <Text style={[styles.pagerBtn, page >= pageCount && styles.pagerDisabled]}>Next</Text>
        </TouchableOpacity>
      </View>

      <StudentEditModal
        visible={Boolean(editing)}
        saving={saving}
        student={editing}
        classes={classes}
        onClose={() => setEditing(null)}
        onChange={setEditing}
        onSave={onSave}
        onSaveAccess={onSaveAccess}
        accessLoading={accessLoading}
        accessActive={accessActive}
        accessUntil={accessUntil}
        onChangeAccessActive={setAccessActive}
        onChangeAccessUntil={setAccessUntil}
        onDelete={onDeleteStudent}
      />

      <StudentCreateModal
        visible={createOpen}
        saving={saving}
        classes={classes}
        data={newStudent}
        onClose={() => setCreateOpen(false)}
        onChange={setNewStudent}
        onSubmit={onCreate}
      />
    </View>
  );
}

function StudentCreateModal({
  visible,
  saving,
  classes,
  data,
  onClose,
  onChange,
  onSubmit,
}: {
  visible: boolean;
  saving: boolean;
  classes: { id: string; name: string }[];
  data: typeof EMPTY_NEW_STUDENT;
  onClose: () => void;
  onChange: (next: typeof EMPTY_NEW_STUDENT) => void;
  onSubmit: () => Promise<void>;
}) {
  const schoolClasses = useMemo(
    () => classes.filter((item) => !isCompetitiveClassName(item.name)),
    [classes]
  );
  const competitiveClasses = useMemo(
    () => classes.filter((item) => isCompetitiveClassName(item.name)),
    [classes]
  );
  const categoryClasses = data.category === "competitive" ? competitiveClasses : schoolClasses;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.sheetTitle}>Add Student</Text>
          <Input label="Name" value={data.name} onChangeText={(v) => onChange({ ...data, name: v })} />
          <Input label="Phone" value={data.phone} onChangeText={(v) => onChange({ ...data, phone: v })} />

          <Text style={styles.inputLabel}>Class</Text>
          <View style={styles.chips}>
            {categoryClasses.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.chip, data.class_id === cls.id && styles.chipActive]}
                onPress={() => onChange({ ...data, class_id: cls.id })}
              >
                <Text style={styles.chipText}>{cls.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Roll Number (optional)"
            value={data.roll_number}
            onChangeText={(v) => onChange({ ...data, roll_number: v })}
          />
          <Text style={styles.hintText}>Empty chhodne par auto roll generate hoga.</Text>


          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.inlineRow}>
            <Choice
              label="School"
              active={data.category === "school"}
              onPress={() =>
                onChange({
                  ...data,
                  category: "school",
                  class_id: schoolClasses.find((item) => item.id === data.class_id)
                    ? data.class_id
                    : schoolClasses[0]?.id ?? "",
                })
              }
            />
            <Choice
              label="Competitive"
              active={data.category === "competitive"}
              onPress={() =>
                onChange({
                  ...data,
                  category: "competitive",
                  class_id: competitiveClasses.find((item) => item.id === data.class_id)
                    ? data.class_id
                    : competitiveClasses[0]?.id ?? "",
                })
              }
            />
          </View>

          <TouchableOpacity disabled={saving} style={styles.saveBtn} onPress={onSubmit}>
            <Text style={styles.saveText}>{saving ? "Saving..." : "Create Student"}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StudentEditModal({
  visible,
  saving,
  student,
  classes,
  onClose,
  onChange,
  onSave,
  onSaveAccess,
  accessLoading,
  accessActive,
  accessUntil,
  onChangeAccessActive,
  onChangeAccessUntil,
  onDelete,
}: {
  visible: boolean;
  saving: boolean;
  student: TeacherStudent | null;
  classes: { id: string; name: string }[];
  onClose: () => void;
  onChange: (student: TeacherStudent | null) => void;
  onSave: () => Promise<void>;
  onSaveAccess: () => Promise<void>;
  accessLoading: boolean;
  accessActive: boolean;
  accessUntil: string;
  onChangeAccessActive: (value: boolean) => void;
  onChangeAccessUntil: (value: string) => void;
  onDelete: (student: TeacherStudent) => void;
}) {
  const schoolClasses = useMemo(
    () => classes.filter((item) => !isCompetitiveClassName(item.name)),
    [classes]
  );
  const competitiveClasses = useMemo(
    () => classes.filter((item) => isCompetitiveClassName(item.name)),
    [classes]
  );
  const categoryClasses =
    student?.category === "competitive" ? competitiveClasses : schoolClasses;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.sheetTitle}>Edit Student</Text>
          {student && (
            <>
              <Input label="Name" value={student.name} onChangeText={(v) => onChange({ ...student, name: v })} />
              <Input
                label="Roll Number"
                value={student.roll_number ?? ""}
                onChangeText={(v) => onChange({ ...student, roll_number: v })}
              />
              <Input
                label="Phone"
                value={student.phone ?? ""}
                onChangeText={(v) => onChange({ ...student, phone: v })}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.inlineRow}>
                <Choice
                  label="School"
                  active={student.category === "school"}
                  onPress={() =>
                    onChange({
                      ...student,
                      category: "school",
                      class_id: schoolClasses.find((item) => item.id === student.class_id)
                        ? student.class_id
                        : schoolClasses[0]?.id ?? null,
                    })
                  }
                />
                <Choice
                  label="Competitive"
                  active={student.category === "competitive"}
                  onPress={() =>
                    onChange({
                      ...student,
                      category: "competitive",
                      class_id: competitiveClasses.find((item) => item.id === student.class_id)
                        ? student.class_id
                        : competitiveClasses[0]?.id ?? null,
                    })
                  }
                />
              </View>

              <Text style={styles.inputLabel}>Class</Text>
              <View style={styles.chips}>
                {categoryClasses.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.chip, student.class_id === cls.id && styles.chipActive]}
                    onPress={() => onChange({ ...student, class_id: cls.id, class_name: cls.name })}
                  >
                    <Text style={styles.chipText}>{cls.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => onDelete(student)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={saving} style={styles.actionBtn} onPress={onSave}>
                  <Text style={styles.saveText}>{saving ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterBtn, active && styles.filterBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Input({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        placeholderTextColor={APP_THEME.muted}
      />
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
    marginBottom: 8,
  },
  metaText: {
    color: APP_THEME.muted,
    fontSize: 12,
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  classCard: {
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  className: {
    color: APP_THEME.text,
    fontSize: 14,
    fontWeight: "700",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: APP_THEME.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backText: {
    color: APP_THEME.text,
    fontSize: 12,
    fontWeight: "700",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: APP_THEME.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addBtnText: {
    color: APP_THEME.bg,
    fontSize: 12,
    fontWeight: "800",
  },
  search: {
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    color: APP_THEME.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  filterBtn: {
    backgroundColor: APP_THEME.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterBtnActive: {
    backgroundColor: `${APP_THEME.primary}33`,
  },
  filterText: {
    color: APP_THEME.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextActive: {
    color: APP_THEME.primary,
  },
  list: {
    paddingBottom: 80,
    gap: 8,
  },
  card: {
    backgroundColor: APP_THEME.card,
    borderRadius: 14,
    padding: 12,
  },
  rollCell: {
    width: 74,
    color: APP_THEME.primary,
    fontWeight: "800",
    fontSize: 12,
  },
  nameCell: {
    flex: 1,
    color: APP_THEME.text,
    fontWeight: "700",
    fontSize: 14,
  },
  pager: {
    position: "absolute",
    left: 14,
    right: 14,
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pagerBtn: {
    color: APP_THEME.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  pagerDisabled: {
    color: APP_THEME.muted,
  },
  pageText: {
    color: APP_THEME.text,
    fontWeight: "700",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(2,6,23,0.6)",
  },
  sheet: {
    backgroundColor: APP_THEME.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    maxHeight: "88%",
  },
  sheetTitle: {
    color: APP_THEME.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  inputLabel: {
    color: APP_THEME.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  input: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: APP_THEME.text,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: APP_THEME.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: `${APP_THEME.primary}22`,
  },
  chipText: {
    color: APP_THEME.text,
    fontSize: 11,
    fontWeight: "700",
  },
  hintText: {
    color: APP_THEME.muted,
    fontSize: 11,
    marginTop: -2,
    marginBottom: 8,
  },
  accessCard: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: APP_THEME.border,
    paddingTop: 10,
  },
  toggleBtn: {
    marginTop: 4,
    backgroundColor: `${APP_THEME.primary}22`,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleText: {
    color: APP_THEME.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  modalActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  saveBtn: {
    marginTop: 10,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  saveText: {
    color: APP_THEME.bg,
    fontWeight: "800",
    fontSize: 13,
  },
  deleteBtn: {
    backgroundColor: `${APP_THEME.danger}22`,
  },
  deleteText: {
    color: APP_THEME.danger,
    fontWeight: "800",
    fontSize: 13,
  },
});
