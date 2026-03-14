import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function TestFeeViewRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(student)/admit-card");
  }, [router]);
  return null;
}
