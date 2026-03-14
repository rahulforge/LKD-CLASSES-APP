import { Linking } from "react-native";

const ALLOWED_PROTOCOLS = ["https:", "http:"];

export async function openTrustedUrl(url: string): Promise<void> {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) {
    throw new Error("Invalid URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error("Blocked external URL protocol");
  }

  const canOpen = await Linking.canOpenURL(parsed.toString());
  if (!canOpen) {
    throw new Error("Cannot open URL");
  }

  await Linking.openURL(parsed.toString());
}
