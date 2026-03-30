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
}

export interface ReportData {
  number: string;
  generatedAt: Date | string;
  orgName?: string;
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
    exteriorBody: number | null;
    interior: number | null;
    mechanicalVisual: number | null;
    underbodyFrame: number | null;
  };
  findings: ReportFinding[];
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
      return { text: "MINOR", color: "#2563eb" };
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
    backgroundColor: "#2563eb",
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
  const criticalCount = data.findings.filter((f) => f.severity === "CRITICAL").length;
  const majorCount = data.findings.filter((f) => f.severity === "MAJOR").length;
  const totalRepairLow = data.findings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
  const totalRepairHigh = data.findings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);

  return (
    <Document title={`Report ${data.number}`} author="VeriBuy">
      {/* ---- Page 1: Summary ---- */}
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {data.orgName && <Text style={styles.headerOrg}>{data.orgName}</Text>}
          <Text style={styles.headerPowered}>Powered by VeriBuy</Text>
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

        {/* Executive Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreCard}>
              <Text style={[styles.scoreValue, { color: scoreColor(data.scores.overall) }]}>
                {data.scores.overall ?? "—"}
              </Text>
              <Text style={styles.scoreLabel}>OVERALL</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={[styles.scoreValue, { color: "#dc2626" }]}>
                {criticalCount + majorCount}
              </Text>
              <Text style={styles.scoreLabel}>CRITICAL / MAJOR</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={[styles.scoreValue, { color: "#2563eb" }]}>
                {data.findings.length}
              </Text>
              <Text style={styles.scoreLabel}>TOTAL FINDINGS</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={[styles.scoreValue, { color: "#16a34a" }]}>
                {data.mediaCount}
              </Text>
              <Text style={styles.scoreLabel}>PHOTOS</Text>
            </View>
          </View>

          {/* Sub-scores (4-area, each 1-10) */}
          {data.scores.overall != null && (
            <View style={styles.scoreRow}>
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreValue, { fontSize: 16, color: scoreColor(data.scores.exteriorBody ? data.scores.exteriorBody * 10 : null) }]}>
                  {data.scores.exteriorBody ?? "—"}/10
                </Text>
                <Text style={styles.scoreLabel}>EXTERIOR</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreValue, { fontSize: 16, color: scoreColor(data.scores.interior ? data.scores.interior * 10 : null) }]}>
                  {data.scores.interior ?? "—"}/10
                </Text>
                <Text style={styles.scoreLabel}>INTERIOR</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreValue, { fontSize: 16, color: scoreColor(data.scores.mechanicalVisual ? data.scores.mechanicalVisual * 10 : null) }]}>
                  {data.scores.mechanicalVisual ?? "—"}/10
                </Text>
                <Text style={styles.scoreLabel}>MECHANICAL</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreValue, { fontSize: 16, color: scoreColor(data.scores.underbodyFrame ? data.scores.underbodyFrame * 10 : null) }]}>
                  {data.scores.underbodyFrame ?? "—"}/10
                </Text>
                <Text style={styles.scoreLabel}>UNDERBODY</Text>
              </View>
            </View>
          )}

          {/* Repair cost total */}
          {totalRepairHigh > 0 && (
            <View style={styles.repairTotal}>
              <Text style={styles.repairTotalText}>
                Total Estimated Repair Cost: {fmtCurrency(totalRepairLow)} – {fmtCurrency(totalRepairHigh)}
              </Text>
            </View>
          )}
        </View>

        {/* Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>
          {[
            { label: "VIN", value: data.vehicle.vin },
            { label: "Year / Make / Model", value: `${data.vehicle.year} ${data.vehicle.make} ${data.vehicle.model}` },
            data.vehicle.trim && { label: "Trim", value: data.vehicle.trim },
            data.vehicle.exteriorColor && { label: "Exterior Color", value: data.vehicle.exteriorColor },
          ]
            .filter(Boolean)
            .map((row, i) => (
              <View key={i} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{(row as { label: string; value: string }).label}</Text>
                <Text style={styles.detailValue}>{(row as { label: string; value: string }).value}</Text>
              </View>
            ))}
        </View>

        {/* Risk Checklist Summary */}
        {data.riskChecklist && data.riskChecklist.total > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Risk Checklist Summary</Text>
            <View style={styles.checklistRow}>
              <View style={styles.checklistCard}>
                <Text style={[styles.checklistValue, { color: "#1f2937" }]}>
                  {data.riskChecklist.total}
                </Text>
                <Text style={styles.checklistLabel}>RISKS EVALUATED</Text>
              </View>
              <View style={styles.checklistCard}>
                <Text style={[styles.checklistValue, { color: "#dc2626" }]}>
                  {data.riskChecklist.confirmed}
                </Text>
                <Text style={styles.checklistLabel}>CONFIRMED</Text>
              </View>
              <View style={styles.checklistCard}>
                <Text style={[styles.checklistValue, { color: "#16a34a" }]}>
                  {data.riskChecklist.cleared}
                </Text>
                <Text style={styles.checklistLabel}>CLEARED</Text>
              </View>
              <View style={styles.checklistCard}>
                <Text style={[styles.checklistValue, { color: "#6b7280" }]}>
                  {data.riskChecklist.unableToInspect}
                </Text>
                <Text style={styles.checklistLabel}>UNABLE TO INSPECT</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          Report generated by VeriBuy on {fmtDate(data.generatedAt)} — For informational purposes only.
        </Text>
      </Page>

      {/* ---- Page 2+: Findings ---- */}
      {data.findings.length > 0 && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Findings ({data.findings.length})</Text>
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
                  {(f.repairCostLow || f.repairCostHigh) ? (
                    <Text style={styles.findingCost}>
                      Estimated repair: {fmtCurrency(f.repairCostLow || 0)} – {fmtCurrency(f.repairCostHigh || 0)}
                    </Text>
                  ) : null}
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

          <Text style={styles.footer}>
            Report #{data.number} — {data.vehicle.year} {data.vehicle.make} {data.vehicle.model} — VeriBuy
          </Text>
        </Page>
      )}
      {/* ---- Vehicle Photos Page ---- */}
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

          <Text style={styles.footer}>
            Report #{data.number} — {data.vehicle.year} {data.vehicle.make} {data.vehicle.model} — VeriBuy
          </Text>
        </Page>
      )}

      {/* ---- Page 3: Vehicle Valuation (seller-facing) ---- */}
      {data.marketAnalysis && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Valuation</Text>

            {/* Offer banner */}
            <View style={[styles.marketBanner, { backgroundColor: "#2563eb" }]}>
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

              {/* Trade-In based waterfall — back-computed to land on offer */}
              {(() => {
                const ma = data.marketAnalysis!;
                const reconCost = ma.estReconCost || 0;
                const condMult = ma.conditionMultiplier ?? 1;
                const histMult = ma.historyMultiplier ?? 1;
                const offerPrice = ma.fairBuyMax || ma.adjustedPrice;
                const hb = ma.historyBreakdown;

                // Itemized findings
                // Use estReconCost as single source of truth
                const totalRecon = reconCost;

                // Back-compute trade-in so waterfall balances exactly
                const combinedMult = condMult * histMult;
                const rawTradeIn = combinedMult > 0
                  ? (offerPrice + totalRecon) / combinedMult
                  : offerPrice + totalRecon;
                const tradeInBase = Math.round(rawTradeIn / 10000) * 10000;
                const afterCondition = Math.round(tradeInBase * condMult);
                const conditionDelta = afterCondition - tradeInBase;
                const afterHistory = histMult !== 1 ? Math.round(afterCondition * histMult) : afterCondition;
                const historyDelta = afterHistory - afterCondition;
                // Absorb rounding into condition delta
                const expected = tradeInBase + conditionDelta + historyDelta - totalRecon;
                const conditionDeltaAdj = conditionDelta + (offerPrice - expected);

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
          </View>

          <Text style={styles.footer}>
            Report #{data.number} — {data.vehicle.year} {data.vehicle.make} {data.vehicle.model} — VeriBuy
          </Text>
        </Page>
      )}
    </Document>
  );
}
