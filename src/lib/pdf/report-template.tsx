import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ReportFinding {
  title: string;
  description: string;
  severity: string;
  category: string;
  repairCostLow: number | null;
  repairCostHigh: number | null;
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
    structural: number | null;
    cosmetic: number | null;
    electronics: number | null;
  };
  findings: ReportFinding[];
  riskChecklist?: {
    total: number;
    confirmed: number;
    cleared: number;
    unableToInspect: number;
  };
  mediaCount: number;
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

          {/* Sub-scores */}
          {data.scores.overall != null && (
            <View style={styles.scoreRow}>
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreValue, { fontSize: 16, color: scoreColor(data.scores.structural) }]}>
                  {data.scores.structural ?? "—"}/100
                </Text>
                <Text style={styles.scoreLabel}>STRUCTURAL</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreValue, { fontSize: 16, color: scoreColor(data.scores.cosmetic) }]}>
                  {data.scores.cosmetic ?? "—"}/100
                </Text>
                <Text style={styles.scoreLabel}>COSMETIC</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreValue, { fontSize: 16, color: scoreColor(data.scores.electronics) }]}>
                  {data.scores.electronics ?? "—"}/100
                </Text>
                <Text style={styles.scoreLabel}>ELECTRONICS</Text>
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
            <Text style={styles.sectionTitle}>Findings ({data.findings.length})</Text>
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
                </View>
              );
            })}
          </View>

          <Text style={styles.footer}>
            Report #{data.number} — {data.vehicle.year} {data.vehicle.make} {data.vehicle.model} — VeriBuy
          </Text>
        </Page>
      )}
      {/* ---- Page 3: Market Analysis ---- */}
      {data.marketAnalysis && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Market Analysis</Text>

            {/* Recommendation banner */}
            <View style={[styles.marketBanner, {
              backgroundColor:
                data.marketAnalysis.recommendation === "STRONG_BUY" ? "#16a34a" :
                data.marketAnalysis.recommendation === "FAIR_BUY" ? "#2563eb" :
                data.marketAnalysis.recommendation === "OVERPAYING" ? "#d97706" : "#dc2626",
            }]}>
              <Text style={styles.marketBannerLabel}>Fair Market Value (This Vehicle)</Text>
              <Text style={styles.marketBannerValue}>{fmtCurrency(data.marketAnalysis.adjustedPrice)}</Text>
              <Text style={styles.marketBannerRec}>
                {data.marketAnalysis.recommendation.replace(/_/g, " ")}
              </Text>
            </View>

            {/* Comparable Listings */}
            {data.marketAnalysis.comparables && data.marketAnalysis.comparables.length > 0 && (
              <View style={styles.section}>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
                  Comparable Listings ({data.marketAnalysis.comparables.length})
                </Text>
                <View style={styles.compTable}>
                  <View style={styles.compHeaderRow}>
                    <Text style={[styles.compHeader, { flex: 3 }]}>VEHICLE</Text>
                    <Text style={[styles.compHeader, { flex: 1, textAlign: "right" }]}>PRICE</Text>
                    <Text style={[styles.compHeader, { flex: 1, textAlign: "right" }]}>MILEAGE</Text>
                    <Text style={[styles.compHeader, { flex: 2 }]}>LOCATION</Text>
                  </View>
                  {data.marketAnalysis.comparables.slice(0, 6).map((c, i) => (
                    <View key={i} style={styles.compRow}>
                      <Text style={[styles.compCell, { flex: 3 }]}>{c.title}</Text>
                      <Text style={[styles.compCellBold, { flex: 1, textAlign: "right" }]}>
                        ${c.price.toLocaleString()}
                      </Text>
                      <Text style={[styles.compCell, { flex: 1, textAlign: "right" }]}>
                        {(c.mileage / 1000).toFixed(0)}k mi
                      </Text>
                      <Text style={[styles.compCell, { flex: 2 }]}>{c.location}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Valuation Waterfall */}
            <View style={styles.section}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
                Valuation Breakdown
              </Text>

              <View style={styles.marketRow}>
                <Text style={styles.marketLabel}>Market Baseline (VinAudit)</Text>
                <Text style={styles.marketValue}>{fmtCurrency(data.marketAnalysis.baselinePrice)}</Text>
              </View>

              {data.marketAnalysis.fairValueAtBaseline != null && (
                <View style={styles.marketRow}>
                  <Text style={styles.marketLabel}>Fair Value at Good Condition (Score 85)</Text>
                  <Text style={styles.marketValue}>{fmtCurrency(data.marketAnalysis.fairValueAtBaseline)}</Text>
                </View>
              )}

              {data.marketAnalysis.conditionMultiplier != null && (
                <View style={styles.marketRow}>
                  <Text style={styles.marketLabel}>
                    Condition (Score {data.marketAnalysis.conditionScore} / {data.marketAnalysis.conditionGrade?.replace(/_/g, " ")} / {data.marketAnalysis.conditionMultiplier.toFixed(2)}x)
                  </Text>
                  {(() => {
                    const delta = Math.round(data.marketAnalysis.baselinePrice * data.marketAnalysis.conditionMultiplier!) - data.marketAnalysis.baselinePrice;
                    return (
                      <Text style={delta >= 0 ? styles.marketDeltaPos : styles.marketDeltaNeg}>
                        {delta >= 0 ? "+" : ""}{fmtCurrency(delta)}
                      </Text>
                    );
                  })()}
                </View>
              )}

              {data.marketAnalysis.historyMultiplier != null && data.marketAnalysis.historyMultiplier !== 1 && (
                <View style={styles.marketRow}>
                  <Text style={styles.marketLabel}>
                    History Adjustment ({data.marketAnalysis.historyMultiplier.toFixed(2)}x)
                  </Text>
                  {(() => {
                    const condAdj = Math.round(data.marketAnalysis.baselinePrice * (data.marketAnalysis.conditionMultiplier ?? 1));
                    const delta = Math.round(condAdj * data.marketAnalysis.historyMultiplier!) - condAdj;
                    return (
                      <Text style={delta >= 0 ? styles.marketDeltaPos : styles.marketDeltaNeg}>
                        {delta >= 0 ? "+" : ""}{fmtCurrency(delta)}
                      </Text>
                    );
                  })()}
                </View>
              )}

              {data.marketAnalysis.adjustedValueBeforeRecon != null && (
                <View style={styles.marketRow}>
                  <Text style={styles.marketLabel}>Adjusted Value (before recon)</Text>
                  <Text style={styles.marketValue}>{fmtCurrency(data.marketAnalysis.adjustedValueBeforeRecon)}</Text>
                </View>
              )}

              {data.marketAnalysis.estReconCost != null && data.marketAnalysis.estReconCost > 0 && (
                <View style={styles.marketRow}>
                  <Text style={styles.marketLabel}>Est. Reconditioning Cost</Text>
                  <Text style={styles.marketDeltaNeg}>-{fmtCurrency(data.marketAnalysis.estReconCost)}</Text>
                </View>
              )}

              <View style={[styles.marketRow, { borderBottomWidth: 2, borderBottomColor: "#1f2937", paddingVertical: 6 }]}>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1f2937" }}>Final Adjusted Value</Text>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1f2937" }}>
                  {fmtCurrency(data.marketAnalysis.adjustedPrice)}
                </Text>
              </View>
            </View>

            {/* Price Bands */}
            {data.marketAnalysis.priceBands && data.marketAnalysis.priceBands.length > 0 && (
              <View style={styles.section}>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
                  Offer Guide
                </Text>
                {data.marketAnalysis.priceBands.map((band, i) => {
                  const color =
                    band.label === "STRONG_BUY" ? "#16a34a" :
                    band.label === "FAIR_BUY" ? "#2563eb" :
                    band.label === "OVERPAYING" ? "#d97706" : "#dc2626";
                  const bg =
                    band.label === "STRONG_BUY" ? "#f0fdf4" :
                    band.label === "FAIR_BUY" ? "#eff6ff" :
                    band.label === "OVERPAYING" ? "#fffbeb" : "#fef2f2";
                  return (
                    <View key={i} style={[styles.bandRow, { backgroundColor: bg }]}>
                      <View style={[styles.bandDot, { backgroundColor: color }]} />
                      <Text style={[styles.bandLabel, { color }]}>
                        {band.label.replace(/_/g, " ")}
                      </Text>
                      <Text style={[styles.bandPrice, { color }]}>
                        {band.label === "PASS"
                          ? `> ${fmtCurrency(band.maxPriceCents)}`
                          : `\u2264 ${fmtCurrency(band.maxPriceCents)}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Deal Economics */}
            <View style={styles.section}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
                Deal Economics
              </Text>
              {data.marketAnalysis.estRetailPrice != null && (
                <View style={styles.marketRow}>
                  <Text style={styles.marketLabel}>Est. Retail / Resale</Text>
                  <Text style={styles.marketValue}>{fmtCurrency(data.marketAnalysis.estRetailPrice)}</Text>
                </View>
              )}
              {data.marketAnalysis.estReconCost != null && data.marketAnalysis.estReconCost > 0 && (
                <View style={styles.marketRow}>
                  <Text style={styles.marketLabel}>Est. Recon Cost</Text>
                  <Text style={styles.marketDeltaNeg}>-{fmtCurrency(data.marketAnalysis.estReconCost)}</Text>
                </View>
              )}
              {data.marketAnalysis.estGrossProfit != null && (
                <View style={[styles.marketRow, { borderBottomWidth: 0 }]}>
                  <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1f2937" }}>Est. Gross Profit</Text>
                  <Text style={{
                    fontSize: 10,
                    fontFamily: "Helvetica-Bold",
                    color: data.marketAnalysis.estGrossProfit >= 0 ? "#16a34a" : "#dc2626",
                  }}>
                    {fmtCurrency(data.marketAnalysis.estGrossProfit)}
                  </Text>
                </View>
              )}
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
