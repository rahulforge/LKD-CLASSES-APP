import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import useProfile from "../../src/hooks/useProfile";
import { classFeeService } from "../../src/services/classFeeService";
import { paymentService } from "../../src/services/paymentService";
import { promoService } from "../../src/services/promoService";
import { studentPaymentFlowService } from "../../src/services/studentPaymentFlowService";
import { toastService } from "../../src/services/toastService";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const hashString = (input) => {
  let hash = 0;
  const str = String(input ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase();
};

const buildAdmitCardHtml = ({
  logoData,
  name,
  roll,
  classLabel,
  validTillLabel,
  issuedLabel,
  securityCode,
  cardId,
}) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0F172A; }
        .card { border: 2px solid #0F172A; border-radius: 16px; padding: 20px; position: relative; overflow: hidden; }
        .watermark {
          position: absolute;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-20deg);
          font-size: 36px;
          color: rgba(15, 23, 42, 0.06);
          font-weight: 800;
          letter-spacing: 2px;
          white-space: nowrap;
        }
        .header { display: flex; align-items: center; gap: 16px; }
        .logo { width: 64px; height: 64px; }
        .title { font-size: 20px; font-weight: 800; letter-spacing: 0.3px; }
        .subtitle { font-size: 12px; color: #475569; margin-top: 2px; }
        .location { font-size: 11px; color: #64748B; margin-top: 2px; font-weight: 700; }
        .meta { font-size: 12px; color: #334155; margin-top: 6px; }
        .row { display: flex; justify-content: space-between; margin-top: 10px; }
        .label { font-size: 12px; color: #64748B; }
        .value { font-size: 14px; font-weight: 600; color: #0F172A; }
        .grid { display: flex; gap: 16px; margin-top: 18px; }
        .info { flex: 1; }
        .photo { width: 120px; height: 140px; border: 1px dashed #94A3B8; display: flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 11px; }
        .status { margin-top: 18px; padding: 8px 12px; background: #DCFCE7; color: #166534; font-weight: 700; border-radius: 10px; display: inline-block; }
        .security { margin-top: 14px; font-size: 11px; color: #0F172A; font-weight: 700; }
        .code { letter-spacing: 1px; }
        .footer { margin-top: 6px; font-size: 10px; color: #64748B; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="watermark">LKD CLASSES</div>
        <div class="header">
          <img class="logo" src="${logoData}" />
          <div>
            <div class="title">LKD Classes</div>
            <div class="subtitle">Admit Card</div>
            <div class="location">SITALPUR, SARAN</div>
            <div class="meta">Valid till: ${escapeHtml(validTillLabel)}</div>
          </div>
        </div>
        <div class="grid">
          <div class="info">
            <div class="row"><div class="label">Student Name</div><div class="value">${escapeHtml(
              name
            )}</div></div>
            <div class="row"><div class="label">Roll Number</div><div class="value">${escapeHtml(
              roll
            )}</div></div>
            <div class="row"><div class="label">Class</div><div class="value">${escapeHtml(
              classLabel
            )}</div></div>
            <div class="row"><div class="label">Issued On</div><div class="value">${escapeHtml(
              issuedLabel
            )}</div></div>
            <div class="row"><div class="label">Card ID</div><div class="value">${escapeHtml(cardId)}</div></div>
          </div>
          <div class="photo">PHOTO</div>
        </div>
        <div class="status">PAYMENT SUCCESS</div>
        <div class="security">Verification Code: <span class="code">${escapeHtml(securityCode)}</span></div>
        <div class="footer">This card is valid only with original payment record in LKD Classes system.</div>
      </div>
    </body>
  </html>
`;

export default function AdmitCardPayment() {
  const { profile, classLabel } = useProfile();
  const router = useRouter();
  const logoSource = useMemo(() => require("../../assets/images/logo.png"), []);
  const [testFee, setTestFee] = useState(0);
  const [paid, setPaid] = useState(false);
  const [validUntil, setValidUntil] = useState(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromoCode, setAppliedPromoCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paying, setPaying] = useState(false);
  const [pdfUri, setPdfUri] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [loading, setLoading] = useState(true);
  const estimatedAfterPromo = Math.max(
    0,
    Math.round(testFee * (1 - Math.max(0, discountPercent) / 100) * 100) / 100
  );
  const pdfPath = useMemo(() => {
    if (!profile?.id) return "";
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";
    if (!baseDir) return "";
    return `${baseDir}admit_card_${profile.id}.pdf`;
  }, [profile?.id]);

  const loadLogoBase64 = async () => {
    const asset = Asset.fromModule(logoSource);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) return "";
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${base64}`;
  };

  useEffect(() => {
    const run = async () => {
      if (!profile?.id || !profile?.class) return;
      setLoading(true);
      const cfg = await classFeeService.getClassFeeConfig(profile.class);
      setTestFee(Number(cfg?.test_fee ?? cfg?.monthly_fee ?? 0));

      let paidAtIso = null;
      const latestPayment = await paymentService.getLatestSuccessfulPaymentByFlow(
        profile.id,
        "test_fee"
      );
      if (latestPayment?.created_at) {
        paidAtIso = latestPayment.created_at;
      }

      if (!paidAtIso && profile?.roll_number) {
        const rows = await paymentService.getPaymentTrackingByRoll(profile.roll_number, 1, 50);
        const testPayments = rows.rows
          .filter((r) => String(r.payment_kind || "") === "test_fee")
          .sort((a, b) => String(b.paid_date ?? "").localeCompare(String(a.paid_date ?? "")));
        const latest = testPayments[0];
        if (latest?.paid_date) {
          paidAtIso = latest.paid_date;
        }
      }

      if (paidAtIso) {
        const paidAt = new Date(paidAtIso);
        const expiry = new Date(paidAt);
        expiry.setMonth(expiry.getMonth() + 1);
        setValidUntil(expiry.toISOString());
        setPaid(expiry.getTime() > Date.now());
      } else {
        setPaid(false);
        setValidUntil(null);
      }
      setLoading(false);
    };
    void run();
  }, [profile?.class, profile?.id, profile?.roll_number]);

  const generatePdf = async () => {
    if (!paid || !profile?.id || !pdfPath) return;
    setPdfError("");
    try {
      const issued = new Date();
      const validLabel = validUntil
        ? new Date(validUntil).toLocaleDateString("en-IN")
        : "-";
      const issuedLabel = issued.toLocaleDateString("en-IN");
      const securityCode = hashString(
        `${profile.id}_${profile.roll_number || ""}_${validLabel}`
      );
      const cardId = hashString(`${profile.id}_${issuedLabel}`).slice(0, 10);
      const logoData = await loadLogoBase64();
      const html = buildAdmitCardHtml({
        logoData,
        name: profile?.name || "Student",
        roll: profile?.roll_number || "-",
        classLabel: classLabel || profile?.class || "-",
        validTillLabel: validLabel,
        issuedLabel,
        securityCode,
        cardId,
      });
      const file = await Print.printToFileAsync({ html, base64: false });
      if (!file?.uri) throw new Error("PDF export failed");
      await FileSystem.copyAsync({ from: file.uri, to: pdfPath });
      setPdfUri(pdfPath);
    } catch (err) {
      setPdfError("Unable to generate PDF.");
      setPdfUri("");
    }
  };

  useEffect(() => {
    void generatePdf();
  }, [paid, pdfPath, validUntil, profile?.id, profile?.name, profile?.roll_number, classLabel, profile?.class]);

  useEffect(() => {
    const checkExisting = async () => {
      if (!pdfPath) return;
      const info = await FileSystem.getInfoAsync(pdfPath);
      if (info.exists) {
        setPdfUri(pdfPath);
      }
    };
    void checkExisting();
  }, [pdfPath]);

  const ensurePdfReady = async () => {
    if (!paid) return null;
    if (pdfUri) return pdfUri;
    await generatePdf();
    return pdfUri || pdfPath || null;
  };

  const handleViewPdf = async () => {
    const uri = await ensurePdfReady();
    if (!uri) return;
    router.push({
      pathname: "/(student)/material/pdf",
      params: { url: uri },
    });
  };

  const handleDownload = async () => {
    const uri = await ensurePdfReady();
    if (!uri) return;
    toastService.success("Saved", "Admit card saved in app.");
  };

  const handleShare = async () => {
    const uri = await ensurePdfReady();
    if (!uri) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      toastService.error("Unavailable", "Sharing is not available on this device.");
      return;
    }
    await Sharing.shareAsync(uri);
  };

  const handlePrint = async () => {
    const uri = await ensurePdfReady();
    if (!uri) return;
    await Print.printAsync({ uri });
  };

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setAppliedPromoCode("");
      setDiscountPercent(0);
      toastService.error("Missing", "Enter promo code first.");
      return;
    }
    setPromoApplying(true);
    try {
      const validation = await promoService.validatePromoCode(code);
      if (!validation.valid) {
        setAppliedPromoCode("");
        setDiscountPercent(0);
        toastService.error("Invalid", "Promo code not found or inactive.");
        return;
      }
      const appliedCode = String(validation.code ?? code).toUpperCase();
      const percent = Math.max(0, Number(validation.discountPercent || 0));
      setPromoCode(appliedCode);
      setAppliedPromoCode(appliedCode);
      setDiscountPercent(percent);
      toastService.success("Promo applied", `${appliedCode} (${percent}% off)`);
    } catch {
      setAppliedPromoCode("");
      setDiscountPercent(0);
      toastService.error("Failed", "Unable to validate promo code.");
    } finally {
      setPromoApplying(false);
    }
  };

  const onPromoChange = (value) => {
    const next = String(value ?? "").toUpperCase();
    setPromoCode(next);
    if (appliedPromoCode && next.trim() !== appliedPromoCode) {
      setAppliedPromoCode("");
      setDiscountPercent(0);
    }
  };

  const handlePay = () => {
    if (!profile?.roll_number || !profile?.class) {
      toastService.error("Missing", "Profile not ready");
      return;
    }
    if (!testFee) {
      toastService.error("Fee not set", "Teacher has not set test fee yet");
      return;
    }
    setPaying(true);
    studentPaymentFlowService
      .run({
        profile,
        flow: "test_fee",
        title: "Test Fee",
        promoCode: appliedPromoCode || null,
      })
      .then(async (result) => {
        const record = await paymentService.getPaymentRecord(result.paymentId);
        const paidAt = record?.created_at ? new Date(record.created_at) : new Date();
        const expiry = new Date(paidAt);
        expiry.setMonth(expiry.getMonth() + 1);
        setPaid(true);
        setValidUntil(expiry.toISOString());
        setPdfUri("");
        setPdfError("");
        toastService.success("Payment success", "Admit card access unlocked.");
      })
      .catch((error) => {
        toastService.error("Payment failed", error?.message || "Please try again.");
      })
      .finally(() => setPaying(false));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Ionicons name="document-text" size={28} color="#FACC15" />
          <Text style={styles.title}>Test Fee</Text>
          <Text style={styles.sub}>Pay test fee to issue your admit card.</Text>
          <Text style={styles.secureSub}>In-app Razorpay checkout only</Text>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Test Fee</Text>
            <Text style={styles.amount}>Rs.{testFee}</Text>
            {appliedPromoCode ? (
              <Text style={styles.discountText}>Estimated after promo: Rs.{estimatedAfterPromo}</Text>
            ) : null}
          </View>

          {paid ? (
            <View style={styles.successBox}>
              <Text style={styles.issueTitle}>Issued Admit Card</Text>
              <View style={styles.admitCard}>
                <View style={styles.admitHeader}>
                  <Image
                    source={logoSource}
                    style={styles.logo}
                    contentFit="contain"
                  />
                  <View>
                    <Text style={styles.schoolTitle}>LKD Classes</Text>
                    <Text style={styles.locationTitle}>SITALPUR, SARAN</Text>
                    <Text style={styles.cardTitle}>Admit Card</Text>
                    <Text style={styles.cardMeta}>
                      Issued: {new Date().toLocaleDateString("en-IN")}
                    </Text>
                  </View>
                </View>
                <View style={styles.admitBody}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>Student Name</Text>
                    <Text style={styles.infoValue}>{profile?.name || "-"}</Text>
                    <Text style={styles.infoLabel}>Roll Number</Text>
                    <Text style={styles.infoValue}>{profile?.roll_number || "-"}</Text>
                    <Text style={styles.infoLabel}>Class</Text>
                    <Text style={styles.infoValue}>{classLabel || profile?.class || "-"}</Text>
                  </View>
                  <View style={styles.photoBox}>
                    <Text style={styles.photoText}>PHOTO</Text>
                  </View>
                </View>
                <View style={styles.validRow}>
                  <Text style={styles.validText}>
                    Valid till {validUntil ? new Date(validUntil).toLocaleDateString("en-IN") : "-"}
                  </Text>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>PAID</Text>
                  </View>
                </View>
                <View style={styles.securityRow}>
                  <Text style={styles.securityLabel}>Verification Code</Text>
                  <Text style={styles.securityValue}>
                    {hashString(`${profile?.id}_${profile?.roll_number || ""}_${validUntil || ""}`)}
                  </Text>
                </View>
              </View>

              {pdfError ? (
                <Text style={styles.pdfError}>{pdfError}</Text>
              ) : null}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleViewPdf}>
                  <Text style={styles.actionText}>View PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handleDownload}>
                  <Text style={styles.actionText}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={handlePrint}>
                  <Text style={styles.actionText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtnOutline} onPress={handleShare}>
                  <Text style={styles.actionTextOutline}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Promo Code (optional)</Text>
              <View style={styles.promoRow}>
                <TextInput
                  style={[styles.input, styles.promoInput]}
                  value={promoCode}
                  onChangeText={onPromoChange}
                  placeholder="Enter promo code"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  editable={!paying && !promoApplying}
                />
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={applyPromo}
                  disabled={paying || promoApplying}
                >
                  {promoApplying ? (
                    <ActivityIndicator color="#111827" />
                  ) : (
                    <Text style={styles.applyText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {appliedPromoCode ? (
                <Text style={styles.appliedText}>
                  Applied: {appliedPromoCode} ({discountPercent}% off)
                </Text>
              ) : (
                <Text style={styles.helper}>Enter code and tap Apply before payment.</Text>
              )}
              <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={paying || loading}>
                {paying ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text style={styles.payText}>Pay Test Fee</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  container: { padding: 16 },
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 16,
  },
  title: { marginTop: 8, color: "#E2E8F0", fontSize: 18, fontWeight: "800" },
  sub: { marginTop: 6, color: "#94A3B8", fontSize: 12 },
  secureSub: { marginTop: 4, color: "#7DD3FC", fontSize: 11, fontWeight: "700" },
  amountBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  amountLabel: { color: "#94A3B8", fontSize: 11 },
  amount: { marginTop: 4, color: "#FACC15", fontSize: 22, fontWeight: "800" },
  discountText: { color: "#86EFAC", fontSize: 11, marginTop: 6, fontWeight: "700" },
  label: { marginTop: 10, color: "#94A3B8", fontSize: 12, marginBottom: 6 },
  promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  promoInput: { flex: 1 },
  input: {
    backgroundColor: "#020617",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
    color: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  applyBtn: {
    height: 42,
    minWidth: 76,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FACC15",
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { color: "#111827", fontSize: 12, fontWeight: "800" },
  appliedText: { color: "#86EFAC", fontSize: 11, marginTop: 6, fontWeight: "700" },
  helper: { color: "#94A3B8", fontSize: 11, marginTop: 6 },
  success: { marginTop: 12, color: "#34D399", fontWeight: "700", fontSize: 12 },
  successBox: { marginTop: 12 },
  issueTitle: {
    color: "#E5E7EB",
    fontWeight: "800",
    fontSize: 13,
    marginBottom: 10,
  },
  successNote: { marginTop: 4, color: "#A7F3D0", fontSize: 11 },
  pdfError: { marginTop: 6, color: "#FCA5A5", fontSize: 11, fontWeight: "700" },
  admitCard: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 14,
  },
  admitHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 48, height: 48 },
  schoolTitle: { color: "#E2E8F0", fontSize: 16, fontWeight: "800" },
  locationTitle: { color: "#94A3B8", fontSize: 10, marginTop: 2, fontWeight: "800" },
  cardTitle: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  cardMeta: { color: "#64748B", fontSize: 10, marginTop: 4 },
  admitBody: { marginTop: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoCol: { flex: 1 },
  infoLabel: { color: "#94A3B8", fontSize: 10, marginTop: 6 },
  infoValue: { color: "#E2E8F0", fontSize: 13, fontWeight: "700" },
  photoBox: {
    width: 90,
    height: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoText: { color: "#64748B", fontSize: 10, fontWeight: "700" },
  validRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  securityRow: {
    marginTop: 8,
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1F2937",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  securityLabel: { color: "#94A3B8", fontSize: 10 },
  securityValue: { color: "#E2E8F0", fontSize: 12, fontWeight: "800", marginTop: 2 },
  validText: { color: "#A7F3D0", fontSize: 11, fontWeight: "700" },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#22C55E",
    borderRadius: 999,
  },
  statusText: { color: "#052E16", fontSize: 10, fontWeight: "800" },
  actionRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnOutline: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#38BDF8",
    backgroundColor: "transparent",
  },
  actionText: { color: "#020617", fontWeight: "800", fontSize: 12 },
  actionTextOutline: { color: "#38BDF8", fontWeight: "800", fontSize: 12 },
  payBtn: {
    marginTop: 12,
    backgroundColor: "#FACC15",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  payText: { color: "#111827", fontWeight: "800", fontSize: 13 },
});
