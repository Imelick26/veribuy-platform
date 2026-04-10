"use client";

import { use, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Overline } from "@/components/ui/Overline";
import { StatusDot } from "@/components/ui/StatusDot";
import { ConditionBar } from "@/components/ui/ConditionBar";
import { MarketAnalysisSection, getConditionMarginPct, getConditionTierLabel } from "@/components/report/MarketAnalysisSection";
import type { MarketAnalysisData, MarketAnalysisSectionProps } from "@/components/report/MarketAnalysisSection";
import { PhotoGallery } from "@/components/report/PhotoGallery";
import { getConditionGrade } from "@/lib/market-valuation";
import { formatCurrency, formatDate, cn, getDealRatingBadge } from "@/lib/utils";
import {
  ArrowLeft, FileText, RefreshCw, ThumbsUp, ThumbsDown, DollarSign, Check, X,
  Activity, History, TrendingUp, Camera, ShieldAlert, ChevronDown, ChevronUp,
  Car, Plus, Trash2, Settings2,
} from "lucide-react";

type Tab = "condition" | "risks" | "history" | "market" | "photos" | "report";

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: vehicle, isLoading } = trpc.vehicle.getDetail.useQuery({ id });
  const { data: orgSettings } = trpc.auth.getOrgSettings.useQuery();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<Tab>("condition");
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [marginMode, setMarginMode] = useState<"pct" | "flat">("pct");
  const [marginOverride, setMarginOverride] = useState<number | null>(null);
  const [flatMarginOverride, setFlatMarginOverride] = useState<string>("");
  const [showDealAdjust, setShowDealAdjust] = useState(false);

  const recordOutcome = trpc.inspection.recordOutcome.useMutation({
    onSuccess: () => {
      utils.vehicle.getDetail.invalidate({ id });
      setShowPriceInput(false);
      setPurchasePrice("");
    },
  });

  const generateReport = trpc.report.generate.useMutation({
    onSuccess: () => utils.vehicle.getDetail.invalidate({ id }),
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

  const latestInspection = vehicle.inspections[0];
  const completedInspection = vehicle.inspections.find((i) => i.status === "COMPLETED") || latestInspection;
  const inspection = completedInspection;

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

  // Recon
  const confirmedFindings = findings.filter((f) => f.repairCostLow || f.repairCostHigh);
  const reconLow = confirmedFindings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
  const reconHigh = confirmedFindings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);
  const reconLog = (inspection as { aiValuationLogs?: Array<{ output: unknown }> })?.aiValuationLogs?.[0];
  const reconBreakdown = reconLog?.output as {
    totalReconCost?: number;
    itemizedCosts?: Array<{ finding: string; estimatedCostCents: number; laborHours?: number; partsEstimate?: number; shopType: string; reasoning: string }>;
    laborRateContext?: string;
    totalReasoning?: string;
  } | null;

  const reconEstimate = reconBreakdown?.totalReconCost
    || market?.estReconCost
    || (reconLow > 0 ? Math.round((reconLow + reconHigh) / 2) : 0);

  // Pricing
  const estRetail = market?.estRetailPrice || market?.baselinePrice || 0;
  const condMult = market?.conditionMultiplier ?? 1;
  const histMult = market?.historyMultiplier ?? 1;
  const basePct = orgSettings?.targetMarginPercent ?? 20;
  const condScore = inspection?.overallScore ?? null;
  const aiMarginPct = getConditionMarginPct(basePct, condScore);
  const tierLabel = getConditionTierLabel(condScore);
  const minProfit = orgSettings?.minProfitPerUnit ?? 150000;

  const flatParsed = flatMarginOverride !== "" ? Math.round(parseFloat(flatMarginOverride) * 100) : null;
  const effectiveMarginPct = marginMode === "pct" ? (marginOverride ?? aiMarginPct) : aiMarginPct;
  const dealerMarginAmount = marginMode === "flat" && flatParsed != null
    ? Math.max(flatParsed, minProfit)
    : Math.max(Math.round(estRetail * (effectiveMarginPct / 100)), minProfit);
  const maxBid = Math.max(0, Math.round((estRetail - dealerMarginAmount - reconEstimate) / 100) * 100);
  const netMargin = estRetail > 0 && maxBid > 0 ? estRetail - maxBid - reconEstimate : 0;

  const odometer = inspection?.odometer;

  // Risk data
  const riskStep = steps.find((s) => s.step === "RISK_INSPECTION") || steps.find((s) => s.step === "RISK_REVIEW");
  const riskData = riskStep?.data as {
    aggregatedRisks?: Array<{
      id: string; title: string; description: string; severity: string;
      cost: { low: number; high: number };
      costTiers?: Array<{ condition: string; label: string; costLow: number; costHigh: number }>;
      inspectionQuestions?: Array<{ id: string; question: string; failureAnswer: string }>;
      whatThisIs?: string; howToLocate?: string; howToInspect?: string;
      signsOfFailure?: string[]; whyItMatters?: string;
    }>;
    checkStatuses?: Record<string, {
      status: string;
      mediaIds?: string[];
      questionAnswers?: Array<{ questionId: string; answer: string | null; mediaIds?: string[] }>;
    }>;
  } | null;

  // Comparables
  const comps = (market?.comparables ?? []) as Array<{ daysOnMarket?: number }>;
  const compsWithDom = comps.filter((c) => c.daysOnMarket && c.daysOnMarket > 0);
  const avgDaysOnMarket = compsWithDom.length > 0
    ? Math.round(compsWithDom.reduce((s, c) => s + (c.daysOnMarket || 0), 0) / compsWithDom.length)
    : null;

  // Tire assessment
  const rawConditionData = inspection?.conditionRawData as { tireAssessment?: {
    frontDriver: { condition: string; observations: string[] };
    frontPassenger: { condition: string; observations: string[] };
    rearDriver: { condition: string; observations: string[] };
    rearPassenger: { condition: string; observations: string[] };
    overallTireScore: number;
    summary: string;
  } } | null;
  const tireAssessment = rawConditionData?.tireAssessment ?? null;

  // Hero photo — passenger front 3/4, fall back to driver 3/4, then front center
  const heroPhoto = media.find((m) => m.captureType === "FRONT_34_PASSENGER")
    || media.find((m) => m.captureType === "FRONT_34_DRIVER")
    || media.find((m) => m.captureType === "FRONT_CENTER");

  // Deal rating
  const dealRating = getDealRatingBadge(market?.recommendation as string | undefined);

  // Negotiation
  const roundTo50 = (v: number) => Math.round(v / 5000) * 5000;
  const openAt = roundTo50(Math.round(maxBid * 0.80));
  const walkAway = roundTo50(Math.round(maxBid * 1.12));

  // Source count
  const sourceCount = (market as { sourceCount?: number } | null)?.sourceCount ?? 0;

  // Confirmed risks count
  const confirmedRiskCount = riskData?.aggregatedRisks?.filter((r) => riskData.checkStatuses?.[r.id]?.status === "CONFIRMED").length ?? 0;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "condition", label: "Condition", icon: <Activity className="h-4 w-4" /> },
    { key: "risks", label: "Risks", icon: <ShieldAlert className="h-4 w-4" /> },
    { key: "history", label: "History", icon: <History className="h-4 w-4" /> },
    { key: "market", label: "Market", icon: <TrendingUp className="h-4 w-4" /> },
    { key: "photos", label: "Photos", icon: <Camera className="h-4 w-4" /> },
    { key: "report", label: "Report", icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ═══ HEADER ═══ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link href="/dashboard/vehicles" className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Vehicles
          </Link>
          <div className="flex items-center gap-2">
            {inspection?.report && (
              <Link href={`/dashboard/reports/${inspection.report.id}`}>
                <Button variant="secondary" size="sm">
                  <FileText className="h-3.5 w-3.5" /> View Report
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          {heroPhoto?.url && (
            <div className="shrink-0 w-28 h-20 sm:w-36 sm:h-24 rounded-lg overflow-hidden bg-surface-sunken border border-border-default">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPhoto.url} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] font-bold text-text-primary tracking-tight">
              {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim || ""}
            </h1>
            <div className="flex items-center gap-2 text-sm text-text-secondary mt-1 flex-wrap">
              {vehicle.engine && <span>{vehicle.engine.replace(/(\d+\.\d{1})\d+L/, "$1L")}</span>}
              {vehicle.engine && vehicle.drivetrain && <span className="text-text-tertiary">·</span>}
              {vehicle.drivetrain && <span>{vehicle.drivetrain}</span>}
              {odometer && <><span className="text-text-tertiary">·</span><span>{odometer.toLocaleString()} mi</span></>}
            </div>
            <p className="font-mono text-xs text-text-tertiary mt-1">{vehicle.vin}</p>
          </div>
        </div>
      </div>

      {/* ═══ THE DEAL — Hero Card ═══ */}
      {market && estRetail > 0 ? (
        <Card hero>
          {/* Condition score */}
          <div className="flex items-center justify-between mb-6">
            <div />
            {conditionScore != null && (
              <div className="flex items-center gap-2">
                <Overline>Condition</Overline>
                <span className="text-lg font-bold text-text-primary">{conditionScore}<span className="text-text-tertiary font-normal text-sm">/100</span></span>
                {conditionGrade && (
                  <span className="text-xs text-text-secondary">({conditionGrade.replace("_", " ")})</span>
                )}
              </div>
            )}
          </div>

          {/* Financial hero — 3 column */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div>
              <Overline>Buy At</Overline>
              <p className="text-[36px] font-bold tracking-tight text-money-neutral leading-none mt-1">
                {formatCurrency(maxBid)}
              </p>
            </div>
            <div>
              <Overline>Est. Retail</Overline>
              <p className="text-[18px] font-bold text-text-primary mt-1">
                {formatCurrency(estRetail)}
              </p>
            </div>
            <div>
              <Overline>Est. Margin</Overline>
              <p className={cn(
                "text-[18px] font-bold mt-1",
                netMargin > 0 ? "text-money-positive" : "text-money-negative"
              )}>
                {formatCurrency(Math.abs(netMargin))}
                {netMargin < 0 && <span className="text-xs font-normal ml-1">loss</span>}
              </p>
            </div>
          </div>

          {/* Negotiation band */}
          {maxBid > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="py-2.5 px-3 rounded-lg bg-money-bg-positive text-center">
                <p className="text-[10px] font-semibold text-money-positive uppercase tracking-wider">Open At</p>
                <p className="text-base font-bold text-money-positive mt-0.5">{formatCurrency(openAt)}</p>
              </div>
              <div className="py-2.5 px-3 rounded-lg bg-surface-raised border-2 border-text-primary text-center">
                <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Target</p>
                <p className="text-base font-bold text-text-primary mt-0.5">{formatCurrency(maxBid)}</p>
              </div>
              <div className="py-2.5 px-3 rounded-lg bg-money-bg-negative text-center">
                <p className="text-[10px] font-semibold text-money-negative uppercase tracking-wider">Walk Away</p>
                <p className="text-base font-bold text-money-negative mt-0.5">{formatCurrency(walkAway)}</p>
              </div>
            </div>
          )}

          {/* Quick stats line */}
          <div className="flex items-center gap-4 text-xs text-text-secondary flex-wrap">
            {reconEstimate > 0 && (
              <span>Recon: <span className="font-semibold text-money-negative">{formatCurrency(reconEstimate)}</span></span>
            )}
            {confirmedRiskCount > 0 && (
              <span>{confirmedRiskCount} risk{confirmedRiskCount !== 1 ? "s" : ""} confirmed</span>
            )}
            {avgDaysOnMarket != null && (
              <span>Avg. {avgDaysOnMarket}d on lot</span>
            )}
            {sourceCount > 0 && (
              <span>{sourceCount} data source{sourceCount !== 1 ? "s" : ""}</span>
            )}
          </div>

          {/* Collapsible margin adjuster */}
          <div className="mt-4 pt-4 border-t border-border-default">
            <button
              onClick={() => setShowDealAdjust(!showDealAdjust)}
              className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Adjust Margin
              {showDealAdjust ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showDealAdjust && (
              <div className="mt-3 p-3 rounded-lg bg-surface-overlay border border-border-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-primary">Dealer Margin</span>
                  <div className="flex items-center gap-0.5 bg-surface-sunken rounded-md p-0.5">
                    <button
                      onClick={() => setMarginMode("pct")}
                      className={cn("px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                        marginMode === "pct" ? "bg-white text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary"
                      )}
                    >%</button>
                    <button
                      onClick={() => setMarginMode("flat")}
                      className={cn("px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                        marginMode === "flat" ? "bg-white text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary"
                      )}
                    >$</button>
                  </div>
                </div>
                {marginMode === "pct" ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setMarginOverride(Math.max(5, effectiveMarginPct - 1))}
                        className="w-7 h-7 rounded-md text-sm font-bold text-text-secondary bg-surface-sunken hover:bg-surface-hover transition-colors"
                      >-</button>
                      <span className="text-lg font-bold text-text-primary w-12 text-center">{effectiveMarginPct}%</span>
                      <button
                        onClick={() => setMarginOverride(Math.min(50, effectiveMarginPct + 1))}
                        className="w-7 h-7 rounded-md text-sm font-bold text-text-secondary bg-surface-sunken hover:bg-surface-hover transition-colors"
                      >+</button>
                    </div>
                    <span className="text-[10px] text-text-tertiary ml-1">
                      {marginOverride != null ? (
                        <button onClick={() => setMarginOverride(null)} className="text-brand-600 hover:underline">
                          Reset to {aiMarginPct}% ({tierLabel})
                        </button>
                      ) : (
                        <>AI recommended ({tierLabel} condition)</>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">$</span>
                    <input
                      type="number"
                      value={flatMarginOverride !== "" ? flatMarginOverride : (dealerMarginAmount / 100).toString()}
                      onChange={(e) => setFlatMarginOverride(e.target.value)}
                      className="w-24 text-lg font-bold bg-white border border-border-default rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
                      min={0}
                      step={100}
                    />
                    <span className="text-[10px] text-text-tertiary">
                      {flatMarginOverride !== "" ? (
                        <button onClick={() => { setFlatMarginOverride(""); setMarginMode("pct"); }} className="text-brand-600 hover:underline">
                          Reset to {aiMarginPct}% ({tierLabel})
                        </button>
                      ) : (
                        <>Min floor: ${(minProfit / 100).toLocaleString()}</>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-default text-xs">
                  <span className="text-text-tertiary">Margin: {formatCurrency(dealerMarginAmount)}</span>
                  <span className="text-text-tertiary">Buy Price: <span className="font-semibold text-text-primary">{formatCurrency(maxBid)}</span></span>
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="text-center py-8">
          <DollarSign className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No market data yet. Complete an inspection to see the deal.</p>
        </Card>
      )}

      {/* ═══ ACTION BUTTONS ═══ */}
      <div className="flex items-center gap-2">
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
                <RefreshCw className="h-3.5 w-3.5" /> Re-Inspect
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
                <RefreshCw className="h-3.5 w-3.5" /> Re-Inspect
              </Button>
            </Link>
          </>
        ) : (
          <Link href="/dashboard/inspections/new">
            <Button variant="ghost" size="sm">
              <RefreshCw className="h-3.5 w-3.5" /> New Inspection
            </Button>
          </Link>
        )}
      </div>

      {/* Purchase price input */}
      {showPriceInput && latestInspection && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border-default bg-surface-raised">
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
        <div className="space-y-6">
          {/* 4-area breakdown */}
          {conditionScore != null && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <Overline>Condition Assessment</Overline>
                <span className="text-sm font-bold text-text-primary">{conditionScore}/100 overall</span>
              </div>
              {(() => {
                const weights = inspection?.conditionWeights as Record<string, number> | null;
                const scoreGroups = [
                  { group: "Exterior", items: [
                    { label: "Paint & Body", key: "paintBody", score: inspection?.paintBodyScore },
                    { label: "Panel Alignment", key: "panelAlignment", score: inspection?.panelAlignmentScore },
                    { label: "Glass & Lighting", key: "glassLighting", score: inspection?.glassLightingScore },
                  ]},
                  { group: "Interior", items: [
                    { label: "Surfaces", key: "interiorSurfaces", score: inspection?.interiorSurfacesScore },
                    { label: "Controls", key: "interiorControls", score: inspection?.interiorControlsScore },
                  ]},
                  { group: "Mechanical", items: [
                    { label: "Engine Bay", key: "engineBay", score: inspection?.engineBayScore },
                    { label: "Tires & Wheels", key: "tiresWheels", score: inspection?.tiresWheelsScore },
                    { label: "Exhaust", key: "exhaust", score: inspection?.exhaustScore },
                  ]},
                  { group: "Structural", items: [
                    { label: "Underbody & Frame", key: "underbodyFrame", score: inspection?.underbodyFrameScore },
                  ]},
                ];
                return (
                  <div className="space-y-5">
                    {scoreGroups.map(({ group, items }) => (
                      <div key={group}>
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{group}</p>
                        <div className="space-y-3">
                          {items.map(({ label, key, score }) => {
                            const w = weights?.[key];
                            const weightLabel = w ? `${w}%` : "";
                            const areaDetail = rawConditionData?.[key as keyof typeof rawConditionData] as {
                              summary?: string; concerns?: string[];
                            } | undefined;
                            const subtitle = [
                              areaDetail?.summary,
                              ...(areaDetail?.concerns?.map((c) => `⚠ ${c}`) || []),
                            ].filter(Boolean).join(" — ");
                            return (
                              <ConditionBar
                                key={label}
                                label={weightLabel ? `${label} (${weightLabel})` : label}
                                score={score as number | null}
                                subtitle={subtitle || undefined}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tire Condition */}
          {tireAssessment && (() => {
            const tireEntries = [
              { label: "Front Left", key: "TIRE_FRONT_DRIVER", data: tireAssessment.frontDriver },
              { label: "Front Right", key: "TIRE_FRONT_PASSENGER", data: tireAssessment.frontPassenger },
              { label: "Rear Left", key: "TIRE_REAR_DRIVER", data: tireAssessment.rearDriver },
              { label: "Rear Right", key: "TIRE_REAR_PASSENGER", data: tireAssessment.rearPassenger },
            ];
            const dotColor = (c: string): "green" | "yellow" | "red" => c === "GOOD" ? "green" : c === "WORN" ? "yellow" : "red";
            const condLabel = (c: string) => c === "GOOD" ? "Good" : c === "WORN" ? "Worn" : "Replace";

            return (
              <div>
                <Overline className="block mb-4">Tire Condition</Overline>
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
                            <StatusDot color={dotColor(data.condition)} />
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

          {/* Identified Issues */}
          {findings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <Overline>Identified Issues ({findings.length})</Overline>
                {reconEstimate > 0 && (
                  <span className="text-sm font-bold text-money-negative">{formatCurrency(reconEstimate)} recon</span>
                )}
              </div>
              <div className="space-y-2">
                {findings.map((f) => {
                  const matchingRisk = riskData?.aggregatedRisks?.find((r) => r.title === f.title);
                  const check = matchingRisk ? riskData?.checkStatuses?.[matchingRisk.id] : null;

                  let tierLabel: string | null = null;
                  if (matchingRisk?.costTiers && matchingRisk.costTiers.length === 3 && check?.questionAnswers) {
                    const failureCount = check.questionAnswers.filter((qa) => {
                      const q = matchingRisk.inspectionQuestions?.find((iq) => iq.id === qa.questionId);
                      return q && qa.answer === q.failureAnswer;
                    }).length;
                    const tierIndex = Math.min(Math.max(failureCount - 1, 0), 2);
                    const tier = matchingRisk.costTiers[tierIndex];
                    if (tier) tierLabel = tier.label;
                  }

                  const repairCost = f.repairCostLow && f.repairCostHigh
                    ? `${formatCurrency(f.repairCostLow)} – ${formatCurrency(f.repairCostHigh)}`
                    : f.repairCostLow ? formatCurrency(f.repairCostLow)
                    : f.repairCostHigh ? formatCurrency(f.repairCostHigh)
                    : null;

                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border-default bg-surface-raised border-l-4 border-l-red-500"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusDot color={f.severity === "CRITICAL" || f.severity === "MAJOR" ? "red" : "yellow"} className="w-2.5 h-2.5" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-text-primary">{f.title}</span>
                          {tierLabel && (
                            <span className="text-xs text-money-negative ml-2">· {tierLabel}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {repairCost && (
                          <span className="text-xs font-semibold text-money-negative">{repairCost}</span>
                        )}
                        <Badge variant={f.severity === "CRITICAL" ? "danger" : f.severity === "MAJOR" ? "warning" : "default"} className="text-[10px]">
                          {f.severity}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recon breakdown */}
              {reconEstimate > 0 && reconBreakdown?.itemizedCosts && reconBreakdown.itemizedCosts.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border-default space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-text-primary">Total Est. Reconditioning</span>
                    <span className="text-sm font-bold text-money-negative">{formatCurrency(reconEstimate)}</span>
                  </div>
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
                        <span className="font-medium text-money-negative shrink-0">{formatCurrency(item.estimatedCostCents)}</span>
                      </div>
                    ))}
                  </div>
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

      {/* Risks Tab */}
      {activeTab === "risks" && (
        <div className="space-y-5">
          {riskData?.aggregatedRisks && riskData.aggregatedRisks.length > 0 ? (
            <div className="space-y-3">
              <Overline>
                Known Risk Areas ({riskData.aggregatedRisks.length})
              </Overline>
              {riskData.aggregatedRisks.map((risk) => {
                const check = riskData.checkStatuses?.[risk.id];
                const status = check?.status || "NOT_CHECKED";

                const statusStyle = status === "CONFIRMED"
                  ? { border: "border-border-default border-l-4 border-l-red-500", text: "text-red-600", label: "Identified", dot: "red" as const }
                  : status === "NOT_FOUND"
                  ? { border: "border-border-default", text: "text-green-600", label: "Clear", dot: "green" as const }
                  : status === "UNABLE_TO_INSPECT"
                  ? { border: "border-border-default", text: "text-text-tertiary", label: "Skipped", dot: "yellow" as const }
                  : { border: "border-border-default", text: "text-text-tertiary", label: "Not Checked", dot: "gray" as const };

                const evidenceMediaIds = check?.mediaIds || [];
                const questionMediaIds = check?.questionAnswers?.flatMap((qa) => qa.mediaIds || []) || [];
                const allEvidenceIds = [...evidenceMediaIds, ...questionMediaIds];
                const evidencePhotos = allEvidenceIds.length > 0
                  ? media.filter((m) => allEvidenceIds.includes(m.id))
                  : [];

                return (
                  <div key={risk.id} className={cn("p-4 rounded-lg border bg-surface-raised", statusStyle.border)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusDot color={statusStyle.dot} className="w-2.5 h-2.5" />
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

                    {risk.description && (
                      <p className="text-xs text-text-secondary leading-relaxed mb-2">{risk.description}</p>
                    )}

                    {risk.inspectionQuestions && risk.inspectionQuestions.length > 0 && check?.questionAnswers && (
                      <div className="mb-2 space-y-1">
                        <Overline className="block mb-1">Inspection Checks</Overline>
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

                    {risk.whyItMatters && status === "CONFIRMED" && (
                      <p className="text-sm text-red-600 mt-2">{risk.whyItMatters}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="py-8 text-center">
              <ShieldAlert className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No risk profile yet. Complete an inspection to generate risk analysis.</p>
            </Card>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-5">
          {history ? (
            <>
              <div>
                <Overline className="block mb-4">Vehicle History</Overline>
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
                      <p className={cn("text-sm font-bold mt-0.5", bad ? "text-money-negative" : "text-text-primary")}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {history.rawData?.odometerReadings && history.rawData.odometerReadings.length > 0 && (
                <div>
                  <Overline className="block mb-3">Odometer History</Overline>
                  <div className="space-y-1.5">
                    {history.rawData.odometerReadings.slice(0, 10).map((reading, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border-default last:border-0">
                        <span className="text-text-secondary">{reading.date || "—"}</span>
                        <span className="font-medium text-text-primary tabular-nums">{reading.odometer?.toLocaleString()} mi</span>
                        <span className="text-text-tertiary">{reading.source || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="py-8 text-center">
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
            <MarketAnalysisSection data={market} compact hideHero targetMarginPercent={orgSettings?.targetMarginPercent} minProfitPerUnit={orgSettings?.minProfitPerUnit} reconCostOverride={reconEstimate > 0 ? reconEstimate : undefined} overallScore={condScore} marginOverride={marginOverride} />
          ) : (
            <Card className="py-8 text-center">
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
            <Card className="py-8 text-center">
              <Camera className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No photos yet. Complete an inspection to capture vehicle photos.</p>
            </Card>
          )}
        </div>
      )}

      {/* Report Tab */}
      {activeTab === "report" && (
        <div className="space-y-5">
          {/* Generate / Regenerate */}
          {inspection && market && (
            <GenerateReportButton inspectionId={inspection.id} existingReportId={latestInspection?.report?.id} />
          )}

          {/* Offer Justification Builder */}
          {inspection && (
            <OfferBuilder
              inspectionId={inspection.id}
              inspection={inspection as { offerMode?: string | null; offerNotes?: string | null; offerCostBreakdown?: unknown }}
            />
          )}

          {/* Seller Report Preview */}
          {market && inspection && (
            <>
              <div className="divider-brand-gradient my-2" />
              <div>
                <Overline className="block mb-3">Seller Report Preview</Overline>
                <div className="rounded-xl border-2 border-dashed border-border-strong p-4 bg-surface-raised">
                  <MarketAnalysisSection
                    data={market}
                    audience="seller"
                    overallScore={condScore}
                    reconCostOverride={reconEstimate > 0 ? reconEstimate : undefined}
                    targetMarginPercent={orgSettings?.targetMarginPercent}
                    minProfitPerUnit={orgSettings?.minProfitPerUnit}
                    marginOverride={marginOverride}
                    offerMode={inspection.offerMode}
                    offerNotes={inspection.offerNotes}
                    offerCostBreakdown={inspection.offerCostBreakdown as MarketAnalysisSectionProps["offerCostBreakdown"]}
                  />
                </div>
              </div>
            </>
          )}

          {!market && (
            <Card className="py-8 text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-text-tertiary" />
              <p className="text-sm text-text-secondary">No market data yet. Complete an inspection to build your report.</p>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Offer Builder — editable cost breakdown + mode toggle              */
/* ------------------------------------------------------------------ */

interface CostItem { label: string; amountCents: number; description: string }

function OfferBuilder({ inspectionId, inspection }: {
  inspectionId: string;
  inspection: { offerMode?: string | null; offerNotes?: string | null; offerCostBreakdown?: unknown };
}) {
  const [mode, setMode] = useState<"AI_ESTIMATED" | "CUSTOM_NOTES">(
    (inspection.offerMode as "AI_ESTIMATED" | "CUSTOM_NOTES") || "AI_ESTIMATED"
  );
  const [notes, setNotes] = useState(inspection.offerNotes || "");
  const [saved, setSaved] = useState(false);

  const existingItems = ((inspection.offerCostBreakdown as { costItems?: CostItem[] })?.costItems) || [];
  const [costItems, setCostItems] = useState<CostItem[]>(existingItems);
  const [dirty, setDirty] = useState(false);

  const utils = trpc.useUtils();
  const setOfferMode = trpc.inspection.setOfferMode.useMutation({
    onSuccess: (data) => {
      setSaved(true);
      utils.vehicle.getDetail.invalidate();
      setTimeout(() => setSaved(false), 2000);
      if ("breakdown" in data && data.breakdown) {
        const bd = data.breakdown as { costItems?: CostItem[] };
        if (bd.costItems) {
          setCostItems(bd.costItems);
          setDirty(false);
        }
      }
    },
  });
  const updateBreakdown = trpc.inspection.updateOfferBreakdown.useMutation({
    onSuccess: () => {
      setSaved(true);
      setDirty(false);
      utils.vehicle.getDetail.invalidate();
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const hasBreakdown = costItems.length > 0;
  const totalCents = costItems.reduce((s, c) => s + c.amountCents, 0);

  function updateItem(index: number, field: keyof CostItem, value: string | number) {
    setCostItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
    setDirty(true);
  }

  function removeItem(index: number) {
    setCostItems((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  function addItem() {
    setCostItems((prev) => [...prev, { label: "", amountCents: 0, description: "" }]);
    setDirty(true);
  }

  function saveEdits() {
    updateBreakdown.mutate({ inspectionId, costItems });
  }

  return (
    <div className="p-4 rounded-lg border border-border-default bg-surface-overlay">
      <div className="flex items-center justify-between mb-3">
        <Overline>Offer Justification</Overline>
        {saved && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode("AI_ESTIMATED")}
          className={cn(
            "flex-1 text-xs font-medium py-2 px-3 rounded-lg border transition-colors cursor-pointer",
            mode === "AI_ESTIMATED"
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-border-default bg-surface-raised text-text-secondary hover:bg-surface-hover"
          )}
        >AI Cost Breakdown</button>
        <button
          onClick={() => setMode("CUSTOM_NOTES")}
          className={cn(
            "flex-1 text-xs font-medium py-2 px-3 rounded-lg border transition-colors cursor-pointer",
            mode === "CUSTOM_NOTES"
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-border-default bg-surface-raised text-text-secondary hover:bg-surface-hover"
          )}
        >Custom Notes</button>
      </div>

      {mode === "AI_ESTIMATED" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={setOfferMode.isPending}
              onClick={() => setOfferMode.mutate({ inspectionId, mode: "AI_ESTIMATED" })}
            >
              {hasBreakdown ? "Regenerate" : "Generate"} AI Breakdown
            </Button>
            <span className="text-[10px] text-text-tertiary">
              {hasBreakdown ? "AI will replace current items" : "AI analyzes the gap between valuation and your offer"}
            </span>
          </div>

          {hasBreakdown && (
            <div className="space-y-2">
              {costItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-raised border border-border-default">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => updateItem(i, "label", e.target.value)}
                      placeholder="Cost category"
                      className="w-full text-sm font-medium bg-transparent border-b border-transparent hover:border-border-default focus:border-brand-600 focus:outline-none px-0 py-0.5 text-text-primary placeholder:text-text-tertiary"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      placeholder="Description"
                      className="w-full text-[11px] bg-transparent border-b border-transparent hover:border-border-default focus:border-brand-600 focus:outline-none px-0 py-0.5 text-text-tertiary placeholder:text-text-tertiary"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-text-tertiary">$</span>
                    <input
                      type="number"
                      value={Math.round(item.amountCents / 100)}
                      onChange={(e) => updateItem(i, "amountCents", (parseInt(e.target.value) || 0) * 100)}
                      className="w-20 text-sm font-semibold text-right bg-surface-overlay border border-border-default rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-600"
                    />
                    <button
                      onClick={() => removeItem(i)}
                      className="p-1 rounded-md text-text-tertiary hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2 border-t border-border-default">
                <button
                  onClick={addItem}
                  className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:underline cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add Line Item
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary">
                    Total: <span className="font-semibold text-text-primary">${(totalCents / 100).toLocaleString()}</span>
                  </span>
                  {dirty && (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={updateBreakdown.isPending}
                      onClick={saveEdits}
                    >
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes shown to the seller explaining the offer..."
            className="w-full text-sm rounded-lg border border-border-default bg-surface-raised p-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-600 resize-none"
            rows={3}
          />
          <Button
            size="sm"
            variant="primary"
            className="mt-2"
            loading={setOfferMode.isPending}
            onClick={() => setOfferMode.mutate({ inspectionId, mode: "CUSTOM_NOTES", notes })}
          >
            Save Notes
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Generate Report Button                                             */
/* ------------------------------------------------------------------ */

function GenerateReportButton({ inspectionId, existingReportId }: {
  inspectionId: string;
  existingReportId?: string | null;
}) {
  const utils = trpc.useUtils();
  const [generated, setGenerated] = useState(false);
  const generateReport = trpc.report.generate.useMutation({
    onSuccess: () => {
      setGenerated(true);
      utils.vehicle.getDetail.invalidate();
    },
  });

  return (
    <div className="flex flex-col items-center gap-2 pt-4">
      <Button
        variant="primary"
        size="lg"
        loading={generateReport.isPending}
        onClick={() => generateReport.mutate({ inspectionId })}
        className="w-full sm:w-auto min-w-[240px]"
      >
        <FileText className="h-4 w-4" />
        {existingReportId ? "Regenerate Report" : "Generate Report"}
      </Button>
      {generated && (
        <p className="text-xs text-green-600 font-medium">
          Report generated! <Link href="/dashboard/reports" className="underline">View Reports →</Link>
        </p>
      )}
      {existingReportId && !generated && (
        <p className="text-[10px] text-text-tertiary">
          This will regenerate the existing report with your current offer settings.
        </p>
      )}
    </div>
  );
}
