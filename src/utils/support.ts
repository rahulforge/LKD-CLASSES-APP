import { openTrustedUrl } from "./linking";

const FALLBACK_SUPPORT_PHONE = "8002271522";
const FALLBACK_WHATSAPP_TEXT =
  "Namaste LKD Team, mera account verification pending hai. Kripya activation help karein.";

export function getSupportPhone(): string {
  return (
    process.env.EXPO_PUBLIC_SUPPORT_PHONE ||
    process.env.EXPO_PUBLIC_SUPPORT_CONTACT ||
    FALLBACK_SUPPORT_PHONE
  );
}

export async function openSupportContact(input?: {
  phone?: string | null;
  text?: string | null;
}): Promise<void> {
  const phone = String(input?.phone || getSupportPhone())
    .replace(/\D/g, "")
    .trim();
  if (!phone) {
    throw new Error("Support contact is not configured");
  }

  const text = String(input?.text || FALLBACK_WHATSAPP_TEXT).trim();
  const withCountry = phone.startsWith("91") ? phone : `91${phone}`;
  const waUrl = `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
  await openTrustedUrl(waUrl);
}
