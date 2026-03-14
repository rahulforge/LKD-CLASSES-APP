import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import YoutubePlayer from "react-native-youtube-iframe";
import * as ScreenOrientation from "expo-screen-orientation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { classService } from "../../../src/services/classService";
import { livePollService } from "../../../src/services/livePollService";
import { useAccessGuard } from "../../../src/hooks/useAccessGuard";
import { toastService } from "../../../src/services/toastService";

export default function Player() {
  const router = useRouter();
  const { lectureId, url, title, liveSessionId, teacherMode } = useLocalSearchParams();
  const guard = useAccessGuard("video");
  const { width: ww, height: wh } = useWindowDimensions();
  const liveUrl = String(url ?? "").trim();
  const liveTitle = decodeURIComponent(String(title ?? "Live Class"));
  const liveId = String(liveSessionId ?? "").trim();
  const isLiveSession = !lectureId && Boolean(liveUrl);
  const isTeacher = String(teacherMode ?? "").trim() === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lecture, setLecture] = useState(null);
  const [landscape, setLandscape] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [nextLectures, setNextLectures] = useState([]);
  const [loadingNext, setLoadingNext] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState("auto");
  const [showSettings, setShowSettings] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [resumeSec, setResumeSec] = useState(0);
  const [freezeMaskVisible, setFreezeMaskVisible] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(0);
  const [activePoll, setActivePoll] = useState(null);
  const [pollCounts, setPollCounts] = useState({});
  const [myVoteIndex, setMyVoteIndex] = useState(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [showPollEditor, setShowPollEditor] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionA, setPollOptionA] = useState("");
  const [pollOptionB, setPollOptionB] = useState("");
  const [pollOptionC, setPollOptionC] = useState("");
  const [pollOptionD, setPollOptionD] = useState("");
  const [pollDuration, setPollDuration] = useState(5);
  const [pollBusy, setPollBusy] = useState(false);
  const youtubeRef = useRef(null);
  const timerRef = useRef(null);
  const timelineWidthRef = useRef(0);
  const freezeTimerRef = useRef(null);
  const resumeAfterRotateRef = useRef({ time: 0, wasPlaying: false });
  const lastSavedRef = useRef(0);
  const leftTapRef = useRef(0);
  const rightTapRef = useRef(0);
  const centerTapRef = useRef(0);
  const suppressStateSyncRef = useRef(false);

  const isLandscapeOrientation = (o) =>
    o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
    o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

  useEffect(() => {
    const load = async () => {
      setError("");
      setPlayerError(false);
      setPlaying(false);
      setPlaybackRate(1);
      setQuality("auto");
      setShowSettings(false);
      setControlsVisible(true);
      setHasStartedPlayback(false);
      setFreezeMaskVisible(false);
      setCurrentSec(0);
      setTotalSec(0);
      setResumeSec(0);
      resumeAfterRotateRef.current = { time: 0, wasPlaying: false };

      if (isLiveSession) {
        setLecture({
          id: liveId ? `live_${liveId}` : `live_temp`,
          title: liveTitle || "Live Class",
          video_url: liveUrl,
          video_provider: "youtube",
          is_free: true,
          chapter_id: null,
        });
        setNextLectures([]);
        setLoading(false);
        return;
      }

      if (!lectureId) {
        setError("Lecture not found");
        setLoading(false);
        return;
      }
      const item = await classService.getLectureById(String(lectureId));
      if (!item) {
        setError("Lecture not found");
        setLoading(false);
        return;
      }
      setLecture(item);
      let cachedTime = 0;
      try {
        const raw = await AsyncStorage.getItem(`player_progress_${item.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          cachedTime = Number(parsed?.time || 0);
        }
      } catch {}
      if (cachedTime > 0) {
        setResumeSec(cachedTime);
        setCurrentSec(0);
        setHasStartedPlayback(false);
        resumeAfterRotateRef.current = { time: 0, wasPlaying: false };
      } else {
        setResumeSec(0);
      }
      if (item.chapter_id) {
        setLoadingNext(true);
        const rows = await classService.getLecturesByChapterId(String(item.chapter_id), item.id);
        setNextLectures(rows.slice(0, 20));
        setLoadingNext(false);
      } else {
        setNextLectures([]);
      }
      setLoading(false);
    };
    void load();
  }, [isLiveSession, lectureId, liveId, liveTitle, liveUrl]);

  useEffect(() => {
    setShowPollEditor(false);
    setPollQuestion("");
    setPollOptionA("");
    setPollOptionB("");
    setPollOptionC("");
    setPollOptionD("");
    setPollDuration(5);
  }, [liveId]);

  useEffect(() => {
    const sub = ScreenOrientation.addOrientationChangeListener((e) => {
      setLandscape(isLandscapeOrientation(e?.orientationInfo?.orientation));
    });
    return () => {
      ScreenOrientation.removeOrientationChangeListener(sub);
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!youtubeVideoId || !youtubeRef.current) return () => {};
    const id = setInterval(async () => {
      try {
        const [t, d] = await Promise.all([
          youtubeRef.current?.getCurrentTime?.(),
          youtubeRef.current?.getDuration?.(),
        ]);
        if (playing) {
          setCurrentSec(Number(t || 0));
        }
        setTotalSec(Number(d || 0));
      } catch {}
    }, 700);
    return () => clearInterval(id);
  }, [playing, youtubeVideoId]);

  useEffect(() => {
    if (!lecture?.id) return;
    const key = `player_progress_${lecture.id}`;
    const shouldSave = Math.abs(currentSec - lastSavedRef.current) >= 4 || !playing;
    if (!shouldSave) return;
    lastSavedRef.current = currentSec;
    void AsyncStorage.setItem(
      key,
      JSON.stringify({ time: Number(currentSec || 0), updatedAt: Date.now() })
    );
  }, [lecture?.id, currentSec, playing]);

  useEffect(() => {
    if (!freezeMaskVisible) return () => {};
    const id = setTimeout(() => setFreezeMaskVisible(false), 1500);
    return () => clearTimeout(id);
  }, [freezeMaskVisible]);

  const fetchPollData = useCallback(async () => {
    if (!isLiveSession || !liveId) {
      return { poll: null, vote: null, counts: {} };
    }
    const poll = await livePollService.getActivePollForSession(liveId);
    if (!poll) {
      return { poll: null, vote: null, counts: {} };
    }
    const [vote, counts] = await Promise.all([
      livePollService.getMyVote(poll.id).catch(() => null),
      livePollService.getVoteCounts(poll.id).catch(() => ({})),
    ]);
    return { poll, vote, counts };
  }, [isLiveSession, liveId]);

  useEffect(() => {
    if (!isLiveSession || !liveId) {
      setActivePoll(null);
      setPollCounts({});
      setMyVoteIndex(null);
      return () => {};
    }

    let mounted = true;
    const loadPoll = async () => {
      if (!mounted) return;
      setPollLoading(true);
      try {
        const { poll, vote, counts } = await fetchPollData();
        if (!mounted) return;
        setActivePoll(poll);
        setMyVoteIndex(vote);
        setPollCounts(counts);
      } finally {
        if (mounted) setPollLoading(false);
      }
    };

    void loadPoll();
    const id = setInterval(() => {
      void loadPoll();
    }, 25000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [isLiveSession, liveId, fetchPollData]);

  const locked = !isTeacher && !isLiveSession && Boolean(lecture) && !lecture.is_free && !guard.allowed;
  const embedUrl = useMemo(() => (!lecture || locked ? null : classService.getYouTubeEmbedUrl(lecture)), [lecture, locked]);
  const isYouTube = useMemo(() => {
    const raw = String(lecture?.video_url ?? "").toLowerCase();
    const provider = String(lecture?.video_provider ?? "").toLowerCase();
    return provider === "youtube" || raw.includes("youtu.be") || raw.includes("youtube.com");
  }, [lecture?.video_provider, lecture?.video_url]);
  const youtubeVideoId = useMemo(() => (lecture && isYouTube ? classService.getYouTubeVideoId(lecture) : null), [lecture, isYouTube]);
  const directVideoUrl = useMemo(() => (!embedUrl || isYouTube ? null : embedUrl), [embedUrl, isYouTube]);
  const videoWidth = landscape ? ww : Math.max(280, ww - 20);
  const videoHeight = landscape ? wh : Math.max(200, Math.round((videoWidth * 9) / 16));

  const toggleRotate = async () => {
    suppressStateSyncRef.current = true;
    setFreezeMaskVisible(true);
    const currentTime = await youtubeRef.current?.getCurrentTime?.();
    resumeAfterRotateRef.current = {
      time: Number.isFinite(Number(currentTime)) ? Number(currentTime || 0) : currentSec,
      wasPlaying: playing,
    };

    const o = await ScreenOrientation.getOrientationAsync();
    if (landscape || isLandscapeOrientation(o)) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setLandscape(false);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setLandscape(true);
    }
  };

  const handleResume = async () => {
    if (!youtubeRef.current || resumeSec <= 0) return;
    try {
      youtubeRef.current.seekTo(resumeSec, true);
      setCurrentSec(resumeSec);
    } catch {}
    playWithFreeze();
  };

  const handleBack = async () => {
    try {
      setPlaying(false);
      setHasStartedPlayback(false);
      setShowSettings(false);
      setControlsVisible(true);
      setCurrentSec(0);
      if (youtubeRef.current?.seekTo) {
        youtubeRef.current.seekTo(0, true);
      }
    } catch {}
    router.back();
  };

  const playWithFreeze = () => {
    setHasStartedPlayback(true);
    setPlaying(true);
    setFreezeMaskVisible(true);
    if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    freezeTimerRef.current = setTimeout(() => setFreezeMaskVisible(false), 1000);
  };

  const selectQuality = async (q) => {
    const wasPlaying = playing;
    if (wasPlaying) {
      setPlaying(true);
      setFreezeMaskVisible(true);
    }
    setQuality(q);
    setShowSettings(false);
    showControls();
    try {
      await youtubeRef.current?.setPlaybackQuality?.(q);
    } catch {}
    if (wasPlaying) {
      if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
      freezeTimerRef.current = setTimeout(() => setFreezeMaskVisible(false), 1000);
    }
  };

  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.findIndex((r) => r === playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    showControls();
  };

  const showControls = () => {
    setControlsVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setControlsVisible(false);
      setShowSettings(false);
    }, 2000);
  };

  const toggleControls = () => {
    if (controlsVisible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setControlsVisible(false);
      setShowSettings(false);
      return;
    }
    showControls();
  };

  const seekToRatio = async (ratio) => {
    if (!youtubeRef.current || totalSec <= 0) return;
    const target = Math.max(0, Math.min(1, ratio)) * totalSec;
    youtubeRef.current.seekTo(target, true);
    setCurrentSec(target);
  };

  const seekBy = async (delta) => {
    if (!youtubeRef.current) return;
    try {
      const t = await youtubeRef.current.getCurrentTime();
      const next = Math.max(0, Number(t || 0) + delta);
      youtubeRef.current.seekTo(next, true);
      setCurrentSec(next);
    } catch {}
  };

  const handleDoubleTapZone = (zone) => {
    const now = Date.now();
    const thresholdMs = 280;
    if (zone === "left") {
      if (now - leftTapRef.current <= thresholdMs) {
        void seekBy(-10);
        leftTapRef.current = 0;
      } else {
        leftTapRef.current = now;
      }
      showControls();
      return;
    }
    if (zone === "right") {
      if (now - rightTapRef.current <= thresholdMs) {
        void seekBy(10);
        rightTapRef.current = 0;
      } else {
        rightTapRef.current = now;
      }
      showControls();
      return;
    }
    if (now - centerTapRef.current <= thresholdMs) {
      if (playing) {
        setPlaying(false);
      } else {
        playWithFreeze();
      }
      centerTapRef.current = 0;
    } else {
      centerTapRef.current = now;
    }
    showControls();
  };

  const getThumb = (item) => {
    const id = classService.getYouTubeVideoId(item);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  };

  const formatClock = (s) => {
    const v = Math.max(0, Math.floor(Number(s || 0)));
    return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  };

  const pollOptions = useMemo(() => {
    if (!Array.isArray(activePoll?.options)) return [];
    return activePoll.options.map((item) => String(item ?? "").trim()).filter(Boolean);
  }, [activePoll?.options]);

  const totalVotes = useMemo(
    () => Object.values(pollCounts).reduce((sum, value) => sum + Number(value || 0), 0),
    [pollCounts]
  );

  const pollTimeLeftLabel = useMemo(() => {
    const raw = String(activePoll?.expires_at ?? "").trim();
    if (!raw) return "No timer";
    const end = new Date(raw).getTime();
    if (Number.isNaN(end)) return "No timer";
    const diff = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    if (diff <= 0) return "Ended";
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} left`;
  }, [activePoll?.expires_at]);

  const submitPollVote = async (optionIndex) => {
    if (!activePoll?.id || submittingVote) return;
    setSubmittingVote(true);
    try {
      await livePollService.submitVote({ pollId: activePoll.id, optionIndex });
      const [vote, counts] = await Promise.all([
        livePollService.getMyVote(activePoll.id).catch(() => optionIndex),
        livePollService.getVoteCounts(activePoll.id).catch(() => pollCounts),
      ]);
      setMyVoteIndex(vote);
      setPollCounts(counts);
      toastService.success("Vote recorded", "Your response has been submitted.");
    } catch (error) {
      toastService.error("Poll vote failed", error?.message || "Unable to submit vote.");
    } finally {
      setSubmittingVote(false);
    }
  };

  const createPoll = async () => {
    if (!isTeacher || !liveId || pollBusy) return;
    if (!pollQuestion.trim()) {
      toastService.error("Poll", "Question is required.");
      return;
    }
    const options = [pollOptionA, pollOptionB, pollOptionC, pollOptionD];
    setPollBusy(true);
    try {
      await livePollService.createPoll({
        liveSessionId: liveId,
        question: pollQuestion,
        options,
        durationMinutes: pollDuration,
      });
      setPollQuestion("");
      setPollOptionA("");
      setPollOptionB("");
      setPollOptionC("");
      setPollOptionD("");
      setShowPollEditor(false);
      const { poll, vote, counts } = await fetchPollData();
      setActivePoll(poll);
      setMyVoteIndex(vote);
      setPollCounts(counts);
      toastService.success("Poll created", "Students can vote now.");
    } catch (error) {
      toastService.error("Poll failed", error?.message || "Unable to create poll.");
    } finally {
      setPollBusy(false);
    }
  };

  const closeActivePoll = async () => {
    if (!isTeacher || !activePoll?.id || pollBusy) return;
    setPollBusy(true);
    try {
      await livePollService.closePoll(activePoll.id);
      const { poll, vote, counts } = await fetchPollData();
      setActivePoll(poll);
      setMyVoteIndex(vote);
      setPollCounts(counts);
      toastService.success("Poll closed", "Poll has been closed.");
    } catch (error) {
      toastService.error("Close failed", error?.message || "Unable to close poll.");
    } finally {
      setPollBusy(false);
    }
  };

  const playNextLecture = () => {
    if (!nextLectures.length) return;
    router.replace({
      pathname: isTeacher ? "/(teacher)/classes/player" : "/(student)/classes/player",
      params: isTeacher
        ? { lectureId: nextLectures[0].id, teacherMode: "1" }
        : { lectureId: nextLectures[0].id },
    });
  };

  const currentThumb = useMemo(() => (lecture ? getThumb(lecture) : null), [lecture]);

  const renderVideo = () => {
    if (!embedUrl) return <Text style={styles.message}>Unable to play this lecture source.</Text>;
    if (playerError) return <Text style={styles.message}>Video player error. Please retry.</Text>;
    if (isYouTube && youtubeVideoId) {
      return (
        <View style={styles.playerWrap}>
          <YoutubePlayer
            ref={youtubeRef}
            width={videoWidth}
            height={videoHeight}
            videoId={youtubeVideoId}
            play={playing}
            playbackRate={playbackRate}
            webViewStyle={styles.webview}
            initialPlayerParams={{
              controls: false,
              modestbranding: true,
              rel: false,
              iv_load_policy: 3,
              showinfo: 0,
              fs: false,
              autoplay: false,
              disablekb: true,
            }}
            webViewProps={{
              onShouldStartLoadWithRequest: (request) => {
                const url = String(request?.url ?? "");
                if (
                  url.includes("youtube.com/watch") ||
                  url.includes("youtu.be/") ||
                  url.includes("m.youtube.com")
                ) {
                  toastService.warning("Playback locked in app", "Watch videos inside app only.");
                  return false;
                }
                return true;
              },
            }}
            onReady={() => {
              setTimeout(async () => {
                try {
                  const d = await youtubeRef.current?.getDuration?.();
                  if (Number(d) > 0) {
                    setTotalSec(Number(d));
                  }
                } catch {}
              }, 120);
              const t = Number(resumeAfterRotateRef.current.time || 0);
              const wasPlaying = Boolean(resumeAfterRotateRef.current.wasPlaying);
              if (t > 0.3) {
                setTimeout(() => {
                  youtubeRef.current?.seekTo?.(t, true);
                  setCurrentSec(t);
                  setPlaying(Boolean(wasPlaying));
                  resumeAfterRotateRef.current = { time: 0, wasPlaying: false };
                  if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
                  freezeTimerRef.current = setTimeout(
                    () => setFreezeMaskVisible(false),
                    wasPlaying ? 900 : 250
                  );
                  setTimeout(() => {
                    suppressStateSyncRef.current = false;
                  }, 250);
                }, 120);
              } else if (resumeAfterRotateRef.current.wasPlaying) {
                setPlaying(true);
                resumeAfterRotateRef.current = { time: 0, wasPlaying: false };
                if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
                freezeTimerRef.current = setTimeout(() => setFreezeMaskVisible(false), 900);
                setTimeout(() => {
                  suppressStateSyncRef.current = false;
                }, 250);
              } else {
                setPlaying(false);
                resumeAfterRotateRef.current = { time: 0, wasPlaying: false };
                if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
                freezeTimerRef.current = setTimeout(() => setFreezeMaskVisible(false), 250);
                setTimeout(() => {
                  suppressStateSyncRef.current = false;
                }, 250);
              }
            }}
            onError={() => {
              setPlayerError(true);
            }}
            onChangeState={(state) => {
              if (suppressStateSyncRef.current) return;
              if (state === "ended") {
                setPlaying(false);
                playNextLecture();
                return;
              }
              if (state === "playing") {
                setPlaying(true);
                setHasStartedPlayback(true);
                return;
              }
              if (state === "paused" || state === "unstarted") {
                setPlaying(false);
              }
            }}
          />

          <Pressable style={styles.tapSurface} onPress={toggleControls} />
          <View pointerEvents="box-none" style={styles.gestureLayer}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.smallZone}
              onPress={() => handleDoubleTapZone("left")}
            />
            <TouchableOpacity
              activeOpacity={1}
              style={styles.smallCenterZone}
              onPress={() => handleDoubleTapZone("center")}
            />
            <TouchableOpacity
              activeOpacity={1}
              style={styles.smallZone}
              onPress={() => handleDoubleTapZone("right")}
            />
          </View>

          {controlsVisible && (
            <>
              <View style={styles.customControls}>
                <View style={styles.leftControls}>
                  <TouchableOpacity
                    style={styles.controlBtn}
                    onPress={() => {
                      if (playing) {
                        setPlaying(false);
                      } else {
                        playWithFreeze();
                      }
                      showControls();
                    }}
                  >
                    <Ionicons name={playing ? "pause" : "play"} size={16} color="#E2E8F0" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.controlBtn} onPress={playNextLecture} disabled={!nextLectures.length}>
                    <Ionicons name="play-skip-forward" size={16} color={nextLectures.length ? "#E2E8F0" : "#64748B"} />
                  </TouchableOpacity>
                  {!hasStartedPlayback && resumeSec > 0 && (
                    <TouchableOpacity style={styles.controlBtn} onPress={handleResume}>
                      <Ionicons name="play-forward" size={16} color="#E2E8F0" />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.rightControls}>
                  <TouchableOpacity style={styles.controlBtn} onPress={cycleSpeed}>
                    <Text style={styles.speedQuickText}>{playbackRate}x</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.controlBtn}
                    onPress={() => { setShowSettings((p) => !p); showControls(); }}
                  >
                    <Ionicons name="settings" size={16} color="#E2E8F0" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.timelineWrap}>
                <View style={styles.timelineRow}>
                  <Text style={styles.timelineText}>{formatClock(currentSec)}</Text>
                  <Text style={styles.timelineText}>{totalSec > 0 ? formatClock(totalSec) : "--:--"}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.timelineTrack}
                  onLayout={(e) => { timelineWidthRef.current = e.nativeEvent.layout.width; }}
                  onPress={(e) => {
                    const ratio = e.nativeEvent.locationX / (timelineWidthRef.current || 1);
                    void seekToRatio(ratio);
                    showControls();
                  }}
                >
                  <View style={[styles.timelineFill, { width: `${Math.max(0, Math.min(100, totalSec > 0 ? (currentSec / totalSec) * 100 : 0))}%` }]} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {showSettings && controlsVisible && (
            <View style={[styles.settingsPanel, !landscape && styles.settingsPanelCompact]}>
              {[
                { key: "small", label: "Low (240p)" },
                { key: "medium", label: "Medium (360p)" },
                { key: "hd720", label: "High (720p)" },
                { key: "auto", label: "Auto" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.speedBtn, quality === item.key && styles.speedBtnActive]}
                  onPress={() => void selectQuality(item.key)}
                >
                  <Text style={[styles.speedText, quality === item.key && styles.speedTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!hasStartedPlayback && currentThumb && (
            <View pointerEvents="none" style={styles.posterOverlay}>
              <Image source={{ uri: currentThumb }} style={styles.posterImage} contentFit="cover" />
              <View style={styles.posterTint} />
            </View>
          )}

          {freezeMaskVisible && (
            <View pointerEvents="none" style={styles.freezeOverlay}>
              {currentThumb ? (
                <Image source={{ uri: currentThumb }} style={styles.posterImage} contentFit="cover" />
              ) : null}
              <View style={styles.posterTint}>
                <ActivityIndicator size="small" color="#38BDF8" />
              </View>
            </View>
          )}

        </View>
      );
    }
    return (
      <Video
        source={{ uri: directVideoUrl }}
        style={{ width: videoWidth, height: videoHeight, backgroundColor: "#000" }}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
      />
    );
  };

  if (landscape) {
    return (
      <View style={styles.fullscreenRoot}>
        <StatusBar hidden />
        <View style={styles.fullscreenVideo}>{renderVideo()}</View>
        <TouchableOpacity style={styles.rotateBackBtn} onPress={toggleRotate}>
          <Ionicons name="contract" size={22} color="#E5E7EB" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar hidden />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color="#E5E7EB" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isLiveSession ? "Live Class" : "Lecture Player"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.playerBox}>
        {loading ? (
          <ActivityIndicator size="large" color="#38BDF8" />
        ) : error ? (
          <Text style={styles.message}>{error}</Text>
        ) : locked ? (
          <View style={styles.center}>
            <Ionicons name="lock-closed" size={34} color="#EF4444" />
            <Text style={styles.message}>
              Subscription required. This lecture is locked for free users.
            </Text>
            <TouchableOpacity
              style={styles.helpBtn}
              onPress={() => router.push("/(student)/subscription")}
            >
              <Text style={styles.helpBtnText}>Buy Subscription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.frameCard}>
            <View style={styles.frame}>{renderVideo()}</View>
            <View style={styles.bottomInfo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bottomTitle} numberOfLines={2}>{lecture?.title || "Lecture"}</Text>
                <Text style={styles.bottomMeta} numberOfLines={1}>
                  {isLiveSession ? "LIVE SESSION" : "LKD Classes"}
                </Text>
              </View>
              <TouchableOpacity style={styles.rotateInlineBtn} onPress={toggleRotate}>
                <Ionicons name="phone-landscape-outline" size={18} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!loading && !locked && isLiveSession && (
          <View style={styles.pollWrap}>
            <View style={styles.pollHeader}>
              <Text style={styles.nextTitle}>Live Poll</Text>
              <Text style={styles.pollHint}>
                {activePoll ? pollTimeLeftLabel : isTeacher ? "No active poll" : "Waiting for teacher"}
              </Text>
            </View>

            {isTeacher && (
              <View style={styles.pollAdmin}>
                <View style={styles.pollAdminHeader}>
                  <Text style={styles.pollAdminTitle}>Teacher Poll</Text>
                  <TouchableOpacity
                    style={styles.pollToggle}
                    onPress={() => setShowPollEditor((prev) => !prev)}
                  >
                    <Text style={styles.pollToggleText}>
                      {showPollEditor ? "Hide" : "Create Poll"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showPollEditor && (
                  <>
                    <TextInput
                      style={styles.pollInput}
                      value={pollQuestion}
                      onChangeText={setPollQuestion}
                      placeholder="Poll question"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={styles.pollInput}
                      value={pollOptionA}
                      onChangeText={setPollOptionA}
                      placeholder="Option 1"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={styles.pollInput}
                      value={pollOptionB}
                      onChangeText={setPollOptionB}
                      placeholder="Option 2"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={styles.pollInput}
                      value={pollOptionC}
                      onChangeText={setPollOptionC}
                      placeholder="Option 3 (optional)"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={styles.pollInput}
                      value={pollOptionD}
                      onChangeText={setPollOptionD}
                      placeholder="Option 4 (optional)"
                      placeholderTextColor="#94A3B8"
                    />

                    <View style={styles.pollDurationRow}>
                      {[2, 5, 10].map((mins) => (
                        <TouchableOpacity
                          key={`poll-dur-${mins}`}
                          style={[
                            styles.pollDurationBtn,
                            pollDuration === mins && styles.pollDurationBtnActive,
                          ]}
                          onPress={() => setPollDuration(mins)}
                        >
                          <Text
                            style={[
                              styles.pollDurationText,
                              pollDuration === mins && styles.pollDurationTextActive,
                            ]}
                          >
                            {mins} min
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={styles.pollCreateBtn}
                      disabled={pollBusy}
                      onPress={createPoll}
                    >
                      <Text style={styles.pollCreateText}>
                        {pollBusy ? "Please wait..." : "Create Poll"}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {!!activePoll && (
                  <TouchableOpacity
                    style={styles.pollCloseBtn}
                    disabled={pollBusy}
                    onPress={closeActivePoll}
                  >
                    <Text style={styles.pollCloseText}>
                      {pollBusy ? "Please wait..." : "Close Active Poll"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {pollLoading && !activePoll ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : !activePoll ? (
              <Text style={styles.pollEmpty}>No active poll right now.</Text>
            ) : (
              <>
                <Text style={styles.pollQuestion}>{activePoll.question}</Text>

                {pollOptions.map((option, index) => {
                  const voteCount = Number(pollCounts[String(index)] || 0);
                  const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                  const isMine = myVoteIndex === index;
                  const voted = myVoteIndex !== null && myVoteIndex !== undefined;
                  return (
                    <TouchableOpacity
                      key={`${activePoll.id}_${index}`}
                      style={[styles.pollOption, isMine && styles.pollOptionMine]}
                      onPress={() => void submitPollVote(index)}
                      disabled={voted || submittingVote}
                    >
                      <View style={styles.pollOptionTop}>
                        <Text style={styles.pollOptionText}>{option}</Text>
                        {voted && (
                          <Text style={styles.pollOptionMeta}>
                            {voteCount} ({percent}%)
                          </Text>
                        )}
                      </View>
                      {voted && (
                        <View style={styles.pollBarTrack}>
                          <View style={[styles.pollBarFill, { width: `${Math.max(3, percent)}%` }]} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                <Text style={styles.pollFoot}>
                  {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                  {myVoteIndex !== null && myVoteIndex !== undefined ? " | Your vote submitted" : ""}
                </Text>
              </>
            )}
          </View>
        )}

        {!loading && !locked && !isLiveSession && (
          <View style={styles.nextWrap}>
            <View style={styles.nextHeader}>
              <Text style={styles.nextTitle}>Next in this chapter</Text>
              {loadingNext && <ActivityIndicator size="small" color="#38BDF8" />}
            </View>
            <FlatList
              data={nextLectures}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 12 }}
              renderItem={({ item }) => {
                const thumb = getThumb(item);
                return (
                    <TouchableOpacity
                      style={styles.nextCard}
                      onPress={() =>
                        router.replace({
                          pathname: isTeacher ? "/(teacher)/classes/player" : "/(student)/classes/player",
                          params: isTeacher ? { lectureId: item.id, teacherMode: "1" } : { lectureId: item.id },
                        })
                      }
                    >
                    <View style={styles.thumbWrap}>
                      {thumb ? <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.thumbFallback]} />}
                    </View>
                    <Text style={styles.nextCardTitle} numberOfLines={2}>{item.title}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  header: { height: 52, backgroundColor: "#020617", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  headerTitle: { marginLeft: 12, fontSize: 14, fontWeight: "600", color: "#E5E7EB", flex: 1 },
  playerBox: { flex: 1, backgroundColor: "#0B1220", paddingTop: 8, paddingHorizontal: 10 },
  frameCard: { width: "100%", backgroundColor: "#020617", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#1E293B" },
  frame: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden", backgroundColor: "#000" },
  playerWrap: { width: "100%", height: "100%", backgroundColor: "#000" },
  bottomInfo: { backgroundColor: "#0B1220", paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#1E293B", flexDirection: "row", alignItems: "center", gap: 10 },
  bottomTitle: { color: "#E5E7EB", fontSize: 12, fontWeight: "700" },
  bottomMeta: { marginTop: 3, color: "#94A3B8", fontSize: 11 },
  rotateInlineBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(2,6,23,0.75)",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  nextWrap: { marginTop: 12 },
  nextHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 },
  nextTitle: { color: "#E5E7EB", fontSize: 14, fontWeight: "700" },
  pollWrap: {
    marginTop: 12,
    backgroundColor: "#020617",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 10,
  },
  pollAdmin: {
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#0B1220",
    padding: 10,
  },
  pollAdminHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pollAdminTitle: { color: "#E2E8F0", fontSize: 12, fontWeight: "700" },
  pollToggle: {
    backgroundColor: "rgba(56,189,248,0.15)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pollToggleText: { color: "#38BDF8", fontSize: 11, fontWeight: "700" },
  pollInput: {
    backgroundColor: "#020617",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#E2E8F0",
    fontSize: 12,
    marginBottom: 8,
  },
  pollDurationRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  pollDurationBtn: {
    flex: 1,
    backgroundColor: "#020617",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1E293B",
    paddingVertical: 8,
    alignItems: "center",
  },
  pollDurationBtnActive: { backgroundColor: "rgba(56,189,248,0.2)", borderColor: "#38BDF8" },
  pollDurationText: { color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  pollDurationTextActive: { color: "#E2E8F0" },
  pollCreateBtn: {
    backgroundColor: "#38BDF8",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  pollCreateText: { color: "#0B1220", fontWeight: "800", fontSize: 12 },
  pollCloseBtn: {
    marginTop: 8,
    backgroundColor: "rgba(239,68,68,0.16)",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  pollCloseText: { color: "#FCA5A5", fontSize: 12, fontWeight: "700" },
  pollHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  pollHint: { color: "#64748B", fontSize: 11, fontWeight: "600" },
  pollEmpty: { color: "#64748B", fontSize: 12 },
  pollQuestion: { color: "#E2E8F0", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  pollOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#0B1220",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 7,
  },
  pollOptionMine: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56,189,248,0.12)",
  },
  pollOptionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pollOptionText: { color: "#E2E8F0", fontSize: 12, fontWeight: "600", flex: 1 },
  pollOptionMeta: { color: "#93C5FD", fontSize: 11, fontWeight: "700" },
  pollBarTrack: {
    height: 4,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: "rgba(148,163,184,0.25)",
    overflow: "hidden",
  },
  pollBarFill: { height: "100%", backgroundColor: "#38BDF8" },
  pollFoot: { color: "#94A3B8", fontSize: 11, marginTop: 4 },
  nextCard: { width: 170, backgroundColor: "#020617", borderRadius: 12, borderWidth: 1, borderColor: "#1E293B", marginRight: 10, overflow: "hidden" },
  thumbWrap: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#111827" },
  thumb: { width: "100%", height: "100%" },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  nextCardTitle: { color: "#CBD5E1", fontSize: 12, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 8 },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24, flex: 1 },
  message: { color: "#CBD5E1", marginTop: 10, textAlign: "center" },
  helpBtn: { marginTop: 10, backgroundColor: "#334155", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  helpBtnText: { color: "#E2E8F0", fontSize: 12, fontWeight: "800" },
  webview: { width: "100%", height: "100%", backgroundColor: "#000" },
  tapSurface: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    backgroundColor: "transparent",
  },
  gestureLayer: {
    position: "absolute",
    top: "28%",
    left: 0,
    right: 0,
    height: "40%",
    zIndex: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  smallZone: {
    width: "16%",
    height: "56%",
  },
  smallCenterZone: {
    width: "20%",
    height: "56%",
  },
  posterOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  posterImage: { width: "100%", height: "100%" },
  posterTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  freezeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  customControls: { position: "absolute", left: 10, right: 10, bottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 5 },
  leftControls: { flexDirection: "row", gap: 8 },
  rightControls: { flexDirection: "row", gap: 6, alignItems: "center" },
  controlBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(2,6,23,0.75)", borderWidth: 1, borderColor: "#1E293B", borderRadius: 999 },
  speedQuickText: { color: "#E2E8F0", fontSize: 9, fontWeight: "700" },
  timelineWrap: { position: "absolute", left: 12, right: 12, bottom: 50, zIndex: 6 },
  timelineRow: { marginBottom: 5, flexDirection: "row", justifyContent: "space-between" },
  timelineText: { color: "#CBD5E1", fontSize: 11, fontWeight: "700" },
  timelineTrack: { height: 4, borderRadius: 4, backgroundColor: "rgba(148,163,184,0.35)", overflow: "hidden" },
  timelineFill: { height: "100%", backgroundColor: "#38BDF8" },
  settingsPanel: { position: "absolute", right: 14, bottom: 52, backgroundColor: "rgba(2,6,23,0.95)", borderWidth: 1, borderColor: "#1E293B", borderRadius: 12, padding: 10, zIndex: 6, minWidth: 165 },
  settingsPanelCompact: { right: 8, minWidth: 138, padding: 8 },
  speedBtn: { borderRadius: 999, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 8, paddingVertical: 5, marginBottom: 5 },
  speedBtnActive: { backgroundColor: "#38BDF8", borderColor: "#38BDF8" },
  speedText: { color: "#CBD5E1", fontSize: 11, fontWeight: "700" },
  speedTextActive: { color: "#020617" },
  fullscreenRoot: { flex: 1, backgroundColor: "#000" },
  fullscreenVideo: { flex: 1, backgroundColor: "#000" },
  rotateBackBtn: { position: "absolute", top: 16, right: 16, backgroundColor: "rgba(2,6,23,0.65)", borderRadius: 999, padding: 10, zIndex: 999, elevation: 30 },
});
