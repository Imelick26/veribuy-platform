"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { MarketAnalysisSection } from "@/components/report/MarketAnalysisSection";
import type { MarketAnalysisData } from "@/components/report/MarketAnalysisSection";
import { PhotoGallery } from "@/components/report/PhotoGallery";
import { getConditionGrade } from "@/lib/market-valuation";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  ArrowLeft, FileText, RefreshCw, ThumbsUp, ThumbsDown, DollarSign, Check, X,
  Activity, History, TrendingUp, Camera, ShieldAlert, CircleDot,
  Car,
} from "lucide-react";

type Tab = "condition" | "history" | "market" | "photos" | "risks";

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: vehicle, isLoading } = trpc.vehicle.getDetail.useQuery({ id });
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<Tab>("risks");
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState("");

  const recordOutcome = trpc.inspection.recordOutcome.useMutation({
    onSuccess: () => {
      utils.vehicle.getDetail.invalidate({ id });
      setShowPriceInput(false);
      setPurchasePrice("");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner-gradient" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-20">
        <Car className="h-8 w-8 mx-auto mb-2 text-text-tertiary" />
        <p className="text-text-secondary">Vehicle not found</p>
        <Link href="/dashboard/vehicles">
          <Button variant="secondary" className="mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to Vehicles
          </Button>
        </Link>
      </div>
    );
  }

  // Latest completed inspection (or most recent)
  const latestInspection = vehicle.inspections[0];
  const completedInspection = vehicle.inspections.find((i) => i.status === "COMPLETED") || latestInspection;
  const inspection = completedInspection;

  // Extract key data from latest inspection
  const conditionScore = inspection?.overallScore ?? null;
  const conditionGrade = conditionScore ? getConditionGrade(conditionScore) : null;
  const market = inspection?.marketAnalysis as MarketAnalysisData | null;
  const history = inspection?.vehicleHistory as {
    titleStatus?: string; accidentCount?: number; ownerCount?: number;
    structuralDamage?: boolean; floodDamage?: boolean; openRecallCount?: number;
    rawData?: { titleRecords?: Array<{ date?: string; state?: string; odometer?: number; title?: string }>; odometerReadings?: Array<{ date?: string; odometer?: number; source?: string }> };
  } | null;
  const findings = inspection?.findings || [];
  const media = inspection?.media || [];
  const steps = inspection?.steps || [];

  // Hero photo — 3/4 driver front, fall back to front center
  const heroPhoto = media.find((m) => m.captureType === "FRONT_34_DRIVER")
    || media.find((m) => m.captureType === "FRONT_CENTER");

  // Recon cost = AI-computed (accounts for bundled labor, local rates)
  const confirmedFindings = findings.filter((f) => f.repairCostLow || f.repairCostHigh);
  const reconLow = confirmedFindings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
  const reconHigh = confirmedFindings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);
  // Recon breakdown from AI valuation log
  const reconLog = (inspection as { aiValuationLogs?: Array<{ output: unknown }> })?.aiValuationLogs?.[0];
  const reconBreakdown = reconLog?.output as {
    totalReconCost?: number;
    itemizedCosts?: Array<{ finding: string; estimatedCostCents: number; laborHours?: number; partsEstimate?: number; shopType: string; reasoning: string }>;
    laborRateContext?: string;
    totalReasoning?: string;
  } | null;

  // Single source of truth for recon: prefer breakdown total, fall back to market analysis, then findings
  const reconEstimate = reconBreakdown?.totalReconCost
    || market?.estReconCost
    || (reconLow > 0 ? Math.round((reconLow + reconHigh) / 2) : 0);

  // Max bid = recommended buy price from market analysis
  const maxBid = market?.fairBuyMax || market?.adjustedPrice || 0;

  // Fair market value
  const fairValue = market ? (market.adjustedPrice || 0) : 0;
  const estRetail = market?.estRetailPrice || 0;
  const netMargin = estRetail > 0 && maxBid > 0 ? estRetail - maxBid - reconEstimate : 0;

  // Odometer
  const odometer = inspection?.odometer;

  // Risk data from steps
  const riskStep = steps.find((s) => s.step === "RISK_INSPECTION") || steps.find((s) => s.step === "RISK_REVIEW");
  const riskData = riskStep?.data as {
    aggregatedRisks?: Array<{
      id: string; title: string; description: string; severity: string;
      cost: { low: number; high: number };
      costTiers?: Array<{ condition: string; label: string; costLow: number; costHigh: number }>;
      inspectionQuestions?: Array<{ id: string; question: string; failureAnswer: string }>;
      whatThisIs?: string;
      howToLocate?: string;
      howToInspect?: string;
      signsOfFailure?: string[];
      whyItMatters?: string;
    }>;
    checkStatuses?: Record<string, {
      status: string;
      mediaIds?: string[];
      questionAnswers?: Array<{ questionId: string; answer: string | null; mediaIds?: string[] }>;
    }>;
  } | null;

  // Compute avg days on market from comparables
  const comps = (market?.comparables ?? []) as Array<{ daysOnMarket?: number }>;
  const compsWithDom = comps.filter((c) => c.daysOnMarket && c.daysOnMarket > 0);
  const avgDaysOnMarket = compsWithDom.length > 0
    ? Math.round(compsWithDom.reduce((s, c) => s + (c.daysOnMarket || 0), 0) / compsWithDom.length)
    : null;

  // Tire assessment data (extracted once for reuse across tabs)
  const rawConditionData = inspection?.conditionRawData as { tireAssessment?: {
    frontDriver: { condition: string; observations: string[] };
    frontPassenger: { condition: string; observations: string[] };
    rearDriver: { condition: string; observations: string[] };
    rearPassenger: { condition: string; observations: string[] };
    overallTireScore: number;
    summary: string;
  } } | null;
  const tireAssessment = rawConditionData?.tireAssessment ?? null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "risks", label: "Risks", icon: <ShieldAlert className="h-4 w-4" /> },
    { key: "condition", label: "Condition", icon: <Activity className="h-4 w-4" /> },
    { key: "market", label: "Market", icon: <TrendingUp className="h-4 w-4" /> },
    { key: "history", label: "History", icon: <History className="h-4 w-4" /> },
    { key: "photos", label: "Photos", icon: <Camera className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ═══ DECISION HEADER ═══ */}
      <div>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/dashboard/vehicles" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Vehicles
          </Link>
          <div className="flex items-center gap-2">
            {inspection?.report && (
              <Link href={`/dashboard/reports/${inspection.report.id}`}>
                <Button variant="secondary" size="sm">
                  <FileText className="h-3.5 w-3.5 mr-1" /> View Report
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Vehicle identity + hero photo */}
        <div className="flex gap-4 mb-4">
          {heroPhoto?.url && (
            <div className="shrink-0 w-32 h-24 sm:w-40 sm:h-28 rounded-lg overflow-hidden bg-surface-sunken border border-border-default">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPhoto.url} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim || ""}
            </h1>
            <div className="flex items-center gap-3 text-sm text-text-secondary mt-1 flex-wrap">
              <span className="font-mono text-xs">{vehicle.vin}</span>
              {odometer && <span>{odometer.toLocaleString()} mi</span>}
              {vehicle.drivetrain && <span>{vehicle.drivetrain}</span>}
              {vehicle.engine && <span>{vehicle.engine.replace(/(\d+\.\d{1})\d+L/, "$1L")}</span>}
            </div>
          </div>
        </div>

        {/* Key Metrics — clean horizontal layout */}
        <div className="grid grid-cols-3 gap-4 mt-2">
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Condition</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-text-primary">
                {conditionGrade ? conditionGrade.replace("_", " ") : "—"}
              </span>
              {conditionScore != null && (
                <span className={cn(
                  "text-lg font-bold",
                  conditionScore >= 70 ? "text-green-600" :
                  conditionScore >= 60 ? "text-amber-600" : "text-red-600"
                )}>
                  {conditionScore}<span className="text-text-tertiary font-normal text-sm">/100</span>
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Recommended Buy Price</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {maxBid > 0 ? formatCurrency(maxBid) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Est. Recon</p>
            <p className={cn("text-2xl font-bold mt-1", reconEstimate > 0 ? "text-red-600" : "text-text-primary")}>
              {reconEstimate > 0 ? formatCurrency(reconEstimate) : "$0"}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-5">
          {latestInspection?.purchaseOutcome ? (
            <>
              <div className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border",
                latestInspection.purchaseOutcome === "PURCHASED"
                  ? "border-text-primary bg-text-primary text-white"
                  : "border-border-default text-text-secondary"
              )}>
                {latestInspection.purchaseOutcome === "PURCHASED"
                  ? <><Check className="h-3.5 w-3.5" /> Purchased{latestInspection.purchasePrice ? ` for ${formatCurrency(latestInspection.purchasePrice)}` : ""}</>
                  : <><X className="h-3.5 w-3.5" /> Passed</>
                }
              </div>
              <Link href="/dashboard/inspections/new">
                <Button variant="ghost" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-Inspect
                </Button>
              </Link>
            </>
          ) : latestInspection ? (
            <>
              <button
                onClick={() => setShowPriceInput(true)}
                disabled={showPriceInput}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border-strong text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                <ThumbsUp className="h-3.5 w-3.5" /> I Bought It
              </button>
              <button
                onClick={() => recordOutcome.mutate({ inspectionId: latestInspection.id, outcome: "PASSED" })}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border-strong text-text-primary hover:bg-surface-hover transition-colors"
              >
                <ThumbsDown className="h-3.5 w-3.5" /> I Passed
              </button>
              <Link href="/dashboard/inspections/new">
                <Button variant="ghost" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-Inspect
                </Button>
              </Link>
            </>
          ) : (
            <Link href="/dashboard/inspections/new">
              <Button variant="ghost" size="sm">
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> New Inspection
              </Button>
            </Link>
          )}
        </div>

        {/* Purchase price input */}
        {showPriceInput && latestInspection && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-lg border border-border-default bg-surface-raised">
            <span className="text-sm text-text-secondary">$</span>
            <input
              type="number"
              placeholder="Purchase price"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="flex-1 text-sm bg-white border border-border-default rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-text-primary"
              autoFocus
            />
            <button
              onClick={() => recordOutcome.mutate({
                inspectionId: latestInspection.id,
                outcome: "PURCHASED",
                purchasePrice: purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : undefined,
              })}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-text-primary text-white hover:opacity-90"
            >
              Confirm
            </button>
            <button
              onClick={() => { setShowPriceInput(false); setPurchasePrice(""); }}
              className="px-3 py-1.5 rounded-md text-sm text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ═══ DEAL STRIP ═══ */}
      {market && (
        <div className="rounded-lg bg-surface-sunken px-2 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {[
              { label: "Est. Retail", value: estRetail, color: "text-text-primary" },
              { label: "Est. Recon", value: reconEstimate, color: "text-red-600" },
              { label: "Net Margin", value: netMargin, color: netMargin > 0 ? "text-green-700" : "text-red-600" },
              { label: "Avg. Time on Lot", value: avgDaysOnMarket, color: "text-text-primary", suffix: " days", raw: true },
            ].map(({ label, value, color, suffix, raw }) => (
              <div key={label} className="px-3 py-2.5 text-center">
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">{label}</p>
                <p className={cn("text-sm font-semibold mt-0.5", color)}>
                  {value ? `${raw ? value : formatCurrency(typeof value === "number" ? value : 0)}${suffix || ""}` : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 border-b border-border-default overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.key
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB CONTENT ═══ */}

      {/* Condition Tab */}
      {activeTab === "condition" && (
        <div className="space-y-5">
          {/* Overall + 4-area breakdown */}
          {conditionScore != null && (
            <div>
              <h3 className="text-base font-semibold text-text-primary tracking-tight mb-4">Condition Assessment</h3>
              <div className="space-y-4">
                {[
                  { label: "Exterior Body", key: "exteriorBody", score: inspection?.exteriorBodyScore, weight: "30%" },
                  { label: "Interior", key: "interior", score: inspection?.interiorScore, weight: "15%" },
                  { label: "Mechanical / Visual", key: "mechanicalVisual", score: inspection?.mechanicalVisualScore, weight: "35%" },
                  { label: "Underbody / Frame", key: "underbodyFrame", score: inspection?.underbodyFrameScore, weight: "20%" },
                ].map(({ label, key, score, weight }) => {
                  const areaDetail = rawConditionData?.[key as keyof typeof rawConditionData] as {
                    summary?: string; keyObservations?: string[]; concerns?: string[]; scoreJustification?: string;
                  } | undefined;
                  const dotColor = (score || 0) >= 7 ? "bg-green-500" : (score || 0) >= 6 ? "bg-yellow-400" : "bg-red-500";
                  return (
                    <div key={label} className="pb-4 border-b border-border-default last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColor)} />
                          <span className="text-sm font-medium text-text-primary">{label}</span>
                        </div>
                        <span className="text-sm font-bold text-text-primary">{score ?? "—"}/10</span>
                      </div>
                      {areaDetail?.summary && (
                        <p className="text-sm text-text-secondary mt-1 leading-relaxed ml-[18px]">{areaDetail.summary}</p>
                      )}
                      {areaDetail?.concerns && areaDetail.concerns.length > 0 && (
                        <div className="mt-1 ml-[18px]">
                          {areaDetail.concerns.map((c, i) => (
                            <p key={i} className="text-sm text-red-600 leading-relaxed">• {c}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tire Condition — inline in condition tab */}
          {tireAssessment && (() => {
            const tireEntries = [
              { label: "Front Left", key: "TIRE_FRONT_DRIVER", data: tireAssessment.frontDriver },
              { label: "Front Right", key: "TIRE_FRONT_PASSENGER", data: tireAssessment.frontPassenger },
              { label: "Rear Left", key: "TIRE_REAR_DRIVER", data: tireAssessment.rearDriver },
              { label: "Rear Right", key: "TIRE_REAR_PASSENGER", data: tireAssessment.rearPassenger },
            ];
            const dotColor = (c: string) => c === "GOOD" ? "bg-green-500" : c === "WORN" ? "bg-yellow-400" : "bg-red-500";
            const condLabel = (c: string) => c === "GOOD" ? "Good" : c === "WORN" ? "Worn" : "Replace";

            return (
              <div>
                <h3 className="text-base font-semibold text-text-primary tracking-tight mb-4">Tire Condition</h3>
                <div className="grid grid-cols-2 gap-3">
                  {tireEntries.map(({ label, key, data }) => {
                    const tirePhoto = media.find((m) => m.captureType === key);
                    return (
                      <div key={label} className="flex gap-3 p-3 rounded-lg border border-border-default bg-surface-raised">
                        {tirePhoto?.url && (
                          <div className="shrink-0 w-14 h-14 rounded overflow-hidden bg-surface-sunken">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tirePhoto.url} alt={label} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className={cn("w-2 h-2 rounded-full shrink-0", dotColor(data.condition))} />
                            <span className="text-xs font-medium text-text-primary">{label}</span>
                          </div>
                          <p className="text-xs font-semibold text-text-primary">{condLabel(data.condition)}</p>
                          {data.observations.length > 0 && (
                            <p className="text-xs text-text-tertiary leading-snug mt-0.5">
                              {data.observations.slice(0, 2).join(". ")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {tireAssessment.summary && (
                  <p className="text-sm text-text-secondary mt-3">{tireAssessment.summary}</p>
                )}
              </div>
            );
          })()}

          {/* Identified issues */}
          {findings.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-text-primary tracking-tight mb-4">
                Identified Issues ({findings.length})
              </h3>
              <div className="space-y-2">
                {findings.map((f) => {
                  // Cross-reference with risk data to get tier label (repair action)
                  const matchingRisk = riskData?.aggregatedRisks?.find((r) => r.title === f.title);
                  const check = matchingRisk ? riskData?.checkStatuses?.[matchingRisk.id] : null;

                  // Determine which tier applies based on question answers
                  let tierLabel: string | null = null;
                  let tierCost: number | null = null;
                  if (matchingRisk?.costTiers && matchingRisk.costTiers.length === 3 && check?.questionAnswers) {
                    const failureCount = check.questionAnswers.filter((qa) => {
                      const q = matchingRisk.inspectionQuestions?.find((iq) => iq.id === qa.questionId);
                      return q && qa.answer === q.failureAnswer;
                    }).length;
                    const tierIndex = Math.min(Math.max(failureCount - 1, 0), 2);
                    const tier = matchingRisk.costTiers[tierIndex];
                    if (tier) {
                      tierLabel = tier.label;
                      tierCost = Math.round((tier.costLow + tier.costHigh) / 2);
                    }
                  }

                  // Fall back to finding cost midpoint if no tier data
                  const repairCost = tierCost || (f.repairCostLow && f.repairCostHigh
                    ? Math.round((f.repairCostLow + f.repairCostHigh) / 2)
                    : f.repairCostLow || f.repairCostHigh || null);

                  return (
                    <div
                      key={f.id}
                      className="p-3 rounded-lg border border-border-default bg-surface-raised border-l-4 border-l-red-500"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">{f.title}</span>
                        <Badge variant={f.severity === "CRITICAL" ? "danger" : f.severity === "MAJOR" ? "warning" : "default"} className="text-[10px] shrink-0">
                          {f.severity}
                        </Badge>
                      </div>
                      {/* Repair action — what needs to be done */}
                      {tierLabel && (
                        <p className="text-xs font-medium text-red-700 mt-1">
                          Repair: {tierLabel}
                        </p>
                      )}
                      {f.description && (
                        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{f.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Recon breakdown — AI-computed with justification */}
              {reconEstimate > 0 && (
                <div className="pt-3 mt-3 border-t border-border-default space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">Total Est. Reconditioning</span>
                    <span className="text-sm font-bold text-red-600">{formatCurrency(reconEstimate)}</span>
                  </div>

                  {/* Itemized cost justification */}
                  {reconBreakdown?.itemizedCosts && reconBreakdown.itemizedCosts.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {reconBreakdown.itemizedCosts.map((item, i) => (
                        <div key={i} className="flex items-start justify-between text-xs px-2 py-1.5 rounded bg-surface-sunken">
                          <div className="flex-1 min-w-0 mr-3">
                            <span className="font-medium text-text-primary">{item.finding}</span>
                            {item.reasoning && (
                              <p className="text-text-tertiary mt-0.5">{item.reasoning}</p>
                            )}
                            {(item.laborHours || item.partsEstimate) && (
                              <p className="text-text-tertiary mt-0.5">
                                {item.laborHours ? `${item.laborHours}h labor` : ""}
                                {item.laborHours && item.partsEstimate ? " + " : ""}
                                {item.partsEstimate ? `${formatCurrency(item.partsEstimate)} parts` : ""}
                              </p>
                            )}
                          </div>
                          <span className="font-medium text-red-600 shrink-0">{formatCurrency(item.estimatedCostCents)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Labor rate context */}
                  {reconBreakdown?.laborRateContext && (
                    <p className="text-[10px] text-text-tertiary mt-1">{reconBreakdown.laborRateContext}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!conditionScore && findings.length === 0 && (
            <div className="py-12 text-center">
              <Activity className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No condition data yet. Complete an inspection to see results.</p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-5">
          {history ? (
            <>
              {/* Status flags */}
              <div>
                <h3 className="text-base font-semibold text-text-primary tracking-tight mb-4">Vehicle History</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Title Status", value: history.titleStatus || "Unknown", bad: history.titleStatus !== "CLEAN" },
                    { label: "Accidents", value: String(history.accidentCount ?? "Unknown"), bad: (history.accidentCount || 0) > 0 },
                    { label: "Owners", value: String(history.ownerCount ?? "Unknown"), bad: (history.ownerCount || 0) > 3 },
                    { label: "Structural Damage", value: history.structuralDamage ? "YES" : "No", bad: !!history.structuralDamage },
                    { label: "Flood Damage", value: history.floodDamage ? "YES" : "No", bad: !!history.floodDamage },
                  ].map(({ label, value, bad }) => (
                    <div key={label} className="p-3 rounded-lg border border-border-default bg-surface-raised text-center">
                      <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">{label}</p>
                      <p className={cn("text-sm font-bold mt-0.5", bad ? "text-red-600" : "text-text-primary")}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Odometer timeline */}
              {history.rawData?.odometerReadings && history.rawData.odometerReadings.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-text-primary tracking-tight mb-3">Odometer History</h3>
                  <div className="space-y-1.5">
                    {history.rawData.odometerReadings.slice(0, 10).map((reading, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border-default last:border-0">
                        <span className="text-text-secondary">{reading.date || "—"}</span>
                        <span className="font-medium text-text-primary">{reading.odometer?.toLocaleString()} mi</span>
                        <span className="text-text-tertiary">{reading.source || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <History className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No history data yet. Complete an inspection to fetch vehicle history.</p>
            </Card>
          )}
        </div>
      )}

      {/* Market Tab */}
      {activeTab === "market" && (
        <div>
          {market ? (
            <MarketAnalysisSection data={market} compact />
          ) : (
            <Card className="p-8 text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No market data yet. Complete an inspection to run market analysis.</p>
            </Card>
          )}
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === "photos" && (
        <div>
          {media.length > 0 ? (
            <PhotoGallery media={media} findings={findings} />
          ) : (
            <Card className="p-8 text-center">
              <Camera className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No photos yet. Complete an inspection to capture vehicle photos.</p>
            </Card>
          )}
        </div>
      )}

      {/* Risks Tab */}
      {activeTab === "risks" && (
        <div className="space-y-5">
          {riskData?.aggregatedRisks && riskData.aggregatedRisks.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-text-primary tracking-tight">
                Known Risk Areas ({riskData.aggregatedRisks.length})
              </h3>
              {riskData.aggregatedRisks.map((risk) => {
                const check = riskData.checkStatuses?.[risk.id];
                const status = check?.status || "NOT_CHECKED";

                const statusStyle = status === "CONFIRMED"
                  ? { border: "border-border-default border-l-4 border-l-red-500", text: "text-red-600", label: "Identified" }
                  : status === "NOT_FOUND"
                  ? { border: "border-border-default", text: "text-green-600", label: "Clear" }
                  : status === "UNABLE_TO_INSPECT"
                  ? { border: "border-border-default", text: "text-text-tertiary", label: "Skipped" }
                  : { border: "border-border-default", text: "text-text-tertiary", label: "Not Checked" };

                // Get evidence photos for this risk
                const evidenceMediaIds = check?.mediaIds || [];
                const questionMediaIds = check?.questionAnswers?.flatMap((qa) => qa.mediaIds || []) || [];
                const allEvidenceIds = [...evidenceMediaIds, ...questionMediaIds];
                const evidencePhotos = allEvidenceIds.length > 0
                  ? media.filter((m) => allEvidenceIds.includes(m.id))
                  : [];

                return (
                  <div key={risk.id} className={cn("p-4 rounded-lg border bg-surface-raised", statusStyle.border)}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{risk.title}</span>
                        <Badge variant={
                          risk.severity === "CRITICAL" ? "danger" :
                          risk.severity === "MAJOR" ? "warning" : "default"
                        } className="text-[9px]">
                          {risk.severity}
                        </Badge>
                      </div>
                      <span className={cn("text-xs font-bold", statusStyle.text)}>{statusStyle.label}</span>
                    </div>

                    {/* Description */}
                    {risk.description && (
                      <p className="text-xs text-text-secondary leading-relaxed mb-2">{risk.description}</p>
                    )}

                    {/* How it was checked — questions + answers */}
                    {risk.inspectionQuestions && risk.inspectionQuestions.length > 0 && check?.questionAnswers && (
                      <div className="mb-2 space-y-1">
                        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Inspection Checks</p>
                        {risk.inspectionQuestions.map((q) => {
                          const qa = check.questionAnswers?.find((a) => a.questionId === q.id);
                          const answered = qa?.answer != null;
                          const isFailing = answered && qa?.answer === q.failureAnswer;
                          return (
                            <div key={q.id} className="flex items-start gap-2 text-xs">
                              <span className={cn(
                                "shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                                !answered ? "bg-gray-100 text-gray-400" :
                                isFailing ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                              )}>
                                {!answered ? "?" : isFailing ? "!" : "✓"}
                              </span>
                              <div className="flex-1">
                                <span className="text-text-secondary">{q.question}</span>
                                {answered && (
                                  <span className={cn(
                                    "ml-1.5 font-semibold",
                                    isFailing ? "text-red-600" : "text-green-600"
                                  )}>
                                    {qa?.answer === "yes" ? "Yes" : "No"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Evidence photos */}
                    {evidencePhotos.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {evidencePhotos.map((p) => (
                          <div key={p.id} className="w-16 h-16 rounded-lg overflow-hidden bg-surface-sunken border border-border-default">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url || ""} alt="Evidence" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Why it matters */}
                    {risk.whyItMatters && status === "CONFIRMED" && (
                      <p className="text-sm text-red-600 mt-2">{risk.whyItMatters}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <ShieldAlert className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No risk profile yet. Complete an inspection to generate risk analysis.</p>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}
