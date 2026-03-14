import { useCallback, useEffect, useState } from "react";
import {
  appConfigService,
  type PublicAppConfig,
} from "../services/appConfigService";

export default function useAppConfig() {
  const [config, setConfig] = useState<PublicAppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    const data = await appConfigService.getPublicConfig(force);
    setConfig(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    config,
    loading,
    refresh: () => load(true),
  };
}

