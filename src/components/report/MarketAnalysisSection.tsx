"use client";

import { Badge } from "@/components/ui/Badge";
import { formatCurrency, cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketAnalysisData {
  baselinePrice: number;          // cents — MarketCheck market baseline
  adjustedPrice: number;          // cents — final fair value for THIS car
  recommendation: string;
  strongBuyMax: number;
  fairBuyMax: number;
  overpayingMax?: number | null;

  estRetailPrice?: number | null;
  estReconCost?: number | null;
  estGrossProfit?: number | null;

  // Valuation breakdown (new fields)
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

  comparables?: Array<{
    title: string;
    price: number;
    mileage: number;
    location: string;
    source: string;
    url?: string;
  }> | null;

  // Multi-source pricing metadata
  dataSource?: string | null;              // "vinaudit" | "marketcheck" | "fallback"
  dataSourceConfidence?: number | null;    // 0-1
  configPremiums?: Array<{
    factor: string;
    multiplier: number;
    explanation: string;
  }> | null;
  configMultiplier?: number | null;
  baseValuePreConfig?: number | null;      // cents
}

interface MarketAnalysisSectionProps {
  data: MarketAnalysisData;
  /** Compact mode for StepPanel (no card wrapper) */
  compact?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMileage(miles: number): string {
  return miles >= 1000
    ? `${(miles / 1000).toFixed(0)}k mi`
    : `${miles} mi`;
}

function formatMultiplier(value: number): string {
  return value.toFixed(2) + "x";
}

function historyFactorLabel(key: string): string {
  const labels: Record<string, string> = {
    titleFactor: "Title Status",
    accidentFactor: "Accidents",
    ownerFactor: "Owner Count",
    structuralDamageFactor: "Structural Damage",
    floodDamageFactor: "Flood Damage",
    recallFactor: "Open Recalls",
  };
  return labels[key] || key;
}

const recBadgeVariant = (rec: string) =>
  rec === "STRONG_BUY" ? "success" as const :
  rec === "FAIR_BUY" ? "info" as const :
  rec === "OVERPAYING" ? "warning" as const : "danger" as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MarketAnalysisSection({ data, compact = false }: MarketAnalysisSectionProps) {
  const comps = (data.comparables ?? []) as MarketAnalysisData["comparables"] & object[];
  const hasBreakdown = data.conditionMultiplier != null;
  const bands = data.priceBands as MarketAnalysisData["priceBands"];

  const configPremiums = data.configPremiums as MarketAnalysisData["configPremiums"];
  const hasConfigPremiums = configPremiums && configPremiums.length > 0;

  return (
    <div className={cn("space-y-5", compact && "space-y-3")}>
      {/* ── Data Source + Confidence ── */}
      {data.dataSource && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={
            data.dataSource === "vinaudit" ? "info" as const :
            data.dataSource === "marketcheck" ? "success" as const :
            "warning" as const
          }>
            {data.dataSource === "vinaudit" ? "VinAudit" :
             data.dataSource === "marketcheck" ? "MarketCheck" :
             "Estimated"}
          </Badge>
          {data.dataSourceConfidence != null && (
            <span className="text-[10px] text-text-tertiary">
              {Math.round(data.dataSourceConfidence * 100)}% confidence
            </span>
          )}
          {data.dataSource === "fallback" && (
            <span className="text-[10px] text-amber-600">
              No live market data available — using category estimate + config premiums
            </span>
          )}
        </div>
      )}

      {/* ── Configuration Premiums ── */}
      {hasConfigPremiums && (
        <div className="p-3 rounded-lg bg-brand-50/50 border border-brand-200">
          <h4 className="text-xs font-semibold text-brand-700 mb-1.5">
            Configuration Premiums Applied
            {data.configMultiplier != null && (
              <span className="ml-1 font-bold">({data.configMultiplier.toFixed(2)}x total)</span>
            )}
          </h4>
          <div className="space-y-1">
            {configPremiums!.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{p.factor}</span>
                <span className="font-semibold text-brand-700">+{Math.round((p.multiplier - 1) * 100)}%</span>
              </div>
            ))}
          </div>
          {data.baseValuePreConfig != null && (
            <p className="text-[10px] text-text-tertiary mt-1.5 border-t border-brand-200 pt-1">
              Base value before premiums: {formatCurrency(data.baseValuePreConfig)}
            </p>
          )}
        </div>
      )}

      {/* ── Comparable Listings ── */}
      {comps && comps.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-2">
            Comparable Listings
          </h4>
          <p className="text-xs text-text-tertiary mb-2">
            Based on {comps.length} similar vehicles for sale nearby
          </p>
          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-overlay text-text-secondary">
                  <th className="text-left px-3 py-2 font-medium">Vehicle</th>
                  <th className="text-right px-3 py-2 font-medium">Price</th>
                  <th className="text-right px-3 py-2 font-medium">Mileage</th>
                  <th className="text-left px-3 py-2 font-medium">Location</th>
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {comps.slice(0, compact ? 5 : 8).map((c, i) => (
                  <tr key={i} className="hover:bg-surface-overlay/50">
                    <td className="px-3 py-2 text-text-primary max-w-[200px] truncate">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                          {c.title}
                        </a>
                      ) : c.title}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-text-primary">
                      ${c.price.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-text-secondary">
                      {formatMileage(c.mileage)}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{c.location}</td>
                    <td className="px-3 py-2 text-text-tertiary">{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Average comp price */}
          {comps.length > 0 && (
            <p className="text-xs text-text-tertiary mt-1.5 text-right">
              Avg. comp price: <span className="font-medium text-text-secondary">
                ${Math.round(comps.reduce((s, c) => s + c.price, 0) / comps.length).toLocaleString()}
              </span>
            </p>
          )}
        </div>
      )}

      {/* ── Fair Value at Baseline ── */}
      {data.fairValueAtBaseline != null && (
        <div className="p-3 rounded-lg bg-surface-overlay border border-border-default">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-text-tertiary">Fair Market Value (Good Condition)</p>
              <p className="text-xs text-text-tertiary">Score 85 baseline, no recon</p>
            </div>
            <p className="text-lg font-bold text-text-primary">
              {formatCurrency(data.fairValueAtBaseline)}
            </p>
          </div>
        </div>
      )}

      {/* ── Valuation Waterfall ── */}
      {hasBreakdown && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-2">
            Valuation Breakdown
          </h4>
          <div className="space-y-1.5">
            {/* Market Baseline */}
            <WaterfallRow
              label={`Market Baseline (${
                data.dataSource === "vinaudit" ? "VinAudit" :
                data.dataSource === "marketcheck" ? "MarketCheck" :
                "Estimate"
              })`}
              value={data.baselinePrice}
            />

            {/* Condition Adjustment */}
            {data.conditionMultiplier != null && data.adjustedValueBeforeRecon != null && (
              <WaterfallRow
                label={`Condition (Score ${data.conditionScore} / ${data.conditionGrade?.replace(/_/g, " ")} / ${formatMultiplier(data.conditionMultiplier)})`}
                value={Math.round(data.baselinePrice * data.conditionMultiplier) - data.baselinePrice}
                isDelta
              />
            )}

            {/* History Adjustments */}
            {data.historyMultiplier != null && data.historyMultiplier !== 1 && data.historyBreakdown && (
              <div className="pl-3 border-l-2 border-border-default space-y-1">
                {Object.entries(data.historyBreakdown)
                  .filter(([, v]) => v !== 1)
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-text-tertiary">{historyFactorLabel(key)}</span>
                      <span className={cn(
                        "font-medium",
                        value < 1 ? "text-red-600" : "text-green-600"
                      )}>
                        {formatMultiplier(value)}
                      </span>
                    </div>
                  ))
                }
                <div className="flex justify-between text-xs border-t border-border-default pt-1">
                  <span className="text-text-secondary font-medium">Combined History</span>
                  <span className="font-medium text-text-primary">{formatMultiplier(data.historyMultiplier)}</span>
                </div>
              </div>
            )}

            {/* Adjusted before recon */}
            {data.adjustedValueBeforeRecon != null && (
              <WaterfallRow label="Adjusted Value (before recon)" value={data.adjustedValueBeforeRecon} />
            )}

            {/* Recon cost */}
            {data.estReconCost != null && data.estReconCost > 0 && (
              <WaterfallRow label="Est. Reconditioning Cost" value={-data.estReconCost} isDelta />
            )}

            {/* Final value */}
            <div className="flex justify-between text-sm border-t-2 border-border-strong pt-2 mt-2">
              <span className="font-bold text-text-primary">Final Adjusted Value</span>
              <span className="font-bold text-lg text-text-primary">
                {formatCurrency(data.adjustedPrice)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Price Band Guide ── */}
      {bands && bands.length > 0 && (
        <OfferGuide bands={bands} />
      )}

      {/* ── Deal Economics ── */}
      <div className="space-y-2 pt-2 border-t border-border-default">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Est. Retail / Resale</span>
          <span className="font-medium">{data.estRetailPrice ? formatCurrency(data.estRetailPrice) : "—"}</span>
        </div>
        {data.estReconCost != null && data.estReconCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Est. Recon Cost</span>
            <span className="font-medium text-red-700">-{formatCurrency(data.estReconCost)}</span>
          </div>
        )}
        {data.estGrossProfit != null && (
          <div className="flex justify-between text-sm border-t border-border-default pt-2">
            <span className="text-text-secondary font-semibold">Est. Gross Profit</span>
            <span className={cn(
              "font-bold",
              data.estGrossProfit > 0 ? "text-green-700" : "text-red-700"
            )}>
              {formatCurrency(data.estGrossProfit)}
            </span>
          </div>
        )}
      </div>

      {/* ── Recommendation Badge (bottom summary) ── */}
      <div className={cn(
        "p-4 rounded-lg border text-center",
        data.recommendation === "STRONG_BUY" ? "bg-[#dcfce7] border-green-300" :
        data.recommendation === "FAIR_BUY" ? "bg-[#fce8f3] border-brand-300" :
        data.recommendation === "OVERPAYING" ? "bg-amber-50 border-amber-300" :
        "bg-[#fde8e8] border-red-300"
      )}>
        <Badge variant={recBadgeVariant(data.recommendation)}>
          {data.recommendation.replace(/_/g, " ")}
        </Badge>
        <p className="text-2xl font-bold text-text-primary mt-2">
          {formatCurrency(data.adjustedPrice)}
        </p>
        <p className="text-xs text-text-secondary">Fair Market Value (This Vehicle)</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function OfferGuide({ bands }: { bands: NonNullable<MarketAnalysisData["priceBands"]> }) {
  const friendlyLabel: Record<string, string> = {
    STRONG_BUY: "Strong Buy",
    FAIR_BUY: "Fair Buy",
    OVERPAYING: "Overpaying",
    PASS: "Pass",
  };

  const description: Record<string, string> = {
    STRONG_BUY: "Great deal — well below market value",
    FAIR_BUY: "Solid deal — at or below market value",
    OVERPAYING: "Above market — thin margin",
    PASS: "Walk away — too far above market",
  };

  // Build price ranges from band thresholds
  const ranges = bands.map((band, idx) => {
    let rangeText: string;
    if (idx === 0) {
      // First band: "Up to $X"
      rangeText = `Up to ${formatCurrency(band.maxPriceCents)}`;
    } else if (band.label === "PASS") {
      // Last band: "Above $X"
      rangeText = `Above ${formatCurrency(bands[idx - 1].maxPriceCents)}`;
    } else {
      // Middle bands: "$X — $Y"
      const prevMax = bands[idx - 1].maxPriceCents;
      rangeText = `${formatCurrency(prevMax + 1)} — ${formatCurrency(band.maxPriceCents)}`;
    }
    return { ...band, rangeText };
  });

  const styles: Record<string, { icon: string; text: string; bg: string; border: string }> = {
    STRONG_BUY: { icon: "bg-green-500", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
    FAIR_BUY:   { icon: "bg-brand-500", text: "text-brand-700", bg: "bg-brand-50", border: "border-brand-200" },
    OVERPAYING: { icon: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    PASS:       { icon: "bg-red-500",   text: "text-red-700",   bg: "bg-red-50",   border: "border-red-200" },
  };

  return (
    <div>
      <h4 className="text-sm font-semibold text-text-primary mb-2">
        Offer Guide
      </h4>
      <div className="space-y-1.5">
        {ranges.map((band) => {
          const s = styles[band.label] || styles.PASS;
          return (
            <div
              key={band.label}
              className={cn("flex items-center justify-between px-3 py-2.5 rounded-md border", s.bg, s.border)}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.icon)} />
                <div>
                  <span className={cn("text-xs font-bold block", s.text)}>
                    {friendlyLabel[band.label] || band.label}
                  </span>
                  <span className="text-[10px] text-text-tertiary leading-tight">
                    {description[band.label]}
                  </span>
                </div>
              </div>
              <span className={cn("text-sm font-bold whitespace-nowrap", s.text)}>
                {band.rangeText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WaterfallRow({
  label,
  value,
  isDelta = false,
}: {
  label: string;
  value: number;
  isDelta?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={cn(
        "font-medium",
        isDelta && value > 0 && "text-green-600",
        isDelta && value < 0 && "text-red-600",
        !isDelta && "text-text-primary",
      )}>
        {isDelta && value > 0 && "+"}
        {formatCurrency(value)}
      </span>
    </div>
  );
}
