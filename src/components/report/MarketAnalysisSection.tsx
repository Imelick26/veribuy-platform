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

export interface MarketAnalysisSectionProps {
  data: MarketAnalysisData;
  compact?: boolean;
  /** Hide the hero recommended buy price card (when already shown elsewhere) */
  hideHero?: boolean;
  /** Dealer = internal economics; Seller = justify offer to car seller */
  audience?: "dealer" | "seller";
  /** Inspection overall score (0-100) — used in seller mode for condition label */
  overallScore?: number | null;
  /** Override recon cost (cents) from AI valuation log for consistency */
  reconCostOverride?: number | null;
  /** Org's base margin percent (e.g. 20) — scaled by condition tier */
  targetMarginPercent?: number | null;
  /** Org's minimum profit per vehicle in cents */
  minProfitPerUnit?: number | null;
  /** Per-vehicle margin override (percentage) — bypasses condition tier */
  marginOverride?: number | null;
  /** Offer justification mode — "AI_ESTIMATED" | "CUSTOM_NOTES" | null */
  offerMode?: string | null;
  /** Custom dealer notes for the offer (when mode = CUSTOM_NOTES) */
  offerNotes?: string | null;
  /** AI-computed cost decomposition (when mode = AI_ESTIMATED) */
  offerCostBreakdown?: {
    costItems?: Array<{ label: string; amountCents: number; description: string }>;
    totalCostsCents?: number;
    reasoning?: string;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMileage(miles: number): string {
  return miles >= 1000 ? `${(miles / 1000).toFixed(0)}k mi` : `${miles} mi`;
}

const recColor = (rec: string) =>
  rec === "STRONG_BUY" ? { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" } :
  rec === "FAIR_BUY" ? { bg: "bg-caution-50", border: "border-caution-300", text: "text-caution-600" } :
  { bg: "bg-red-50", border: "border-red-300", text: "text-red-700" };

const recBadgeVariant = (rec: string) =>
  rec === "STRONG_BUY" ? "success" as const :
  rec === "FAIR_BUY" ? "warning" as const : "danger" as const;

/** Condition-based margin: scales from base margin setting based on vehicle condition */
export function getConditionMarginPct(baseMarginPct: number, conditionScore: number | null): number {
  const score = conditionScore ?? 70;
  if (score >= 85) return Math.round(baseMarginPct * 0.65);
  if (score >= 70) return baseMarginPct;
  if (score >= 60) return Math.round(baseMarginPct * 1.25);
  return Math.round(baseMarginPct * 1.50);
}

export function getConditionTierLabel(conditionScore: number | null): string {
  const score = conditionScore ?? 70;
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  return "Poor";
}

const recLabel = (rec: string) =>
  rec === "STRONG_BUY" ? "Strong Buy" :
  rec === "FAIR_BUY" ? "Fair Buy" :
  rec === "OVERPAYING" ? "Overpaying" : "Pass";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MarketAnalysisSection({ data, compact = false, hideHero = false, audience = "dealer", overallScore, reconCostOverride, targetMarginPercent, minProfitPerUnit, marginOverride, offerMode, offerNotes, offerCostBreakdown }: MarketAnalysisSectionProps) {
  const isSeller = audience === "seller";
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

  // Compute waterfall values — use stored data (shows how buy price was computed)
  // All rounded to whole cents (no decimals in display)
  const estRetail = data.estRetailPrice || data.baselinePrice;
  const reconCost = reconCostOverride || data.estReconCost || 0;
  const conditionDelta = data.conditionMultiplier != null
    ? Math.round(Math.round(estRetail * data.conditionMultiplier) - estRetail)
    : 0;
  const afterCondition = estRetail + conditionDelta;
  const historyDelta = data.historyMultiplier != null && data.historyMultiplier !== 1
    ? Math.round(Math.round(afterCondition * data.historyMultiplier) - afterCondition)
    : 0;
  const afterHistory = afterCondition + historyDelta;
  const fairMarketValue = Math.round(afterHistory - reconCost);
  // Dealer margin: condition-based tier (or override), with minimum floor
  const basePct = targetMarginPercent ?? 20;
  const condScore = overallScore ?? data.conditionScore ?? null;
  const marginPct = marginOverride ?? getConditionMarginPct(basePct, condScore);
  const tierLabel = getConditionTierLabel(condScore);
  const minProfit = minProfitPerUnit ?? 150000;
  const pctMarginAmount = Math.round(estRetail * (marginPct / 100));
  const dealerMarginFromSetting = Math.max(pctMarginAmount, minProfit);
  const dealerBuyPrice = Math.max(0, Math.round((estRetail - dealerMarginFromSetting - reconCost) / 100) * 100);

  // ── Seller waterfall: data-driven, fixed values ──
  // Trade-in is sourced from market APIs (BB, NADA, VinAudit), NOT back-computed.
  // Condition/history adjustments are fixed from AI analysis.
  // Repairs are fixed from inspection findings.
  // "Overhead costs" is the only variable — it absorbs the dealer's margin.

  const sellerReconCost = reconCost;
  const condMult = data.conditionMultiplier ?? 1;
  const histMult = data.historyMultiplier ?? 1;

  // Trade-in: use actual API-sourced value, rounded to nearest $100 for clean display
  // Falls back to back-computation only if no API trade-in data exists
  const sellerOffer = dealerBuyPrice;
  const apiTradeIn = data.tradeInValue;
  const tradeInBase = apiTradeIn != null && apiTradeIn > 0
    ? Math.round(apiTradeIn / 10000) * 10000 // nearest $100 (cents)
    : Math.round(((sellerOffer + sellerReconCost) / (condMult * histMult)) / 10000) * 10000; // legacy fallback

  // Condition & history deltas — fixed from AI, applied to the trade-in
  const sellerAfterCondition = Math.round(tradeInBase * condMult);
  const sellerConditionDelta = sellerAfterCondition - tradeInBase;
  const sellerAfterHistory = histMult !== 1
    ? Math.round(sellerAfterCondition * histMult)
    : sellerAfterCondition;
  const sellerHistoryDelta = sellerAfterHistory - sellerAfterCondition;

  // Adjusted vehicle value = trade-in after condition + history - repairs (ALL FIXED)
  const adjustedVehicleValue = sellerAfterHistory - sellerReconCost;

  // Overhead costs = the gap between the fixed adjusted value and the dealer's offer
  // This is what the AI cost breakdown explains. It absorbs the dealer's margin.
  const sellerOverheadCosts = Math.max(0, adjustedVehicleValue - sellerOffer);

  // For backward compat with rounding — absorb into condition delta
  const sellerConditionDeltaAdj = sellerConditionDelta;

  // Seller-facing condition grade from the inspection overall score
  const sellerGrade = overallScore != null
    ? (overallScore >= 85 ? "Excellent" : overallScore >= 70 ? "Good" : overallScore >= 60 ? "Fair" : "Poor")
    : data.conditionGrade?.replace("_", " ") ?? null;

  return (
    <div className={cn("space-y-5", compact && "space-y-3")}>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: THE DECISION                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ── Hero card ── */}
      {!hideHero && (isSeller ? (
        /* Seller: "Our Offer" framing */
        <div className="p-5 rounded-xl border border-border-default bg-surface-overlay">
          <div>
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Our Offer
            </p>
            <p className="text-2xl font-bold text-text-primary mt-0.5">
              {formatCurrency(sellerOffer)}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-default text-xs">
            <div>
              <span className="text-text-tertiary">Trade-In Estimate</span>
              <span className="font-semibold text-text-primary ml-1.5">
                {formatCurrency(tradeInBase)}
              </span>
            </div>
            {sellerReconCost > 0 && (
              <div>
                <span className="text-text-tertiary">Needed Repairs</span>
                <span className="font-semibold text-red-600 ml-1.5">-{formatCurrency(sellerReconCost)}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Dealer: full economics */
        <div className="p-5 rounded-xl border border-border-default bg-surface-overlay">
          <div>
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Recommended Buy Price
            </p>
            <p className="text-2xl font-bold text-text-primary mt-0.5">
              {formatCurrency(dealerBuyPrice)}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border-default text-xs">
            <div>
              <span className="text-text-tertiary">Est. Retail</span>
              <span className="font-semibold text-text-primary ml-1.5">
                {data.estRetailPrice ? formatCurrency(data.estRetailPrice) : "—"}
              </span>
            </div>
            {(() => {
              const grossProfit = estRetail - dealerBuyPrice - reconCost;
              return (
                <div>
                  <span className="text-text-tertiary">Est. Margin</span>
                  <span className={cn("font-semibold ml-1.5", grossProfit > 0 ? "text-green-600" : "text-red-600")}>
                    {formatCurrency(grossProfit)}
                  </span>
                </div>
              );
            })()}
            {reconCost > 0 && (
              <div>
                <span className="text-text-tertiary">Est. Recon</span>
                <span className="font-semibold text-red-600 ml-1.5">-{formatCurrency(reconCost)}</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* ── Negotiation Playbook (dealer only) ── */}
      {!hideHero && !isSeller && <NegotiationPlaybook recommendedPrice={dealerBuyPrice} />}

      {/* Deal economics now shown inline in the hero card above */}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: HOW WE GOT HERE                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ── Avg Comparable Price + Time on Lot (dealer only) ── */}
      {!isSeller && avgCompPrice != null && (
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

      {/* ── Waterfall ── */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-2">
          {isSeller ? "How We Determined This Offer" : "Pricing Breakdown"}
        </h4>
        {isSeller ? (
          /* ── Seller waterfall: Trade-In → deductions → Our Offer ── */
          <div className="space-y-1.5 text-sm">
            {/* Trade-In Estimate baseline */}
            <div className="flex justify-between">
              <span className="text-text-secondary">Trade-In Estimate</span>
              <span className="font-medium text-text-primary">{formatCurrency(tradeInBase)}</span>
            </div>

            {/* Condition */}
            {sellerConditionDeltaAdj !== 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Condition Adjustment{sellerGrade ? ` (${sellerGrade})` : ""}
                </span>
                <span className={cn("font-medium", sellerConditionDeltaAdj > 0 ? "text-green-600" : "text-red-600")}>
                  {sellerConditionDeltaAdj > 0 ? "+" : ""}{formatCurrency(sellerConditionDeltaAdj)}
                </span>
              </div>
            )}

            {/* History */}
            {sellerHistoryDelta !== 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Vehicle History Impact</span>
                  <span className={cn("font-medium", sellerHistoryDelta > 0 ? "text-green-600" : "text-red-600")}>
                    {sellerHistoryDelta > 0 ? "+" : ""}{formatCurrency(sellerHistoryDelta)}
                  </span>
                </div>
                {data.historyBreakdown && (
                  <HistoryFactorBreakdown
                    breakdown={data.historyBreakdown}
                    afterCondition={sellerAfterCondition}
                  />
                )}
              </>
            )}

            {/* Recon — single line */}
            {sellerReconCost > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Estimated Repairs Needed</span>
                <span className="font-medium text-red-600">-{formatCurrency(sellerReconCost)}</span>
              </div>
            )}

            {/* Dealer overhead costs — with inline AI breakdown */}
            {sellerOverheadCosts > 0 && (
              <div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Dealer Acquisition Costs</span>
                  <span className="font-medium text-red-600">-{formatCurrency(sellerOverheadCosts)}</span>
                </div>
                {/* AI breakdown sub-items */}
                {offerMode === "AI_ESTIMATED" && offerCostBreakdown?.costItems && offerCostBreakdown.costItems.length > 0 && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {offerCostBreakdown.costItems.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-text-tertiary">
                        <span>{item.label}</span>
                        <span>-{formatCurrency(item.amountCents)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Custom notes inline */}
                {offerMode === "CUSTOM_NOTES" && offerNotes && (
                  <p className="ml-4 mt-1 text-xs text-text-tertiary italic">{offerNotes}</p>
                )}
              </div>
            )}

            {/* Our Offer (bottom line) */}
            <div className="flex justify-between border-t-2 pt-2 mt-1 border-green-300">
              <span className="font-bold text-green-700">Our Offer</span>
              <span className="font-bold text-lg text-green-700">
                {formatCurrency(sellerOffer)}
              </span>
            </div>
          </div>
        ) : (
          /* ── Dealer waterfall: Retail - Margin - Recon = Buy Price ── */
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Est. Retail</span>
              <span className="font-medium text-text-primary">{formatCurrency(estRetail)}</span>
            </div>

            {dealerMarginFromSetting > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Dealer Margin ({marginPct}%{marginOverride == null ? ` \u00b7 ${tierLabel}` : " \u00b7 Override"})
                </span>
                <span className="font-medium text-red-600">-{formatCurrency(dealerMarginFromSetting)}</span>
              </div>
            )}

            {reconCost > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Est. Reconditioning</span>
                <span className="font-medium text-red-600">-{formatCurrency(reconCost)}</span>
              </div>
            )}

            <div className="flex justify-between border-t-2 pt-2 mt-1 border-green-300">
              <span className="font-bold text-green-700">Recommended Buy Price</span>
              <span className="font-bold text-lg text-green-700">
                {formatCurrency(dealerBuyPrice)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Price ladder and separate "What Goes Into" sections removed —
           AI breakdown is now shown inline under "Dealer Acquisition Costs"
           in the waterfall above */}

      {/* ── Seller: Data confidence badge ── */}
      {isSeller && data.sourceCount != null && data.sourceCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-50 border border-brand-200">
          <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[11px] text-brand-700 font-medium">
            This valuation is based on {data.sourceCount} independent market data source{data.sourceCount !== 1 ? "s" : ""} and verified by AI audit
          </span>
        </div>
      )}

      {/* ── Market Comps count (dealer only) ── */}
      {!isSeller && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-surface-overlay border-border-default">
          <span className="text-xs font-semibold text-text-secondary">Market Comps</span>
          <span className="text-xs font-bold text-text-primary">{comps?.length ?? 0} comparable{(comps?.length ?? 0) === 1 ? "" : "s"} pulled</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: MARKET DATA (dealer only)                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ── Comparable Listings Table (dealer only) ── */}
      {!isSeller && comps && comps.length > 0 && (
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

function HistoryFactorBreakdown({ breakdown, afterCondition }: {
  breakdown: NonNullable<MarketAnalysisData["historyBreakdown"]>;
  afterCondition: number;
}) {
  const factors: Array<{ label: string; factor: number; detail: string }> = [];

  if (breakdown.titleFactor < 1)
    factors.push({
      label: "Title Status",
      factor: breakdown.titleFactor,
      detail: breakdown.titleFactor <= 0.55 ? "Salvage title" : breakdown.titleFactor <= 0.75 ? "Rebuilt title" : "Title issue",
    });
  if (breakdown.accidentFactor < 1) {
    const count = breakdown.accidentFactor <= 0.70 ? "3+" : breakdown.accidentFactor <= 0.80 ? "2" : "1";
    factors.push({ label: "Accident History", factor: breakdown.accidentFactor, detail: `${count} accident${count === "1" ? "" : "s"} reported` });
  }
  if (breakdown.ownerFactor < 1) {
    const count = breakdown.ownerFactor <= 0.90 ? "5+" : breakdown.ownerFactor <= 0.94 ? "4" : "3";
    factors.push({ label: "Ownership History", factor: breakdown.ownerFactor, detail: `${count} previous owners` });
  }
  if (breakdown.structuralDamageFactor < 1)
    factors.push({ label: "Structural Damage", factor: breakdown.structuralDamageFactor, detail: "Structural damage reported" });
  if (breakdown.floodDamageFactor < 1)
    factors.push({ label: "Flood Damage", factor: breakdown.floodDamageFactor, detail: "Flood damage reported" });

  if (factors.length === 0) return null;

  return (
    <div className="ml-4 space-y-1 text-xs">
      {factors.map((f) => {
        const impact = Math.round(afterCondition * f.factor - afterCondition);
        return (
          <div key={f.label} className="flex justify-between text-text-tertiary">
            <span>{f.detail}</span>
            <span className="text-red-500">{formatCurrency(impact)}</span>
          </div>
        );
      })}
    </div>
  );
}

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
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(openAt)}</p>
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
