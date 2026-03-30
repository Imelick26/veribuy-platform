"use client";

import { Badge } from "@/components/ui/Badge";
import { formatCurrency, cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketAnalysisData {
  baselinePrice: number;          // cents — market baseline
  adjustedPrice: number;          // cents — recommended buy price
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

  comparables?: Array<{
    title: string;
    price: number;
    mileage: number;
    location: string;
    source: string;
    url?: string;
  }> | null;

  dataSource?: string | null;
  dataSourceConfidence?: number | null;
  configPremiums?: Array<{
    factor: string;
    multiplier: number;
    explanation: string;
  }> | null;
  configMultiplier?: number | null;
  baseValuePreConfig?: number | null;

  tradeInValue?: number | null;
  privatePartyValue?: number | null;
  dealerRetailValue?: number | null;
  wholesaleValue?: number | null;
  loanValue?: number | null;

  vdbConditionTier?: string | null;
  sourceResults?: Array<{
    source: string;
    estimatedValue: number;
    confidence: number;
    isConditionTiered: boolean;
    wholesaleValue?: number;
    loanValue?: number;
  }> | null;
  consensusMethod?: string | null;
  configPremiumMode?: string | null;
  conditionAttenuation?: number | null;
  sourceCount?: number | null;

  aiAuditorApproved?: boolean | null;
  aiAuditorCoherence?: number | null;
  aiAuditorFlags?: string[] | null;
  aiAuditorReasoning?: string | null;
}

interface MarketAnalysisSectionProps {
  data: MarketAnalysisData;
  compact?: boolean;
  /** Hide the hero recommended buy price card (when already shown elsewhere) */
  hideHero?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMileage(miles: number): string {
  return miles >= 1000 ? `${(miles / 1000).toFixed(0)}k mi` : `${miles} mi`;
}

const recColor = (rec: string) =>
  rec === "STRONG_BUY" ? { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" } :
  rec === "FAIR_BUY" ? { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" } :
  { bg: "bg-red-50", border: "border-red-300", text: "text-red-700" };

const recBadgeVariant = (rec: string) =>
  rec === "STRONG_BUY" ? "success" as const :
  rec === "FAIR_BUY" ? "warning" as const : "danger" as const;

const recLabel = (rec: string) =>
  rec === "STRONG_BUY" ? "Strong Buy" :
  rec === "FAIR_BUY" ? "Fair Buy" :
  rec === "OVERPAYING" ? "Overpaying" : "Pass";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MarketAnalysisSection({ data, compact = false, hideHero = false }: MarketAnalysisSectionProps) {
  const comps = (data.comparables ?? []) as MarketAnalysisData["comparables"] & object[];
  const bands = data.priceBands as MarketAnalysisData["priceBands"];

  // The recommended buy price is the top of the "Fair Buy" band — always a good deal
  const recommendedPrice = data.fairBuyMax || data.adjustedPrice;
  // Color is always green/amber (it's a recommended price, never overpaying)
  const rc = recColor("FAIR_BUY");

  // Compute avg comp price + mileage + days on market
  const avgCompPrice = comps && comps.length > 0
    ? Math.round(comps.reduce((s, c) => s + c.price, 0) / comps.length)
    : null;
  const compsWithMileage = comps?.filter((c) => c.mileage > 0) ?? [];
  const avgCompMileage = compsWithMileage.length > 0
    ? Math.round(compsWithMileage.reduce((s, c) => s + c.mileage, 0) / compsWithMileage.length)
    : null;
  const compsWithDom = (comps as Array<{ daysOnMarket?: number }>)?.filter((c) => c.daysOnMarket && c.daysOnMarket > 0) ?? [];
  const avgDaysOnMarket = compsWithDom.length > 0
    ? Math.round(compsWithDom.reduce((s, c) => s + (c.daysOnMarket || 0), 0) / compsWithDom.length)
    : null;

  // Compute waterfall values — start from Est. Retail (what dealer lists it for)
  const estRetail = data.estRetailPrice || data.baselinePrice;
  const reconCost = data.estReconCost || 0;
  const conditionDelta = data.conditionMultiplier != null
    ? Math.round(estRetail * data.conditionMultiplier) - estRetail
    : 0;
  const afterCondition = estRetail + conditionDelta;
  const historyDelta = data.historyMultiplier != null && data.historyMultiplier !== 1
    ? Math.round(afterCondition * data.historyMultiplier) - afterCondition
    : 0;
  const afterHistory = afterCondition + historyDelta;
  const fairMarketValue = afterHistory - reconCost;
  const dealerMargin = fairMarketValue - recommendedPrice;

  return (
    <div className={cn("space-y-5", compact && "space-y-3")}>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: THE DECISION                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ── Hero: Recommended Buy Price ── */}
      {!hideHero && <div className="p-5 rounded-xl border border-border-default bg-surface-overlay">
        <div>
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Recommended Buy Price
          </p>
          <p className="text-2xl font-bold text-text-primary mt-0.5">
            {formatCurrency(recommendedPrice)}
          </p>
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-default text-xs">
          <div>
            <span className="text-text-tertiary">Est. Retail</span>
            <span className="font-semibold text-text-primary ml-1.5">
              {data.estRetailPrice ? formatCurrency(data.estRetailPrice) : "—"}
            </span>
          </div>
          {data.estGrossProfit != null && (
            <div>
              <span className="text-text-tertiary">Est. Margin</span>
              <span className={cn("font-semibold ml-1.5", data.estGrossProfit > 0 ? "text-green-600" : "text-red-600")}>
                {formatCurrency(data.estGrossProfit)}
              </span>
            </div>
          )}
          {reconCost > 0 && (
            <div>
              <span className="text-text-tertiary">Est. Recon</span>
              <span className="font-semibold text-red-600 ml-1.5">-{formatCurrency(reconCost)}</span>
            </div>
          )}
        </div>
      </div>}

      {/* ── Negotiation Playbook ── */}
      <NegotiationPlaybook recommendedPrice={recommendedPrice} />

      {/* Deal economics now shown inline in the hero card above */}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: HOW WE GOT HERE                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ── Avg Comparable Price + Time on Lot ── */}
      {avgCompPrice != null && (
        <div className="p-3 rounded-lg bg-surface-overlay border border-border-default">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-text-primary">Avg. Comparable Price</p>
              <p className="text-[10px] text-text-tertiary">
                Based on {comps!.length} similar listings
                {avgCompMileage != null && ` · Avg. ${avgCompMileage.toLocaleString()} mi`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {avgDaysOnMarket != null && (
                <div className="text-right">
                  <p className="text-lg font-bold text-text-primary">{avgDaysOnMarket} days</p>
                  <p className="text-[10px] text-text-tertiary">Avg. Time on Lot</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-lg font-bold text-text-primary">
                  ${avgCompPrice.toLocaleString()}
                </p>
                <p className="text-[10px] text-text-tertiary">Avg. Price</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Simplified Waterfall ── */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-2">
          Pricing Breakdown
        </h4>
        <div className="space-y-1.5 text-sm">
          {/* Est. Dealer Retail */}
          <div className="flex justify-between">
            <span className="text-text-secondary">Est. Dealer Retail</span>
            <span className="font-medium text-text-primary">{formatCurrency(estRetail)}</span>
          </div>

          {/* Condition */}
          {conditionDelta !== 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">
                Condition ({data.conditionScore}/100)
              </span>
              <span className={cn("font-medium", conditionDelta > 0 ? "text-green-600" : "text-red-600")}>
                {conditionDelta > 0 ? "+" : ""}{formatCurrency(conditionDelta)}
              </span>
            </div>
          )}

          {/* History */}
          {historyDelta !== 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Vehicle History</span>
              <span className={cn("font-medium", historyDelta > 0 ? "text-green-600" : "text-red-600")}>
                {historyDelta > 0 ? "+" : ""}{formatCurrency(historyDelta)}
              </span>
            </div>
          )}

          {/* Recon */}
          {reconCost > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Est. Reconditioning</span>
              <span className="font-medium text-red-600">-{formatCurrency(reconCost)}</span>
            </div>
          )}

          {/* Fair Market Value line */}
          <div className="flex justify-between border-t border-border-default pt-1.5">
            <span className="font-semibold text-text-primary">Fair Market Value</span>
            <span className="font-bold text-text-primary">{formatCurrency(fairMarketValue)}</span>
          </div>

          {/* Dealer Margin */}
          {dealerMargin != null && dealerMargin > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Dealer Margin</span>
              <span className="font-medium text-red-600">-{formatCurrency(dealerMargin)}</span>
            </div>
          )}

          {/* Recommended Buy Price */}
          <div className="flex justify-between border-t-2 pt-2 mt-1 border-green-300">
            <span className="font-bold text-green-700">Recommended Buy Price</span>
            <span className="font-bold text-lg text-green-700">
              {formatCurrency(recommendedPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Market Comps count ── */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-surface-overlay border-border-default">
        <span className="text-xs font-semibold text-text-secondary">Market Comps</span>
        <span className="text-xs font-bold text-text-primary">{comps?.length ?? 0} comparable{(comps?.length ?? 0) === 1 ? "" : "s"} pulled</span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: MARKET DATA (evidence)                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ── Comparable Listings Table ── */}
      {comps && comps.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-2">
            Comparable Listings
          </h4>
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
        </div>
      )}

      {/* Five-perspective pricing removed — not needed for dealer reports */}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function NegotiationPlaybook({ recommendedPrice }: { recommendedPrice: number }) {
  if (recommendedPrice <= 0) return null;

  const roundTo50 = (v: number) => Math.round(v / 5000) * 5000;
  const openAt = roundTo50(Math.round(recommendedPrice * 0.80));
  const walkAway = roundTo50(Math.round(recommendedPrice * 1.12));

  return (
    <div>
      <h4 className="text-base font-semibold text-text-primary tracking-tight mb-3">Negotiation Playbook</h4>
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg border border-border-default bg-surface-raised text-center">
          <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Open At</p>
          <p className="text-xl font-bold text-text-primary mt-1">{formatCurrency(openAt)}</p>
          <p className="text-[10px] text-text-tertiary mt-1">Start here</p>
        </div>
        <div className="p-4 rounded-lg border-2 border-text-primary bg-surface-raised text-center">
          <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Target</p>
          <p className="text-xl font-bold text-text-primary mt-1">{formatCurrency(recommendedPrice)}</p>
          <p className="text-[10px] text-text-tertiary mt-1">Recommended buy</p>
        </div>
        <div className="p-4 rounded-lg border border-border-default bg-surface-raised text-center">
          <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Walk Away</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(walkAway)}</p>
          <p className="text-[10px] text-text-tertiary mt-1">Don&apos;t exceed</p>
        </div>
      </div>
    </div>
  );
}

function PerspectiveCard({ label, value, color, bgColor, borderColor }: {
  label: string; value?: number | null; color: string; bgColor: string; borderColor: string;
}) {
  if (!value) return null;
  return (
    <div className={cn("p-2.5 rounded-lg border text-center", bgColor, borderColor)}>
      <p className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5", color)}>{formatCurrency(value)}</p>
    </div>
  );
}
