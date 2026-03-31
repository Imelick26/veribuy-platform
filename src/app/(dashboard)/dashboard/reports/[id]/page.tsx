"use client";

import { use, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, severityColor, cn } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle,
  Wrench,
  BarChart3,
} from "lucide-react";
import { MarketAnalysisSection, type MarketAnalysisData } from "@/components/report/MarketAnalysisSection";
import { PhotoGallery } from "@/components/report/PhotoGallery";

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: report, isLoading } = trpc.report.get.useQuery({ id });
  const utils = trpc.useUtils();
  const [pdfLoading, setPdfLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
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
      // fallback to direct URL
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

  // Filter out findings that came from risk items (already shown in "Known Risk Areas Inspected")
  const riskStep = inspection.steps?.find((s: { step: string }) => s.step === "RISK_INSPECTION")
    || inspection.steps?.find((s: { step: string }) => s.step === "RISK_REVIEW");
  const riskData = riskStep?.data as { aggregatedRisks?: Array<{ title: string }> } | null;
  const riskTitles = new Set((riskData?.aggregatedRisks || []).map((r) => r.title));
  const findings = allFindings.filter((f) => !riskTitles.has(f.title));

  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const majorCount = findings.filter((f) => f.severity === "MAJOR").length;
  const moderateCount = findings.filter((f) => f.severity === "MODERATE").length;
  const minorCount = findings.filter((f) => f.severity === "MINOR" || f.severity === "INFO").length;

  const totalRepairLow = findings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
  const totalRepairHigh = findings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);

  // AI recon cost — single source of truth for repair costs
  const reconLog = (inspection as { aiValuationLogs?: Array<{ output: unknown }> })?.aiValuationLogs?.[0];
  const reconOutput = reconLog?.output as { totalReconCost?: number } | null;
  const aiReconCost = reconOutput?.totalReconCost || null;

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
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary truncate">Inspection Report</h1>
            <p className="text-text-secondary font-mono text-sm">{report.number}</p>
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
      <div className="bg-surface-raised rounded-xl border border-border-default shadow-sm overflow-hidden print:shadow-none print:border-none">

        {/* Report Header — Vehicle identity + key facts */}
        <div className="bg-brand-gradient px-4 sm:px-8 py-5 sm:py-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-white/80 text-sm font-medium">VeriBuy Inspection Report</p>
              <h2 className="text-xl sm:text-2xl font-bold mt-1">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/80 text-xs sm:text-sm mt-1.5">
                <span className="font-mono">VIN: {vehicle.vin}</span>
                {inspection.odometer && <span>{inspection.odometer.toLocaleString()} mi</span>}
                {inspection.location && <span>{inspection.location}</span>}
              </div>
            </div>
            <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
              {inspection.overallScore != null && (
                <div className={cn(
                  "w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 bg-white ring-1 ring-white/40",
                  (inspection.overallScore || 0) >= 70 ? "border-green-400 text-green-700" :
                  (inspection.overallScore || 0) >= 50 ? "border-yellow-400 text-yellow-700" :
                  "border-red-400 text-red-700"
                )}>
                  <span className="font-bold text-lg leading-none">{inspection.overallScore}</span>
                  <span className="text-[9px] text-text-tertiary">/100</span>
                </div>
              )}
              <div>
                <p className="text-white/80 text-sm">Report #{report.number}</p>
                <p className="text-white/80 text-sm">{formatDate(report.generatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Condition Assessment — 4-area breakdown + findings summary */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-primary">Condition Assessment</h3>
            <span className={cn(
              "text-xs font-semibold px-2.5 py-1 rounded-full",
              findings.length === 0
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
            )}>
              {findings.length} known issue{findings.length !== 1 ? "s" : ""} found
            </span>
          </div>

          {/* Inspector Notes (from voice/text during capture) */}
          {(() => {
            const conditionStep = inspection.steps?.find((s: { step: string }) => s.step === "AI_CONDITION_SCAN");
            const condData = conditionStep?.data as { inspectorNotes?: string } | null;
            if (!condData?.inspectorNotes) return null;
            return (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1">Inspector Notes</p>
                <p className="text-xs text-amber-800 italic">{condData.inspectorNotes}</p>
              </div>
            );
          })()}

          {/* Risk Area Summary — known issues checked */}
          {(() => {
            // Build AI recon cost lookup so risk items show consistent costs
            const reconLog = (inspection as { aiValuationLogs?: Array<{ output: unknown }> })?.aiValuationLogs?.[0];
            const reconOutput = reconLog?.output as {
              itemizedCosts?: Array<{ finding: string; estimatedCostCents: number }>;
            } | null;
            const reconCostByName = new Map<string, number>();
            reconOutput?.itemizedCosts?.forEach((item) => {
              reconCostByName.set(item.finding.toLowerCase(), item.estimatedCostCents);
            });

            // Risk data lives in RISK_INSPECTION step (both risks + check statuses)
            const riskStep = inspection.steps?.find((s: { step: string }) => s.step === "RISK_INSPECTION")
              || inspection.steps?.find((s: { step: string }) => s.step === "RISK_REVIEW");
            const riskData = riskStep?.data as {
              aggregatedRisks?: Array<{
                id: string; title: string; description: string; category: string; severity: string;
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
            const risks = riskData?.aggregatedRisks;
            const checks = riskData?.checkStatuses;

            if (!risks || risks.length === 0 || !checks) return null;

            const checkedRisks = risks
              .filter((r) => checks[r.id] && (checks[r.id].status === "CONFIRMED" || checks[r.id].status === "NOT_FOUND"))
              .map((r) => {
                const check = checks[r.id];
                // Narrow cost to specific tier based on inspection question answers
                let narrowedCost = r.cost;
                if (check.status === "CONFIRMED" && r.costTiers && r.costTiers.length === 3 && check.questionAnswers) {
                  const failureCount = check.questionAnswers.filter((qa) => {
                    const question = r.inspectionQuestions?.find((q) => q.id === qa.questionId);
                    return question && qa.answer === question.failureAnswer;
                  }).length;
                  // 1 failure = MINOR, 2 = MODERATE, 3+ = SEVERE
                  const tierIndex = Math.min(Math.max(failureCount - 1, 0), 2);
                  const tier = r.costTiers[tierIndex];
                  if (tier) {
                    narrowedCost = { low: tier.costLow, high: tier.costHigh };
                  }
                }
                return {
                  ...r,
                  cost: narrowedCost,
                  status: check.status as string,
                  notes: check.notes,
                };
              });

            if (checkedRisks.length === 0) return null;

            const confirmed = checkedRisks.filter((r) => r.status === "CONFIRMED");
            const cleared = checkedRisks.filter((r) => r.status === "NOT_FOUND");

            return (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-text-primary mb-2">Known Risk Areas Inspected</h4>
                <p className="text-xs text-text-tertiary mb-3">
                  {checkedRisks.length} common issue{checkedRisks.length !== 1 ? "s" : ""} reported for this model were inspected during this assessment.
                </p>
                <div className="space-y-1.5">
                  {checkedRisks.map((r) => {
                    const statusStyle = r.status === "CONFIRMED"
                      ? { bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", text: "text-red-600", label: "Identified" }
                      : r.status === "NOT_FOUND"
                      ? { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500", text: "text-green-600", label: "Clear" }
                      : r.status === "UNABLE_TO_INSPECT"
                      ? { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400", text: "text-amber-600", label: "Unable to Inspect" }
                      : { bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-400", text: "text-gray-500", label: "Not Checked" };

                    return (
                      <div key={r.id} className={cn(
                        "px-3 py-2.5 rounded-md border text-xs",
                        statusStyle.bg, statusStyle.border,
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={cn("w-2 h-2 rounded-full shrink-0", statusStyle.dot)} />
                            <span className="text-text-primary font-medium truncate">{r.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.status === "CONFIRMED" && (() => {
                              // Prefer AI recon cost for consistency
                              const aiCost = reconCostByName.get(r.title.toLowerCase());
                              const fallbackCost = r.cost ? Math.round((r.cost.low + r.cost.high) / 2) : null;
                              const displayCost = aiCost || fallbackCost;
                              return displayCost ? (
                                <span className="text-red-600 font-bold">
                                  {formatCurrency(displayCost)}
                                </span>
                              ) : null;
                            })()}
                            <span className={cn("font-semibold", statusStyle.text)}>
                              {statusStyle.label}
                            </span>
                          </div>
                        </div>
                        {r.status === "CONFIRMED" && r.description && (
                          <p className="text-xs text-text-secondary mt-1.5 ml-4 leading-relaxed">{r.description}</p>
                        )}
                        {r.status === "CONFIRMED" && r.whyItMatters && (
                          <p className="text-xs text-red-600 mt-1 ml-4 leading-relaxed">{r.whyItMatters}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-text-tertiary mt-2">
                  {cleared.length} of {checkedRisks.length} risk areas not observed during inspection
                  {confirmed.length > 0 && ` · ${confirmed.length} issue${confirmed.length !== 1 ? "s" : ""} observed`}
                </p>
              </div>
            );
          })()}

          {/* Score breakdown — 4-area AI condition assessment (matches vehicle detail style) */}
          {inspection.overallScore != null && (() => {
            const rawData = inspection.conditionRawData as Record<string, unknown> | null;
            const areas = [
              { label: "Exterior Body", key: "exteriorBody", score: inspection.exteriorBodyScore, weight: "30%" },
              { label: "Interior", key: "interior", score: inspection.interiorScore, weight: "15%" },
              { label: "Mechanical / Visual", key: "mechanicalVisual", score: inspection.mechanicalVisualScore, weight: "35%" },
              { label: "Underbody / Frame", key: "underbodyFrame", score: inspection.underbodyFrameScore, weight: "20%" },
            ];

            return (
              <div className="mt-4 space-y-0">
                {areas.map((item) => {
                  const detail = rawData?.[item.key] as { summary?: string; keyObservations?: string[]; concerns?: string[]; scoreJustification?: string } | undefined;
                  const dotColor = (item.score || 0) >= 7 ? "bg-green-500" : (item.score || 0) >= 6 ? "bg-yellow-400" : "bg-red-500";
                  return (
                    <div key={item.label} className="pb-4 border-b border-border-default last:border-0 last:pb-0 pt-4 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotColor)} />
                          <span className="text-sm font-medium text-text-primary">{item.label}</span>
                        </div>
                        <span className="text-sm font-bold text-text-primary">{item.score ?? "—"}/10</span>
                      </div>
                      {detail?.summary && (
                        <p className="text-sm text-text-secondary mt-1 leading-relaxed ml-[18px]">{detail.summary}</p>
                      )}
                      {detail?.concerns && detail.concerns.length > 0 && (
                        <div className="mt-1 ml-[18px]">
                          {detail.concerns.map((c, i) => (
                            <p key={i} className="text-sm text-red-600 leading-relaxed">{"\u2022"} {c}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Tire Assessment */}
          {(() => {
            const rawData = inspection.conditionRawData as { tireAssessment?: {
              frontDriver: { condition: string; observations: string[] };
              frontPassenger: { condition: string; observations: string[] };
              rearDriver: { condition: string; observations: string[] };
              rearPassenger: { condition: string; observations: string[] };
              overallTireScore: number;
              summary: string;
            } } | null;
            const tires = rawData?.tireAssessment;
            if (!tires) return null;

            const condColor = (c: string) =>
              c === "GOOD" ? "text-green-700 bg-green-50 border-green-200" :
              c === "WORN" ? "text-amber-600 bg-amber-50 border-amber-200" :
              "text-red-600 bg-red-50 border-red-200";

            const condLabel = (c: string) =>
              c === "GOOD" ? "Good" : c === "WORN" ? "Worn" : "Replace";

            return (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-text-primary mb-2">Tire Condition</h4>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { label: "Front Left", data: tires.frontDriver },
                    { label: "Front Right", data: tires.frontPassenger },
                    { label: "Rear Left", data: tires.rearDriver },
                    { label: "Rear Right", data: tires.rearPassenger },
                  ]).map(({ label, data }) => (
                    <div key={label} className={cn("p-2 rounded-lg border text-xs", condColor(data.condition))}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{label}</span>
                        <span className="font-bold text-[10px]">{condLabel(data.condition)}</span>
                      </div>
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
              <p className="text-sm font-semibold text-red-700">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Total Estimated Repair Cost: {formatCurrency(totalRepairLow)} – {formatCurrency(totalRepairHigh)}
              </p>
            </div>
          )}
        </div>

        {/* Vehicle Details */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
          <h3 className="text-lg font-bold text-text-primary mb-4">Vehicle Information</h3>
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
                <p className="text-xs text-text-secondary">{label}</p>
                <p className="text-sm font-medium text-text-primary">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Findings */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
          <h3 className="text-lg font-bold text-text-primary mb-4">
            <Wrench className="inline h-5 w-5 mr-1" />
            Identified Issues ({findings.length})
          </h3>
          {findings.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No issues found during inspection</p>
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((f) => {
                const repairCost = f.repairCostLow && f.repairCostHigh
                  ? Math.round((f.repairCostLow + f.repairCostHigh) / 2)
                  : f.repairCostLow || f.repairCostHigh || null;
                return (
                <div
                  key={f.id}
                  className={`p-4 rounded-xl border ${severityColor(f.severity)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-text-primary">{f.title}</h4>
                    <div className="flex items-center gap-2">
                      {repairCost && (
                        <span className="text-sm font-bold text-red-600">
                          {formatCurrency(repairCost)}
                        </span>
                      )}
                      <Badge variant={
                        f.severity === "CRITICAL" ? "danger" :
                        f.severity === "MAJOR" ? "warning" : "default"
                      }>
                        {f.severity}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary">{f.description}</p>
                  {f.evidence && (
                    <p className="text-sm text-text-secondary mt-1 italic">Evidence: {f.evidence}</p>
                  )}
                  {/* Finding media */}
                  {f.media && f.media.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {f.media.map((m) => (
                        m.url && (
                          <div key={m.id} className="h-16 w-16 rounded-lg bg-surface-sunken overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="Evidence" className="h-full w-full object-cover" />
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Repair Cost Breakdown — AI-computed justification */}
        {(() => {
          const reconLog = (inspection as { aiValuationLogs?: Array<{ output: unknown }> })?.aiValuationLogs?.[0];
          const reconBreakdown = reconLog?.output as {
            totalReconCost?: number;
            itemizedCosts?: Array<{ finding: string; estimatedCostCents: number; laborHours?: number; partsEstimate?: number; shopType: string; reasoning: string }>;
            laborRateContext?: string;
          } | null;
          if (!reconBreakdown?.itemizedCosts || reconBreakdown.itemizedCosts.length === 0) return null;

          return (
            <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
              <h3 className="text-lg font-bold text-text-primary mb-4">
                <Wrench className="inline h-5 w-5 mr-1" />
                Estimated Repair Costs
              </h3>
              <div className="space-y-2">
                {reconBreakdown.itemizedCosts.map((item, i) => (
                  <div key={i} className="flex items-start justify-between text-sm px-3 py-2.5 rounded-lg bg-surface-sunken">
                    <div className="flex-1 min-w-0 mr-3">
                      <span className="font-medium text-text-primary">{item.finding}</span>
                      {item.reasoning && (
                        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{item.reasoning}</p>
                      )}
                      {(item.laborHours || item.partsEstimate) && (
                        <p className="text-xs text-text-tertiary mt-0.5">
                          {item.laborHours ? `${item.laborHours}h labor` : ""}
                          {item.laborHours && item.partsEstimate ? " + " : ""}
                          {item.partsEstimate ? `${formatCurrency(item.partsEstimate)} parts` : ""}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-red-600 shrink-0">{formatCurrency(item.estimatedCostCents)}</span>
                  </div>
                ))}
              </div>
              {reconBreakdown.totalReconCost && (
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border-default">
                  <span className="text-sm font-semibold text-text-primary">Total Estimated Repairs</span>
                  <span className="text-sm font-bold text-red-600">{formatCurrency(reconBreakdown.totalReconCost)}</span>
                </div>
              )}
              {reconBreakdown.laborRateContext && (
                <p className="text-[10px] text-text-tertiary mt-2">{reconBreakdown.laborRateContext}</p>
              )}
            </div>
          );
        })()}

        {/* Vehicle Valuation — Our Offer (at the end, after all evidence) */}
        {report.inspection.marketAnalysis && (
          <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
            <h3 className="text-lg font-bold text-text-primary mb-4">
              <BarChart3 className="inline h-5 w-5 mr-1" />
              Vehicle Valuation
            </h3>
            <MarketAnalysisSection
              data={report.inspection.marketAnalysis as unknown as MarketAnalysisData}
              audience="seller"
              overallScore={inspection.overallScore}
              reconCostOverride={aiReconCost}
            />
          </div>
        )}

        {/* Photo Gallery — Standard + Evidence + All */}
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
