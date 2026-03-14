import { useEffect, useState } from "react";

const PROBE_URL =
  "https://clients3.google.com/generate_204";
const SLOW_THRESHOLD_MS = 1200;
const CHECK_INTERVAL_MS = 15000;
const REQUEST_TIMEOUT_MS = 5000;

async function probeConnection() {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    await fetch(PROBE_URL, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    const latency = Date.now() - start;
    return {
      isOnline: true,
      isSlow: latency > SLOW_THRESHOLD_MS,
    };
  } catch {
    return {
      isOnline: false,
      isSlow: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      const status = await probeConnection();
      if (!isMounted) return;

      setIsOnline(status.isOnline);
      setIsSlow(status.isSlow);
    };

    check();
    const intervalId = setInterval(
      check,
      CHECK_INTERVAL_MS
    );

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    isSlow,
  };
}
