import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReportMedia {
  url: string;
  captureType: string;
}

interface ReportFinding {
  title: string;
  description: string;
  severity: string;
  category: string;
  repairCostLow: number | null;
  repairCostHigh: number | null;
  media?: ReportMedia[];
}

interface ReportMarketComparable {
  title: string;
  price: number;
  mileage: number;
  location: string;
  source: string;
}

interface ReportMarketAnalysis {
  baselinePrice: number;          // cents
  adjustedPrice: number;          // cents — final fair value
  recommendation: string;
  strongBuyMax: number;
  fairBuyMax: number;
  overpayingMax?: number | null;
  estRetailPrice?: number | null;
  estReconCost?: number | null;
  estGrossProfit?: number | null;
  conditionScore?: number | null;
  conditionMultiplier?: number | null;
  conditionGrade?: string | null;
  historyMultiplier?: number | null;
  historyBreakdown?: {
    titleFactor: number;
    accidentFactor: number;
    ownerFactor: number;
    structuralDamageFactor: number;
    floodDamageFactor: number;
    recallFactor: number;
  } | null;
  fairValueAtBaseline?: number | null;
  adjustedValueBeforeRecon?: number | null;
  priceBands?: Array<{
    label: string;
    maxPriceCents: number;
    marginPercent: number;
  }> | null;
  comparables?: ReportMarketComparable[] | null;
  tradeInValue?: number | null;
  privatePartyValue?: number | null;
  wholesaleValue?: number | null;
  sourceCount?: number | null;
}

interface ReportRiskItem {
  title: string;
  description?: string;
  severity: string;
  status: string; // CONFIRMED | NOT_FOUND
  whyItMatters?: string;
}

interface ReportReconItem {
  finding: string;
  estimatedCostCents: number;
  laborHours?: number;
  partsEstimate?: number;
  reasoning?: string;
}

export interface ReportData {
  number: string;
  generatedAt: Date | string;
  orgName?: string;
  orgLogo?: string;
  inspectorName?: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
    vin: string;
    trim?: string | null;
    exteriorColor?: string | null;
  };
  scores: {
    overall: number | null;
    // 9-bucket scores
    paintBody?: number | null;
    glassLighting?: number | null;
    interiorSurfaces?: number | null;
    interiorControls?: number | null;
    engineBay?: number | null;
    tiresWheels?: number | null;
    underbodyFrame?: number | null;
    exhaust?: number | null;
    // Legacy 4-area (backward compat)
    exteriorBody?: number | null;
    interior?: number | null;
    mechanicalVisual?: number | null;
  };
  conditionDetails?: Record<string, {
    summary?: string;
    concerns?: string[];
  }> | null;
  findings: ReportFinding[];
  riskItems?: ReportRiskItem[];
  reconBreakdown?: {
    totalReconCost: number;
    itemizedCosts: ReportReconItem[];
    laborRateContext?: string;
  } | null;
  riskChecklist?: {
    total: number;
    confirmed: number;
    cleared: number;
    unableToInspect: number;
  };
  mediaCount: number;
  standardPhotos?: ReportMedia[];
  allMedia?: ReportMedia[];
  marketAnalysis?: ReportMarketAnalysis | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtCurrency(cents: number): string {
  return "$" + (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function severityLabel(s: string) {
  switch (s) {
    case "CRITICAL":
      return { text: "CRITICAL", color: "#dc2626" };
    case "MAJOR":
      return { text: "MAJOR", color: "#ea580c" };
    case "MODERATE":
      return { text: "MODERATE", color: "#ca8a04" };
    case "MINOR":
      return { text: "MINOR", color: "#1a3a7a" };
    default:
      return { text: s, color: "#6b7280" };
  }
}

function scoreColor(score: number | null): string {
  if (score == null) return "#6b7280";
  if (score >= 70) return "#16a34a";
  if (score >= 50) return "#ca8a04";
  return "#dc2626";
}

const STANDARD_CAPTURE_TYPES = [
  "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER",
  "DRIVER_SIDE", "PASSENGER_SIDE", "REAR_34_DRIVER",
  "REAR_34_PASSENGER", "REAR_CENTER", "ROOF",
  "UNDERCARRIAGE", "ENGINE_BAY", "UNDER_HOOD_LABEL",
] as const;

function captureLabel(type: string): string {
  const labels: Record<string, string> = {
    FRONT_CENTER: "Front",
    FRONT_34_DRIVER: "Front ¾ Driver",
    FRONT_34_PASSENGER: "Front ¾ Pass.",
    DRIVER_SIDE: "Driver Side",
    PASSENGER_SIDE: "Passenger Side",
    REAR_34_DRIVER: "Rear ¾ Driver",
    REAR_34_PASSENGER: "Rear ¾ Pass.",
    REAR_CENTER: "Rear",
    ROOF: "Roof",
    UNDERCARRIAGE: "Undercarriage",
    ENGINE_BAY: "Engine Bay",
    UNDER_HOOD_LABEL: "Hood Label",
    INTERIOR_WALKTHROUGH: "Interior",
    WALKAROUND_VIDEO: "Walkaround",
    FINDING_EVIDENCE: "Evidence",
  };
  return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },
  /* ---- Cover / Header ---- */
  header: {
    backgroundColor: "#0a1628",
    marginHorizontal: -40,
    marginTop: -40,
    paddingHorizontal: 40,
    paddingVertical: 30,
    marginBottom: 24,
  },
  headerOrg: { fontSize: 10, color: "#bfdbfe" },
  headerPowered: { fontSize: 7, color: "#93c5fd", marginTop: 2 },
  headerTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#ffffff", marginTop: 10 },
  headerVin: { fontSize: 9, color: "#bfdbfe", marginTop: 4, fontFamily: "Courier" },
  headerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  headerMetaText: { fontSize: 8, color: "#bfdbfe" },

  /* ---- Sections ---- */
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  /* ---- Score cards ---- */
  scoreRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  scoreCard: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    backgroundColor: "#f9fafb",
    alignItems: "center",
  },
  scoreValue: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  scoreLabel: { fontSize: 7, color: "#6b7280", marginTop: 2 },

  /* ---- Vehicle details ---- */
  detailRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
  },
  detailLabel: { width: 100, fontSize: 9, color: "#6b7280" },
  detailValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },

  /* ---- Findings ---- */
  findingCard: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 8,
  },
  findingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  findingTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", flex: 1 },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  findingDesc: { fontSize: 9, color: "#4b5563", lineHeight: 1.4 },
  findingCost: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 4, color: "#92400e" },

  /* ---- Repair total ---- */
  repairTotal: {
    padding: 10,
    borderRadius: 6,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    marginBottom: 10,
  },
  repairTotalText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#92400e" },

  /* ---- Risk checklist summary ---- */
  checklistRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  checklistCard: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#f9fafb",
    alignItems: "center",
  },
  checklistValue: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  checklistLabel: { fontSize: 7, color: "#6b7280", marginTop: 2, textAlign: "center" },

  /* ---- Market Analysis ---- */
  marketBanner: {
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 12,
  },
  marketBannerLabel: { fontSize: 8, color: "#ffffff", marginBottom: 2 },
  marketBannerValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  marketBannerRec: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", marginTop: 4 },
  marketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
  },
  marketLabel: { fontSize: 9, color: "#6b7280" },
  marketValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1f2937" },
  marketDeltaPos: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#16a34a" },
  marketDeltaNeg: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#dc2626" },
  bandRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 3,
  },
  bandDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  bandLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", flex: 1 },
  bandPrice: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  compTable: { marginTop: 4 },
  compHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginBottom: 2,
  },
  compRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
  },
  compCell: { fontSize: 8, color: "#4b5563" },
  compCellBold: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1f2937" },
  compHeader: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280" },

  /* ---- Photos ---- */
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoCell: {
    width: "31%",
    marginBottom: 4,
  },
  photoImage: {
    width: "100%",
    height: 120,
    borderRadius: 4,
    objectFit: "cover" as const,
    backgroundColor: "#f3f4f6",
  },
  photoLabel: {
    fontSize: 7,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 2,
  },
  findingPhotoRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  findingPhoto: {
    width: 60,
    height: 60,
    borderRadius: 4,
    objectFit: "cover" as const,
    backgroundColor: "#f3f4f6",
  },

  /* ---- Footer ---- */
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: "#9ca3af",
  },
});

/* ------------------------------------------------------------------ */
/*  Document                                                           */
/* ------------------------------------------------------------------ */

export function ReportDocument({ data }: { data: ReportData }) {
  const footerText = `Report #${data.number} — ${data.vehicle.year} ${data.vehicle.make} ${data.vehicle.model} — VeriBuy`;

  return (
    <Document title={`Report ${data.number}`} author="VeriBuy">
      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 1: Header + Condition Assessment                          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {data.orgLogo ? (
            <View style={{ marginBottom: 4 }}>
              <Image src={data.orgLogo} style={{ height: 36, maxWidth: 160, objectFit: "contain" as never }} />
              <Text style={styles.headerPowered}>Powered by VeriBuy</Text>
            </View>
          ) : (
            <View>
              {data.orgName && <Text style={styles.headerOrg}>{data.orgName}</Text>}
              <Text style={styles.headerPowered}>Powered by VeriBuy</Text>
            </View>
          )}
          <Text style={styles.headerTitle}>
            {data.vehicle.year} {data.vehicle.make} {data.vehicle.model}
          </Text>
          <Text style={styles.headerVin}>VIN: {data.vehicle.vin}</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.headerMetaText}>Report #{data.number}</Text>
            <Text style={styles.headerMetaText}>{fmtDate(data.generatedAt)}</Text>
            {data.inspectorName && (
              <Text style={styles.headerMetaText}>Inspector: {data.inspectorName}</Text>
            )}
          </View>
        </View>

        {/* Condition Assessment — matches web report layout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Condition Assessment</Text>

          {/* Known Risk Areas */}
          {data.riskItems && data.riskItems.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
                Known Risk Areas Inspected
              </Text>
              {data.riskItems.map((risk, i) => {
                const isConfirmed = risk.status === "CONFIRMED";
                return (
                  <View key={i} style={{
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    marginBottom: 3,
                    borderRadius: 4,
                    backgroundColor: isConfirmed ? "#fef2f2" : "#f0fdf4",
                    borderWidth: 0.5,
                    borderColor: isConfirmed ? "#fecaca" : "#bbf7d0",
                  }} wrap={false}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1f2937" }}>{risk.title}</Text>
                      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: isConfirmed ? "#dc2626" : "#16a34a" }}>
                        {isConfirmed ? "Identified" : "Clear"}
                      </Text>
                    </View>
                    {isConfirmed && risk.description && (
                      <Text style={{ fontSize: 8, color: "#4b5563", marginTop: 2 }}>{risk.description}</Text>
                    )}
                    {isConfirmed && risk.whyItMatters && (
                      <Text style={{ fontSize: 8, color: "#dc2626", marginTop: 2 }}>{risk.whyItMatters}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* 9-area condition scores with dot + summary + concerns */}
          {data.scores.overall != null && (
            <View>
              {([
                { label: "Paint & Body", key: "paintBody", score: data.scores.paintBody },
                { label: "Glass & Lighting", key: "glassLighting", score: data.scores.glassLighting },
                { label: "Interior Surfaces", key: "interiorSurfaces", score: data.scores.interiorSurfaces },
                { label: "Interior Controls", key: "interiorControls", score: data.scores.interiorControls },
                { label: "Engine Bay", key: "engineBay", score: data.scores.engineBay },
                { label: "Underbody & Frame", key: "underbodyFrame", score: data.scores.underbodyFrame },
                { label: "Exhaust", key: "exhaust", score: data.scores.exhaust },
              ] as const).map((area) => {
                const detail = data.conditionDetails?.[area.key];
                const dotColor = (area.score || 0) >= 70 ? "#16a34a" : (area.score || 0) >= 50 ? "#eab308" : "#dc2626";
                return (
                  <View key={area.key} style={{ paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" }} wrap={false}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dotColor }} />
                        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1f2937" }}>{area.label}</Text>
                      </View>
                      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1f2937" }}>{area.score ?? "—"}/100</Text>
                    </View>
                    {detail?.summary && (
                      <Text style={{ fontSize: 8, color: "#4b5563", marginTop: 3, marginLeft: 13 }}>{detail.summary}</Text>
                    )}
                    {detail?.concerns && detail.concerns.length > 0 && detail.concerns.map((c, ci) => (
                      <Text key={ci} style={{ fontSize: 8, color: "#dc2626", marginTop: 1, marginLeft: 13 }}>{"\u2022"} {c}</Text>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Text style={styles.footer}>{footerText}</Text>
      </Page>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 2: Identified Issues + Estimated Repair Costs             */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Page size="LETTER" style={styles.page}>
        {/* Identified Issues */}
        {data.findings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Identified Issues ({data.findings.length})</Text>
            {data.findings.map((f, i) => {
              const sev = severityLabel(f.severity);
              return (
                <View key={i} style={styles.findingCard} wrap={false}>
                  <View style={styles.findingHeader}>
                    <Text style={styles.findingTitle}>{f.title}</Text>
                    <Text style={[styles.severityBadge, { backgroundColor: sev.color }]}>
                      {sev.text}
                    </Text>
                  </View>
                  <Text style={styles.findingDesc}>{f.description}</Text>
                  {f.media && f.media.length > 0 && (
                    <View style={styles.findingPhotoRow}>
                      {f.media.slice(0, 4).map((m, mi) => (
                        <Image key={mi} src={m.url} style={styles.findingPhoto} />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Estimated Repair Costs — AI recon breakdown */}
        {data.reconBreakdown && data.reconBreakdown.itemizedCosts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estimated Repair Costs</Text>
            {data.reconBreakdown.itemizedCosts.map((item, i) => (
              <View key={i} style={{ paddingVertical: 4, paddingHorizontal: 6, marginBottom: 4, borderRadius: 4, backgroundColor: "#f9fafb" }} wrap={false}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1f2937", flex: 1 }}>{item.finding}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#dc2626" }}>{fmtCurrency(item.estimatedCostCents)}</Text>
                </View>
                {item.reasoning && (
                  <Text style={{ fontSize: 8, color: "#4b5563", marginTop: 2 }}>{item.reasoning}</Text>
                )}
                {(item.laborHours || item.partsEstimate) && (
                  <Text style={{ fontSize: 7, color: "#9ca3af", marginTop: 1 }}>
                    {item.laborHours ? `${item.laborHours}h labor` : ""}
                    {item.laborHours && item.partsEstimate ? " + " : ""}
                    {item.partsEstimate ? `${fmtCurrency(item.partsEstimate)} parts` : ""}
                  </Text>
                )}
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 6, borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 4 }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1f2937" }}>Total Estimated Repairs</Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#dc2626" }}>{fmtCurrency(data.reconBreakdown.totalReconCost)}</Text>
            </View>
            {data.reconBreakdown.laborRateContext && (
              <Text style={{ fontSize: 7, color: "#9ca3af", marginTop: 4 }}>{data.reconBreakdown.laborRateContext}</Text>
            )}
          </View>
        )}

        <Text style={styles.footer}>{footerText}</Text>
      </Page>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* PAGE 3: Vehicle Photos                                         */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {data.standardPhotos && data.standardPhotos.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Photos ({data.standardPhotos.length})</Text>
            <View style={styles.photoGrid}>
              {data.standardPhotos.map((photo, i) => (
                <View key={i} style={styles.photoCell}>
                  <Image src={photo.url} style={styles.photoImage} />
                  <Text style={styles.photoLabel}>{captureLabel(photo.captureType)}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.footer}>{footerText}</Text>
        </Page>
      )}

      {/* ---- Page 3: Vehicle Valuation (seller-facing) ---- */}
      {data.marketAnalysis && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Valuation</Text>

            {/* Offer banner */}
            <View style={[styles.marketBanner, { backgroundColor: "#1a3a7a" }]}>
              <Text style={styles.marketBannerLabel}>Our Offer</Text>
              <Text style={styles.marketBannerValue}>
                {fmtCurrency(data.marketAnalysis.fairBuyMax || data.marketAnalysis.adjustedPrice)}
              </Text>
            </View>

            {/* How We Determined This Offer */}
            <View style={styles.section}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
                How We Determined This Offer
              </Text>

              {/* Trade-In based waterfall — data-driven, fixed values */}
              {(() => {
                const ma = data.marketAnalysis!;
                const totalRecon = ma.estReconCost || 0;
                const condMult = ma.conditionMultiplier ?? 1;
                const histMult = ma.historyMultiplier ?? 1;
                const offerPrice = ma.fairBuyMax || ma.adjustedPrice;
                const hb = ma.historyBreakdown;

                // Trade-in: use actual API-sourced value, fallback to back-computation
                const apiTradeIn = ma.tradeInValue;
                const tradeInBase = apiTradeIn != null && apiTradeIn > 0
                  ? Math.round(apiTradeIn / 10000) * 10000
                  : Math.round(((offerPrice + totalRecon) / (condMult * histMult)) / 10000) * 10000;

                const afterCondition = Math.round(tradeInBase * condMult);
                const conditionDeltaAdj = afterCondition - tradeInBase;
                const afterHistory = histMult !== 1 ? Math.round(afterCondition * histMult) : afterCondition;
                const historyDelta = afterHistory - afterCondition;

                // Overhead = adjusted value - offer (absorbs dealer margin)
                const adjustedValue = afterHistory - totalRecon;
                const overheadCosts = Math.max(0, adjustedValue - offerPrice);

                // Condition grade from inspection overall score
                const score = data.scores.overall;
                const sellerGrade = score != null
                  ? (score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 60 ? "Fair" : "Poor")
                  : ma.conditionGrade?.replace(/_/g, " ") ?? null;

                return (
                  <>
                    <View style={styles.marketRow}>
                      <Text style={styles.marketLabel}>Trade-In Estimate</Text>
                      <Text style={styles.marketValue}>{fmtCurrency(tradeInBase)}</Text>
                    </View>

                    {conditionDeltaAdj !== 0 && (
                      <View style={styles.marketRow}>
                        <Text style={styles.marketLabel}>
                          Condition Adjustment ({sellerGrade || `Score ${data.scores.overall ?? ma.conditionScore}`})
                        </Text>
                        <Text style={conditionDeltaAdj >= 0 ? styles.marketDeltaPos : styles.marketDeltaNeg}>
                          {conditionDeltaAdj >= 0 ? "+" : ""}{fmtCurrency(conditionDeltaAdj)}
                        </Text>
                      </View>
                    )}

                    {historyDelta !== 0 && (
                      <>
                        <View style={styles.marketRow}>
                          <Text style={styles.marketLabel}>Vehicle History Impact</Text>
                          <Text style={historyDelta >= 0 ? styles.marketDeltaPos : styles.marketDeltaNeg}>
                            {historyDelta >= 0 ? "+" : ""}{fmtCurrency(historyDelta)}
                          </Text>
                        </View>
                        {hb && (
                          <>
                            {hb.titleFactor < 1 && (
                              <View style={[styles.marketRow, { paddingLeft: 12 }]}>
                                <Text style={{ fontSize: 8, color: "#9ca3af" }}>
                                  {hb.titleFactor <= 0.55 ? "Salvage title" : hb.titleFactor <= 0.75 ? "Rebuilt title" : "Title issue"}
                                </Text>
                                <Text style={{ fontSize: 8, color: "#dc2626" }}>
                                  {fmtCurrency(Math.round(afterCondition * hb.titleFactor - afterCondition))}
                                </Text>
                              </View>
                            )}
                            {hb.accidentFactor < 1 && (
                              <View style={[styles.marketRow, { paddingLeft: 12 }]}>
                                <Text style={{ fontSize: 8, color: "#9ca3af" }}>
                                  {hb.accidentFactor <= 0.70 ? "3+ accidents" : hb.accidentFactor <= 0.80 ? "2 accidents" : "1 accident"} reported
                                </Text>
                                <Text style={{ fontSize: 8, color: "#dc2626" }}>
                                  {fmtCurrency(Math.round(afterCondition * hb.accidentFactor - afterCondition))}
                                </Text>
                              </View>
                            )}
                            {hb.ownerFactor < 1 && (
                              <View style={[styles.marketRow, { paddingLeft: 12 }]}>
                                <Text style={{ fontSize: 8, color: "#9ca3af" }}>
                                  {hb.ownerFactor <= 0.90 ? "5+" : hb.ownerFactor <= 0.94 ? "4" : "3"} previous owners
                                </Text>
                                <Text style={{ fontSize: 8, color: "#dc2626" }}>
                                  {fmtCurrency(Math.round(afterCondition * hb.ownerFactor - afterCondition))}
                                </Text>
                              </View>
                            )}
                            {hb.structuralDamageFactor < 1 && (
                              <View style={[styles.marketRow, { paddingLeft: 12 }]}>
                                <Text style={{ fontSize: 8, color: "#9ca3af" }}>Structural damage reported</Text>
                                <Text style={{ fontSize: 8, color: "#dc2626" }}>
                                  {fmtCurrency(Math.round(afterCondition * hb.structuralDamageFactor - afterCondition))}
                                </Text>
                              </View>
                            )}
                            {hb.floodDamageFactor < 1 && (
                              <View style={[styles.marketRow, { paddingLeft: 12 }]}>
                                <Text style={{ fontSize: 8, color: "#9ca3af" }}>Flood damage reported</Text>
                                <Text style={{ fontSize: 8, color: "#dc2626" }}>
                                  {fmtCurrency(Math.round(afterCondition * hb.floodDamageFactor - afterCondition))}
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {/* Recon — single line */}
                    {totalRecon > 0 && (
                      <View style={styles.marketRow}>
                        <Text style={styles.marketLabel}>Estimated Repairs Needed</Text>
                        <Text style={styles.marketDeltaNeg}>-{fmtCurrency(totalRecon)}</Text>
                      </View>
                    )}

                    {/* Dealer overhead costs */}
                    {overheadCosts > 0 && (
                      <View style={styles.marketRow}>
                        <Text style={styles.marketLabel}>Dealer Acquisition Costs</Text>
                        <Text style={styles.marketDeltaNeg}>-{fmtCurrency(overheadCosts)}</Text>
                      </View>
                    )}

                    {/* Our Offer (bottom line) */}
                    <View style={[styles.marketRow, { borderBottomWidth: 2, borderBottomColor: "#16a34a", paddingVertical: 6 }]}>
                      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#16a34a" }}>Our Offer</Text>
                      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#16a34a" }}>
                        {fmtCurrency(offerPrice)}
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* Price ladder and separate cost breakdown removed —
                AI breakdown is shown inline under Dealer Acquisition Costs in the waterfall */}
          </View>

          <Text style={styles.footer}>
            Report #{data.number} — {data.vehicle.year} {data.vehicle.make} {data.vehicle.model} — VeriBuy
          </Text>
        </Page>
      )}
    </Document>
  );
}
