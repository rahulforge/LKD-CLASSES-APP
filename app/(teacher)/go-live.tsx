import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import useAuth from "../../src/hooks/useAuth";
import { useTeacherClasses } from "../../src/hooks/useTeacherClasses";
import { classService } from "../../src/services/classService";
import { liveService } from "../../src/services/liveService";
import { livePollService } from "../../src/services/livePollService";
import { pushNotificationService } from "../../src/services/pushNotificationService";
import { toastService } from "../../src/services/toastService";
import { APP_THEME } from "../../src/utils/constants";

const makeSlot = (offsetDays: number, hour: number, minute: number) => {
  const now = new Date();
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, hour, minute, 0, 0);
  return dt;
};

const SCHEDULE_SLOTS = [
  { label: "Today 6:00 PM", date: () => makeSlot(0, 18, 0) },
  { label: "Today 8:00 PM", date: () => makeSlot(0, 20, 0) },
  { label: "Tomorrow 8:00 AM", date: () => makeSlot(1, 8, 0) },
  { label: "Tomorrow 6:00 PM", date: () => makeSlot(1, 18, 0) },
];

export default function GoLiveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { classes } = useTeacherClasses();

  const [classId, setClassId] = useState(String(params.classId ?? ""));
  const [className, setClassName] = useState(decodeURIComponent(String(params.className ?? "")));
  const [subjectId, setSubjectId] = useState(String(params.subjectId ?? ""));
  const [chapterId, setChapterId] = useState(String(params.chapterId ?? ""));
  const [title, setTitle] = useState(decodeURIComponent(String(params.title ?? "")));
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [titleEdited, setTitleEdited] = useState(Boolean(String(params.title ?? "").trim()));
  const [mode, setMode] = useState("live");
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scope, setScope] = useState<"class" | "all">("class");
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [pollSessionId, setPollSessionId] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionA, setPollOptionA] = useState("");
  const [pollOptionB, setPollOptionB] = useState("");
  const [pollOptionC, setPollOptionC] = useState("");
  const [pollOptionD, setPollOptionD] = useState("");
  const [pollDuration, setPollDuration] = useState(5);
  const [pollRows, setPollRows] = useState<any[]>([]);
  const [pollBusy, setPollBusy] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [resolvingMeta, setResolvingMeta] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedSubjectName = useMemo(
    () => subjects.find((item) => item.id === subjectId)?.name ?? "",
    [subjectId, subjects]
  );
  const selectedChapterName = useMemo(
    () => chapters.find((item) => item.id === chapterId)?.name ?? "",
    [chapterId, chapters]
  );

  const loadScheduled = useCallback(async () => {
    const rows = await liveService.getMyScheduled(user?.id);
    setScheduled(rows);
  }, [user?.id]);

  const pollSessions = useMemo(
    () =>
      (scheduled || []).filter((item) => {
        const status = String(item.status ?? "").toLowerCase();
        return status === "live" || status === "scheduled";
      }),
    [scheduled]
  );

  const loadPolls = useCallback(async (sessionId: string) => {
    const id = String(sessionId ?? "").trim();
    if (!id) {
      setPollRows([]);
      return;
    }
    setPollLoading(true);
    try {
      const rows = await livePollService.listPollsForSession(id, 15);
      setPollRows(rows);
    } catch (error: any) {
      toastService.error("Polls", error?.message ?? "Unable to load polls");
    } finally {
      setPollLoading(false);
    }
  }, []);

  const createPoll = async () => {
    const sessionId = String(pollSessionId ?? "").trim();
    if (!sessionId) {
      toastService.error("Missing", "Select live/scheduled session first.");
      return;
    }
    const options = [pollOptionA, pollOptionB, pollOptionC, pollOptionD];
    setPollBusy(true);
    try {
      await livePollService.createPoll({
        liveSessionId: sessionId,
        question: pollQuestion,
        options,
        durationMinutes: pollDuration,
      });
      setPollQuestion("");
      setPollOptionA("");
      setPollOptionB("");
      setPollOptionC("");
      setPollOptionD("");
      await loadPolls(sessionId);
      toastService.success("Poll created", "Students can vote in live player.");
    } catch (error: any) {
      toastService.error("Poll failed", error?.message ?? "Unable to create poll");
    } finally {
      setPollBusy(false);
    }
  };

  const closePoll = async (pollId: string) => {
    setPollBusy(true);
    try {
      await livePollService.closePoll(pollId);
      await loadPolls(pollSessionId);
      toastService.success("Poll closed", "Poll has been closed.");
    } catch (error: any) {
      toastService.error("Close failed", error?.message ?? "Unable to close poll");
    } finally {
      setPollBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!title.trim() || !youtubeUrl.trim()) {
      toastService.error("Missing", "Title and URL are required.");
      return;
    }
    if (scope === "class" && !classId) {
      toastService.error("Missing", "Please select class.");
      return;
    }
    if (scope === "class" && !subjectId) {
      toastService.error("Missing", "Please select subject.");
      return;
    }
    if (scope === "class" && !chapterId) {
      toastService.error("Missing", "Please select chapter.");
      return;
    }
    if (mode === "schedule" && !scheduleAt && (!scheduleDate.trim() || !scheduleTime.trim())) {
      toastService.error("Missing", "Enter schedule date and time.");
      return;
    }

    setLoading(true);
    try {
      let manualScheduleAt: Date | null = scheduleAt;
      if (mode === "schedule" && scheduleDate.trim() && scheduleTime.trim()) {
        const dateMatch = scheduleDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const timeRaw = scheduleTime.trim().toUpperCase();
        const timeMatch24 = timeRaw.match(/^(\d{1,2}):(\d{2})$/);
        const timeMatch12 = timeRaw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

        if (!dateMatch || (!timeMatch24 && !timeMatch12)) {
          toastService.error("Invalid", "Use date YYYY-MM-DD and time HH:MM or HH:MM AM/PM");
          setLoading(false);
          return;
        }

        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]) - 1;
        const day = Number(dateMatch[3]);

        let hours = 0;
        let minutes = 0;
        if (timeMatch24) {
          hours = Number(timeMatch24[1]);
          minutes = Number(timeMatch24[2]);
        } else if (timeMatch12) {
          hours = Number(timeMatch12[1]) % 12;
          minutes = Number(timeMatch12[2]);
          if (timeMatch12[3] === "PM") hours += 12;
        }

        const dt = new Date(year, month, day, hours, minutes, 0, 0);
        if (Number.isNaN(dt.getTime())) {
          toastService.error("Invalid", "Unable to parse schedule date/time.");
          setLoading(false);
          return;
        }
        manualScheduleAt = dt;
      }

      const finalStartsAt = mode === "schedule" ? manualScheduleAt?.toISOString() ?? null : null;
      await liveService.goLive({
        title: title.trim(),
        classId: scope === "all" ? undefined : classId,
        subjectId: scope === "all" ? undefined : subjectId || undefined,
        chapterId: scope === "all" ? undefined : chapterId || undefined,
        className: scope === "all" ? "All Students" : className,
        youtubeUnlistedUrl: youtubeUrl.trim(),
        teacherId: user?.id,
        startsAt: finalStartsAt,
        scope,
      });
      try {
        await pushNotificationService.sendToStudents({
          title: mode === "schedule" ? "Class Scheduled" : "Live Class Started",
          body:
            scope === "all"
              ? `${title.trim()} for all students.`
              : `${title.trim()} for your class.`,
          audience:
            scope === "all"
              ? { scope: "all" }
              : { scope: "class", classId },
          data: {
            type: mode === "schedule" ? "live_scheduled" : "live_now",
            classId: scope === "all" ? null : classId,
            subjectId: scope === "all" ? null : subjectId,
            chapterId: scope === "all" ? null : chapterId,
            startsAt: finalStartsAt,
          },
        });
      } catch {
        // Live/schedule action should not fail on notification dispatch issues.
      }
      toastService.success(
        "Success",
        mode === "schedule" ? "Class scheduled successfully." : "Live class started successfully."
      );
      setTitle("");
      setYoutubeUrl("");
      setScheduleAt(null);
      setScheduleDate("");
      setScheduleTime("");
      setMode("live");
      setSubjectId("");
      setChapterId("");
      setTitleEdited(false);
      await loadScheduled();
    } catch (error: any) {
      toastService.error("Failed", error?.message ?? "Unable to submit");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadScheduled();
  }, [loadScheduled]);

  useEffect(() => {
    if (!pollSessions.length) {
      setPollSessionId("");
      setPollRows([]);
      return;
    }
    if (!pollSessionId || !pollSessions.some((item) => item.id === pollSessionId)) {
      setPollSessionId(String(pollSessions[0].id));
    }
  }, [pollSessions, pollSessionId]);

  useEffect(() => {
    if (!pollSessionId) return;
    void loadPolls(pollSessionId);
  }, [loadPolls, pollSessionId]);

  useEffect(() => {
    let active = true;
    const loadSubjects = async () => {
      if (!classId || scope !== "class") {
        setSubjects([]);
        setSubjectId("");
        setChapterId("");
        return;
      }
      const next = await classService.getTeacherSubjects(classId);
      if (!active) return;
      setSubjects(next);
      if (!next.find((item) => item.id === subjectId)) {
        const firstId = next[0]?.id ?? "";
        setSubjectId(firstId);
        setChapterId("");
      }
    };
    void loadSubjects();
    return () => {
      active = false;
    };
  }, [classId, scope, subjectId]);

  useEffect(() => {
    let active = true;
    const loadChapters = async () => {
      if (!subjectId || scope !== "class") {
        setChapters([]);
        setChapterId("");
        return;
      }
      const next = await classService.getTeacherChapters(subjectId);
      if (!active) return;
      setChapters(next);
      if (!next.find((item) => item.id === chapterId)) {
        setChapterId(next[0]?.id ?? "");
      }
    };
    void loadChapters();
    return () => {
      active = false;
    };
  }, [subjectId, scope, chapterId]);

  useEffect(() => {
    if (scope !== "class") return;
    if (titleEdited) return;
    const autoTitle = [selectedSubjectName, selectedChapterName]
      .filter(Boolean)
      .join(" - ");
    if (autoTitle) {
      setTitle(autoTitle);
    }
  }, [scope, selectedSubjectName, selectedChapterName, titleEdited]);

  useEffect(() => {
    const raw = youtubeUrl.trim();
    if (!raw) return;

    const timer = setTimeout(async () => {
      setResolvingMeta(true);
      try {
        const meta = await liveService.resolveYouTubeMeta(raw);
        setYoutubeUrl(meta.normalizedUrl || raw);
        if (!titleEdited && meta.suggestedTitle) {
          setTitle(meta.suggestedTitle);
        }
      } finally {
        setResolvingMeta(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [youtubeUrl, titleEdited]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(10, insets.top), paddingBottom: 110 + insets.bottom }}
    >
      <Text style={styles.heading}>Live / Schedule Class</Text>
      <Text style={styles.meta}>Teacher can go live now or schedule class for class-wise dashboard visibility.</Text>

      <Text style={styles.label}>Audience</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.modeBtn, scope === "class" && styles.modeBtnActive]}
          onPress={() => setScope("class")}
        >
          <Text style={[styles.modeText, scope === "class" && styles.modeTextActive]}>Class</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, scope === "all" && styles.modeBtnActive]}
          onPress={() => setScope("all")}
        >
          <Text style={[styles.modeText, scope === "all" && styles.modeTextActive]}>All Students</Text>
        </TouchableOpacity>
      </View>
      {scope === "class" && (
        <>
          <Text style={styles.label}>Class</Text>
          <View style={styles.chips}>
            {classes.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, classId === item.id && styles.chipActive]}
                onPress={() => {
                  setClassId(item.id);
                  setClassName(item.name);
                  setSubjectId("");
                  setChapterId("");
                }}
              >
                <Text style={styles.chipText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!subjects.length && (
            <>
              <Text style={styles.label}>Subject</Text>
              <View style={styles.chips}>
                {subjects.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, subjectId === item.id && styles.chipActive]}
                    onPress={() => {
                      setSubjectId(item.id);
                      setChapterId("");
                    }}
                  >
                    <Text style={styles.chipText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {!!chapters.length && (
            <>
              <Text style={styles.label}>Chapter</Text>
              <View style={styles.chips}>
                {chapters.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.chip, chapterId === item.id && styles.chipActive]}
                    onPress={() => setChapterId(item.id)}
                  >
                    <Text style={styles.chipText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </>
      )}

      <Text style={styles.label}>Mode</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "live" && styles.modeBtnActive]}
          onPress={() => setMode("live")}
        >
          <Text style={[styles.modeText, mode === "live" && styles.modeTextActive]}>Go Live Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "schedule" && styles.modeBtnActive]}
          onPress={() => setMode("schedule")}
        >
          <Text style={[styles.modeText, mode === "schedule" && styles.modeTextActive]}>
            Schedule Class
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          setTitleEdited(Boolean(value.trim()));
        }}
        placeholderTextColor={APP_THEME.muted}
        placeholder="Auto from chapter or YouTube title"
      />

      <Text style={styles.label}>YouTube Unlisted URL</Text>
      <TextInput
        style={styles.input}
        value={youtubeUrl}
        onChangeText={setYoutubeUrl}
        placeholderTextColor={APP_THEME.muted}
        placeholder="https://youtube.com/watch?v=..."
      />
      {resolvingMeta && <Text style={styles.hint}>Fetching YouTube title...</Text>}

      {mode === "schedule" && (
        <>
          <Text style={styles.label}>Schedule At</Text>
          <TextInput
            style={styles.input}
            value={scheduleDate}
            onChangeText={setScheduleDate}
            placeholder="YYYY-MM-DD (e.g. 2026-03-20)"
            placeholderTextColor={APP_THEME.muted}
          />
          <TextInput
            style={styles.input}
            value={scheduleTime}
            onChangeText={setScheduleTime}
            placeholder="HH:MM or 07:00 PM"
            placeholderTextColor={APP_THEME.muted}
          />
          <Text style={styles.hint}>You can manually enter exact date/time or use quick slots below.</Text>
          <View style={styles.chips}>
            {SCHEDULE_SLOTS.map((slot) => {
              const dt = slot.date();
              const active = scheduleAt?.toISOString() === dt.toISOString();
              return (
                <TouchableOpacity
                  key={slot.label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setScheduleAt(dt)}
                >
                  <Text style={styles.chipText}>{slot.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {scheduleAt && <Text style={styles.hint}>Selected: {scheduleAt.toLocaleString("en-IN")}</Text>}
        </>
      )}

      <TouchableOpacity style={styles.btn} disabled={loading} onPress={onSubmit}>
        <Text style={styles.btnText}>{loading ? "Submitting..." : mode === "schedule" ? "Schedule Class" : "Go Live Now"}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Scheduled / Live</Text>
      <View style={styles.card}>
        {scheduled.map((item) => (
          <View key={item.id} style={styles.sessionRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionTitle}>{item.title}</Text>
              <Text style={styles.sessionMeta}>{new Date(item.starts_at).toLocaleString("en-IN")} | {item.status}</Text>
            </View>
            <View style={styles.sessionActions}>
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() =>
                  router.push({
                    pathname: "/(teacher)/classes/player",
                    params: {
                      url: item.youtube_unlisted_url,
                      title: encodeURIComponent(item.title || "Live Class"),
                      liveSessionId: item.id,
                      teacherMode: "1",
                    },
                  })
                }
              >
                <Text style={styles.openText}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={async () => {
                  await liveService.cancelSession(item.id);
                  await loadScheduled();
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {!scheduled.length && <Text style={styles.hint}>No upcoming sessions.</Text>}
      </View>

      <Text style={styles.label}>Live Poll</Text>
      <View style={styles.card}>
        <Text style={styles.pollMeta}>Create one active poll for current/scheduled live session.</Text>

        <View style={styles.chips}>
          {pollSessions.map((item) => {
            const active = pollSessionId === item.id;
            return (
              <TouchableOpacity
                key={`poll-session-${item.id}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setPollSessionId(String(item.id))}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
          {!pollSessions.length && <Text style={styles.hint}>Create or schedule a session first.</Text>}
        </View>

        {!!pollSessionId && (
          <>
            <Text style={styles.label}>Question</Text>
            <TextInput
              style={styles.input}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholderTextColor={APP_THEME.muted}
              placeholder="What should we revise first?"
            />
            <Text style={styles.label}>Options</Text>
            <TextInput
              style={styles.input}
              value={pollOptionA}
              onChangeText={setPollOptionA}
              placeholderTextColor={APP_THEME.muted}
              placeholder="Option 1"
            />
            <TextInput
              style={styles.input}
              value={pollOptionB}
              onChangeText={setPollOptionB}
              placeholderTextColor={APP_THEME.muted}
              placeholder="Option 2"
            />
            <TextInput
              style={styles.input}
              value={pollOptionC}
              onChangeText={setPollOptionC}
              placeholderTextColor={APP_THEME.muted}
              placeholder="Option 3 (optional)"
            />
            <TextInput
              style={styles.input}
              value={pollOptionD}
              onChangeText={setPollOptionD}
              placeholderTextColor={APP_THEME.muted}
              placeholder="Option 4 (optional)"
            />

            <Text style={styles.label}>Duration</Text>
            <View style={styles.row}>
              {[2, 5, 10].map((mins) => (
                <TouchableOpacity
                  key={`dur-${mins}`}
                  style={[styles.modeBtn, pollDuration === mins && styles.modeBtnActive]}
                  onPress={() => setPollDuration(mins)}
                >
                  <Text style={[styles.modeText, pollDuration === mins && styles.modeTextActive]}>
                    {mins} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.btn} disabled={pollBusy} onPress={createPoll}>
              <Text style={styles.btnText}>{pollBusy ? "Please wait..." : "Create Poll"}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Recent Polls</Text>
            <View style={styles.pollListBox}>
              {pollLoading ? (
                <Text style={styles.hint}>Loading polls...</Text>
              ) : pollRows.length ? (
                pollRows.map((item) => (
                  <View key={item.id} style={styles.sessionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTitle}>{item.question}</Text>
                      <Text style={styles.sessionMeta}>
                        {item.status}
                        {item.expires_at ? ` | Ends ${new Date(item.expires_at).toLocaleTimeString("en-IN")}` : ""}
                      </Text>
                    </View>
                    {String(item.status ?? "").toLowerCase() === "active" && (
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => void closePoll(item.id)}>
                        <Text style={styles.cancelText}>Close</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.hint}>No polls for selected session.</Text>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_THEME.bg, paddingHorizontal: 16 },
  heading: { color: APP_THEME.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  meta: { color: APP_THEME.muted, marginBottom: 12 },
  label: { color: APP_THEME.muted, fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: APP_THEME.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: APP_THEME.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: APP_THEME.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: `${APP_THEME.primary}33` },
  chipText: { color: APP_THEME.text, fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    backgroundColor: APP_THEME.card,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: `${APP_THEME.primary}33` },
  modeText: { color: APP_THEME.muted, fontWeight: "700", fontSize: 12 },
  modeTextActive: { color: APP_THEME.primary },
  hint: { color: APP_THEME.muted, fontSize: 11, marginTop: 4 },
  pollMeta: { color: APP_THEME.muted, fontSize: 11, marginBottom: 4 },
  pollListBox: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_THEME.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: APP_THEME.bg,
  },
  card: {
    marginTop: 4,
    backgroundColor: APP_THEME.card,
    borderRadius: 12,
    padding: 10,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: APP_THEME.border,
  },
  sessionTitle: { color: APP_THEME.text, fontSize: 12, fontWeight: "700" },
  sessionMeta: { color: APP_THEME.muted, fontSize: 11, marginTop: 2 },
  sessionActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  openBtn: {
    backgroundColor: `${APP_THEME.primary}22`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openText: { color: APP_THEME.primary, fontSize: 11, fontWeight: "700" },
  cancelBtn: {
    backgroundColor: `${APP_THEME.danger}22`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelText: { color: APP_THEME.danger, fontSize: 11, fontWeight: "700" },
  btn: {
    marginTop: 14,
    backgroundColor: APP_THEME.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: APP_THEME.bg, fontWeight: "800", fontSize: 13 },
});
