import { useEffect, useMemo, useState } from "react";
import useProfile from "./useProfile";
import { paymentService } from "../services/paymentService";

const getMonthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

export default function useMonthlyAccess() {
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);

  const monthKey = useMemo(() => getMonthKey(), []);
  const rollNumber = profile?.roll_number ?? "";

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!rollNumber) {
        setPaid(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const ok = await paymentService.hasPaidForMonth(rollNumber, monthKey);
      if (!mounted) return;
      setPaid(Boolean(ok));
      setLoading(false);
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [monthKey, rollNumber]);

  return { paid, loading };
}
