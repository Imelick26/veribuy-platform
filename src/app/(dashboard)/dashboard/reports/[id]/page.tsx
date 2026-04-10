"use client";

import { use, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Overline } from "@/components/ui/Overline";
import { ConditionBar } from "@/components/ui/ConditionBar";
import { StatusDot } from "@/components/ui/StatusDot";

import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, cn, getDealRatingBadge } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { MarketAnalysisSection, type MarketAnalysisData, type MarketAnalysisSectionProps } from "@/components/report/MarketAnalysisSection";
import { PhotoGallery } from "@/components/report/PhotoGallery";

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: report, isLoading } = trpc.report.get.useQuery({ id });
  const { data: orgSettings } = trpc.auth.getOrgSettings.useQuery();
  const utils = trpc.useUtils();
  const [pdfLoading, setPdfLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner-gradient" />
      </div>
    );
  }

  if (!report || !report.inspection) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">Report not found</p>
        <Link href="/dashboard/reports">
          <Button variant="secondary" className="mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Button>
        </Link>
      </div>
    );
  }

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try {
      const { url } = await utils.report.downloadPDF.fetch({ id });
      window.open(url, "_blank");
    } catch {
      if (report?.pdfUrl) window.open(report.pdfUrl, "_blank");
    } finally {
      setPdfLoading(false);
    }
  }

  const { inspection } = report;
  const vehicle = inspection.vehicle;
  const { media, inspector } = inspection;
  const allFindings = inspection.findings;

  if (!vehicle) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">No vehicle linked to this inspection yet.</p>
        <Link href="/dashboard/reports">
          <Button variant="secondary" className="mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Button>
        </Link>
      </div>
    );
  }

  // Filter out findings that came from risk items
  const riskStep = inspection.steps?.find((s: { step: string }) => s.step === "RISK_INSPECTION")
    || inspection.steps?.find((s: { step: string }) => s.step === "RISK_REVIEW");
  const riskData = riskStep?.data as {
    aggregatedRisks?: Array<{
      id: string; title: string; description: string; severity: string;
      whyItMatters?: string;
      cost: { low: number; high: number };
      costTiers?: Array<{ condition: string; label: string; costLow: number; costHigh: number }>;
      inspectionQuestions?: Array<{ id: string; failureAnswer: string }>;
    }>;
    checkStatuses?: Record<string, {
      status: string; notes?: string;
      questionAnswers?: Array<{ questionId: string; answer: string | null }>;
    }>;
  } | null;
  const riskTitles = new Set((riskData?.aggregatedRisks || []).map((r) => r.title));
  const findings = allFindings.filter((f) => !riskTitles.has(f.title));

  const totalRepairLow = findings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
  const totalRepairHigh = findings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);

  // AI recon cost
  const reconLog = (inspection as { aiValuationLogs?: Array<{ output: unknown }> })?.aiValuationLogs?.[0];
  const reconOutput = reconLog?.output as { totalReconCost?: number; itemizedCosts?: Array<{ finding: string; estimatedCostCents: number; laborHours?: number; partsEstimate?: number; shopType: string; reasoning: string }>; laborRateContext?: string } | null;
  const aiReconCost = reconOutput?.totalReconCost || null;

  // Deal rating
  const ma = inspection.marketAnalysis as { recommendation?: string; estRetailPrice?: number } | null;
  const rating = getDealRatingBadge(ma?.recommendation);

  // Condition data
  const rawConditionData = inspection.conditionRawData as Record<string, unknown> | null;

  // Recon cost lookup for risk items
  const reconCostByName = new Map<string, number>();
  reconOutput?.itemizedCosts?.forEach((item) => {
    reconCostByName.set(item.finding.toLowerCase(), item.estimatedCostCents);
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/dashboard/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold text-text-primary tracking-tight truncate">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <div className="flex items-center gap-3 text-sm text-text-secondary mt-0.5">
              <span className="font-mono text-xs">{report.number}</span>
              <span>{formatDate(report.generatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 self-start sm:self-auto pl-10 sm:pl-0">
          {report.pdfUrl && (
            <Button
              variant="secondary"
              size="sm"
              disabled={pdfLoading}
              onClick={handleDownloadPDF}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{pdfLoading ? "Preparing…" : "Download PDF"}</span>
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const url = `${window.location.origin}/reports/shared/${report.shareToken}`;
              navigator.clipboard.writeText(url);
            }}
          >
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Copy Share Link</span>
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-surface-raised rounded-xl border border-border-default overflow-hidden">

        {/* Report Header — clean, no gradient */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <Overline className="block mb-2">VeriBuy Inspection Report</Overline>
              <div className="flex items-center gap-3 text-sm text-text-secondary flex-wrap">
                <span className="font-mono text-xs">VIN: {vehicle.vin}</span>
                {inspection.odometer && <span>{inspection.odometer.toLocaleString()} mi</span>}
                {inspection.location && <span>{inspection.location}</span>}
              </div>
              {rating.variant !== "default" && (
                <Badge variant={rating.variant} className="mt-3 text-sm px-3 py-1">{rating.label}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              {inspection.overallScore != null && (
                <div className="text-center">
                  <span className="text-[36px] font-bold text-text-primary leading-none tabular-nums">{inspection.overallScore}</span>
                  <p className="text-xs text-text-tertiary mt-0.5">/100</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Condition Assessment */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
          <div className="flex items-center justify-between mb-4">
            <Overline>Condition Assessment</Overline>
            <span className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full",
              findings.length === 0
                ? "bg-green-50 text-green-700"
                : "bg-caution-50 text-caution-600"
            )}>
              {findings.length} issue{findings.length !== 1 ? "s" : ""} found
            </span>
          </div>

          {/* Inspector Notes */}
          {(() => {
            const conditionStep = inspection.steps?.find((s: { step: string }) => s.step === "AI_CONDITION_SCAN");
            const condData = conditionStep?.data as { inspectorNotes?: string } | null;
            if (!condData?.inspectorNotes) return null;
            return (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-caution-50 border border-caution-200">
                <p className="text-xs font-semibold text-caution-600 mb-1">Inspector Notes</p>
                <p className="text-xs text-caution-700 italic">{condData.inspectorNotes}</p>
              </div>
            );
          })()}

          {/* Risk Area Summary */}
          {(() => {
            const risks = riskData?.aggregatedRisks;
            const checks = riskData?.checkStatuses;
            if (!risks || risks.length === 0 || !checks) return null;

            const checkedRisks = risks
              .filter((r) => checks[r.id] && (checks[r.id].status === "CONFIRMED" || checks[r.id].status === "NOT_FOUND"))
              .map((r) => {
                const check = checks[r.id];
                let narrowedCost = r.cost;
                if (check.status === "CONFIRMED" && r.costTiers && r.costTiers.length === 3 && check.questionAnswers) {
                  const failureCount = check.questionAnswers.filter((qa) => {
                    const question = r.inspectionQuestions?.find((q) => q.id === qa.questionId);
                    return question && qa.answer === question.failureAnswer;
                  }).length;
                  const tierIndex = Math.min(Math.max(failureCount - 1, 0), 2);
                  const tier = r.costTiers[tierIndex];
                  if (tier) narrowedCost = { low: tier.costLow, high: tier.costHigh };
                }
                return { ...r, cost: narrowedCost, status: check.status as string };
              });

            if (checkedRisks.length === 0) return null;

            const confirmed = checkedRisks.filter((r) => r.status === "CONFIRMED");
            const cleared = checkedRisks.filter((r) => r.status === "NOT_FOUND");

            return (
              <div className="mb-4">
                <Overline className="block mb-2">Known Risk Areas Inspected</Overline>
                <p className="text-xs text-text-tertiary mb-3">
                  {checkedRisks.length} common issue{checkedRisks.length !== 1 ? "s" : ""} for this model were checked.
                </p>
                <div className="space-y-1.5">
                  {checkedRisks.map((r) => {
                    const isConfirmed = r.status === "CONFIRMED";
                    const dotColor: "red" | "green" | "gray" = isConfirmed ? "red" : r.status === "NOT_FOUND" ? "green" : "gray";

                    return (
                      <div key={r.id} className={cn(
                        "px-3 py-2.5 rounded-md border text-xs",
                        isConfirmed ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200",
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <StatusDot color={dotColor} />
                            <span className="text-text-primary font-medium truncate">{r.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isConfirmed && (() => {
                              const aiCost = reconCostByName.get(r.title.toLowerCase());
                              const fallbackCost = r.cost ? Math.round((r.cost.low + r.cost.high) / 2) : null;
                              const displayCost = aiCost || fallbackCost;
                              return displayCost ? (
                                <span className="text-money-negative font-bold">{formatCurrency(displayCost)}</span>
                              ) : null;
                            })()}
                            <span className={cn("font-semibold", isConfirmed ? "text-red-600" : "text-green-600")}>
                              {isConfirmed ? "Identified" : "Clear"}
                            </span>
                          </div>
                        </div>
                        {isConfirmed && r.description && (
                          <p className="text-xs text-text-secondary mt-1.5 ml-4 leading-relaxed">{r.description}</p>
                        )}
                        {isConfirmed && r.whyItMatters && (
                          <p className="text-xs text-red-600 mt-1 ml-4 leading-relaxed">{r.whyItMatters}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-text-tertiary mt-2">
                  {cleared.length} of {checkedRisks.length} risk areas clear
                  {confirmed.length > 0 && ` · ${confirmed.length} issue${confirmed.length !== 1 ? "s" : ""} identified`}
                </p>
              </div>
            );
          })()}

          {/* 9-area ConditionBar breakdown */}
          {inspection.overallScore != null && (() => {
            const weights = inspection.conditionWeights as Record<string, number> | null;
            const scoreGroups = [
              { group: "Exterior", items: [
                { label: "Paint & Body", key: "paintBody", score: inspection.paintBodyScore },
                { label: "Panel Alignment", key: "panelAlignment", score: inspection.panelAlignmentScore },
                { label: "Glass & Lighting", key: "glassLighting", score: inspection.glassLightingScore },
              ]},
              { group: "Interior", items: [
                { label: "Surfaces", key: "interiorSurfaces", score: inspection.interiorSurfacesScore },
                { label: "Controls", key: "interiorControls", score: inspection.interiorControlsScore },
              ]},
              { group: "Mechanical", items: [
                { label: "Engine Bay", key: "engineBay", score: inspection.engineBayScore },
                { label: "Tires & Wheels", key: "tiresWheels", score: inspection.tiresWheelsScore },
                { label: "Exhaust", key: "exhaust", score: inspection.exhaustScore },
              ]},
              { group: "Structural", items: [
                { label: "Underbody & Frame", key: "underbodyFrame", score: inspection.underbodyFrameScore },
              ]},
            ];
            return (
              <div className="space-y-5 mt-4">
                {scoreGroups.map(({ group, items }) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{group}</p>
                    <div className="space-y-3">
                      {items.map(({ label, key, score }) => {
                        const w = weights?.[key];
                        const weightLabel = w ? ` (${w}%)` : "";
                        const detail = rawConditionData?.[key] as { summary?: string; concerns?: string[] } | undefined;
                        const subtitle = [
                          detail?.summary,
                          ...(detail?.concerns?.map((c) => `⚠ ${c}`) || []),
                        ].filter(Boolean).join(" — ");
                        return (
                          <ConditionBar
                            key={label}
                            label={`${label}${weightLabel}`}
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

          {/* Tire Assessment */}
          {(() => {
            const tireData = rawConditionData as { tireAssessment?: {
              frontDriver: { condition: string; observations: string[] };
              frontPassenger: { condition: string; observations: string[] };
              rearDriver: { condition: string; observations: string[] };
              rearPassenger: { condition: string; observations: string[] };
              summary: string;
            } } | null;
            const tires = tireData?.tireAssessment;
            if (!tires) return null;

            const dotColor = (c: string): "green" | "yellow" | "red" => c === "GOOD" ? "green" : c === "WORN" ? "yellow" : "red";
            const condLabel = (c: string) => c === "GOOD" ? "Good" : c === "WORN" ? "Worn" : "Replace";

            return (
              <div className="mt-4">
                <Overline className="block mb-2">Tire Condition</Overline>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { label: "Front Left", data: tires.frontDriver },
                    { label: "Front Right", data: tires.frontPassenger },
                    { label: "Rear Left", data: tires.rearDriver },
                    { label: "Rear Right", data: tires.rearPassenger },
                  ]).map(({ label, data }) => (
                    <div key={label} className="flex items-center gap-2 p-2 rounded-lg border border-border-default text-xs">
                      <StatusDot color={dotColor(data.condition)} />
                      <span className="font-medium text-text-primary">{label}</span>
                      <span className="ml-auto font-bold text-text-primary">{condLabel(data.condition)}</span>
                    </div>
                  ))}
                </div>
                {tires.summary && (
                  <p className="text-xs text-text-secondary mt-2">{tires.summary}</p>
                )}
              </div>
            );
          })()}

          {/* Total repair estimate */}
          {totalRepairHigh > 0 && (
            <div className="mt-4 p-3 rounded-lg border border-border-default border-l-4 border-l-red-500">
              <p className="text-sm font-semibold text-money-negative">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Total Estimated Repair Cost: {formatCurrency(totalRepairLow)} – {formatCurrency(totalRepairHigh)}
              </p>
            </div>
          )}
        </div>

        {/* Vehicle Details */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
          <Overline className="block mb-4">Vehicle Information</Overline>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6">
            {[
              ["VIN", vehicle.vin],
              ["Year", vehicle.year],
              ["Make", vehicle.make],
              ["Model", vehicle.model],
              ["Trim", vehicle.trim || "N/A"],
              ["Body Style", vehicle.bodyStyle || "N/A"],
              ["Drivetrain", vehicle.drivetrain || "N/A"],
              ["Engine", vehicle.engine || "N/A"],
              ["Transmission", vehicle.transmission || "N/A"],
              ["Odometer", inspection.odometer ? `${inspection.odometer.toLocaleString()} mi` : "N/A"],
              ["Location", inspection.location || "N/A"],
              ["Inspection Date", formatDate(inspection.createdAt)],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-[11px] text-text-tertiary uppercase tracking-wider font-medium">{label}</p>
                <p className="text-sm font-medium text-text-primary">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Findings */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
          <Overline className="block mb-4">Identified Issues ({findings.length})</Overline>
          {findings.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No issues found during inspection</p>
            </div>
          ) : (
            <div className="space-y-2">
              {findings.map((f) => {
                const repairCost = f.repairCostLow && f.repairCostHigh
                  ? `${formatCurrency(f.repairCostLow)} – ${formatCurrency(f.repairCostHigh)}`
                  : f.repairCostLow ? formatCurrency(f.repairCostLow)
                  : f.repairCostHigh ? formatCurrency(f.repairCostHigh) : null;

                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border-default bg-surface-raised border-l-4 border-l-red-500"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusDot color={f.severity === "CRITICAL" || f.severity === "MAJOR" ? "red" : "yellow"} className="w-2.5 h-2.5" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-text-primary">{f.title}</span>
                        {f.description && (
                          <p className="text-xs text-text-secondary mt-0.5">{f.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {repairCost && (
                        <span className="text-xs font-semibold text-money-negative">{repairCost}</span>
                      )}
                      <Badge variant={
                        f.severity === "CRITICAL" ? "danger" :
                        f.severity === "MAJOR" ? "warning" : "default"
                      } className="text-[10px]">
                        {f.severity}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Repair Cost Breakdown */}
        {reconOutput?.itemizedCosts && reconOutput.itemizedCosts.length > 0 && (
          <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
            <Overline className="block mb-4">Estimated Repair Costs</Overline>
            <div className="space-y-2">
              {reconOutput.itemizedCosts.map((item, i) => (
                <div key={i} className="flex items-start justify-between text-sm px-3 py-2.5 rounded-lg bg-surface-sunken">
                  <div className="flex-1 min-w-0 mr-3">
                    <span className="font-medium text-text-primary">{item.finding}</span>
                    {item.reasoning && (
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{item.reasoning}</p>
                    )}
                  </div>
                  <span className="font-bold text-money-negative shrink-0">{formatCurrency(item.estimatedCostCents)}</span>
                </div>
              ))}
            </div>
            {reconOutput.totalReconCost && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-border-default">
                <span className="text-sm font-semibold text-text-primary">Total Estimated Repairs</span>
                <span className="text-sm font-bold text-money-negative">{formatCurrency(reconOutput.totalReconCost)}</span>
              </div>
            )}
            {reconOutput.laborRateContext && (
              <p className="text-[10px] text-text-tertiary mt-2">{reconOutput.laborRateContext}</p>
            )}
          </div>
        )}

        {/* Vehicle Valuation */}
        {inspection.marketAnalysis && (
          <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
            <Overline className="block mb-4">Vehicle Valuation</Overline>
            <MarketAnalysisSection
              data={inspection.marketAnalysis as unknown as MarketAnalysisData}
              audience="seller"
              overallScore={inspection.overallScore}
              reconCostOverride={aiReconCost ?? undefined}
              targetMarginPercent={orgSettings?.targetMarginPercent}
              minProfitPerUnit={orgSettings?.minProfitPerUnit}
              offerMode={inspection.offerMode}
              offerNotes={inspection.offerNotes}
              offerCostBreakdown={inspection.offerCostBreakdown as MarketAnalysisSectionProps["offerCostBreakdown"]}
            />
          </div>
        )}

        {/* Photo Gallery */}
        <PhotoGallery media={media ?? []} findings={findings} />

        {/* Footer */}
        <div className="px-4 sm:px-8 py-4 bg-surface-sunken text-center">
          <p className="text-xs text-text-tertiary">
            Report generated by VeriBuy on {formatDate(report.generatedAt)}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            This report is provided for informational purposes. Always consult a qualified mechanic for final assessment.
          </p>
        </div>
      </div>
    </div>
  );
}
