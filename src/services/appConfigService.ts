import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { CACHE_TTL_MS } from "../utils/constants";

const CONFIG_CACHE_KEY = "lkd_app_config_v1";

export type PublicAppConfig = {
  lock_title: string;
  lock_message: string;
  support_phone: string;
  support_whatsapp_text: string;
  payment_notice_enabled: boolean;
  payment_notice_url: string | null;
};

const DEFAULT_CONFIG: PublicAppConfig = {
  lock_title: "Verification Pending",
  lock_message: "Please contact staff for activation.",
  support_phone: "8002271522",
  support_whatsapp_text:
    "Namaste LKD Team, mera account verification pending hai. Kripya activation help karein.",
  payment_notice_enabled: false,
  payment_notice_url: null,
};

type ConfigCache = {
  time: number;
  data: PublicAppConfig;
};

const normalize = (row: any): PublicAppConfig => ({
  lock_title: String(row?.lock_title ?? DEFAULT_CONFIG.lock_title),
  lock_message: String(row?.lock_message ?? DEFAULT_CONFIG.lock_message),
  support_phone: String(row?.support_phone ?? DEFAULT_CONFIG.support_phone),
  support_whatsapp_text: String(
    row?.support_whatsapp_text ?? DEFAULT_CONFIG.support_whatsapp_text
  ),
  payment_notice_enabled: Boolean(
    row?.payment_notice_enabled ?? DEFAULT_CONFIG.payment_notice_enabled
  ),
  payment_notice_url: row?.payment_notice_url
    ? String(row.payment_notice_url)
    : null,
});

export const appConfigService = {
  async getPublicConfig(force = false): Promise<PublicAppConfig> {
    if (!force) {
      const cached = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ConfigCache;
          if (Date.now() - parsed.time < CACHE_TTL_MS) {
            void this.getPublicConfig(true);
            return parsed.data;
          }
        } catch {
          // ignore cache parse errors
        }
      }
    }

    const { data, error } = await supabase
      .from("app_runtime_config")
      .select(
        "lock_title, lock_message, support_phone, support_whatsapp_text, payment_notice_enabled, payment_notice_url"
      )
      .eq("id", 1)
      .maybeSingle();

    const result = error || !data ? DEFAULT_CONFIG : normalize(data);

    await AsyncStorage.setItem(
      CONFIG_CACHE_KEY,
      JSON.stringify({
        time: Date.now(),
        data: result,
      } as ConfigCache)
    );

    return result;
  },
};

