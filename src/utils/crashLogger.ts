import AsyncStorage from "@react-native-async-storage/async-storage";

const CRASH_LOG_KEY = "lkd_crash_logs_v1";
const MAX_LOGS = 20;

type CrashLog = {
  time: string;
  source: string;
  message: string;
  fatal?: boolean;
};

export async function logCrash(
  source: string,
  error: unknown,
  fatal?: boolean
) {
  try {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error ?? "Unknown error");

    const entry: CrashLog = {
      time: new Date().toISOString(),
      source,
      message,
      fatal,
    };

    const raw = await AsyncStorage.getItem(CRASH_LOG_KEY);
    const prev = raw ? ((JSON.parse(raw) as CrashLog[]) ?? []) : [];
    const next = [entry, ...prev].slice(0, MAX_LOGS);
    await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(next));
  } catch {
    // Avoid recursive failures in logger path.
  }
}

