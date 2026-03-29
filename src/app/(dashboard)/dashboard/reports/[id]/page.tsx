"use client";

import { use, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
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
  const { findings, media, inspector } = inspection;

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

  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const majorCount = findings.filter((f) => f.severity === "MAJOR").length;
  const moderateCount = findings.filter((f) => f.severity === "MODERATE").length;
  const minorCount = findings.filter((f) => f.severity === "MINOR" || f.severity === "INFO").length;

  const totalRepairLow = findings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
  const totalRepairHigh = findings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);

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
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-4 sm:px-8 py-5 sm:py-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-brand-200 text-sm font-medium">VeriBuy Inspection Report</p>
              <h2 className="text-xl sm:text-2xl font-bold mt-1">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-brand-200 text-xs sm:text-sm mt-1.5">
                <span className="font-mono">VIN: {vehicle.vin}</span>
                {inspection.odometer && <span>{inspection.odometer.toLocaleString()} mi</span>}
                {inspection.location && <span>{inspection.location}</span>}
              </div>
            </div>
            <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
              {inspection.overallScore != null && (
                <div className={cn(
                  "w-16 h-16 rounded-full flex flex-col items-center justify-center border-2",
                  (inspection.overallScore || 0) >= 70 ? "bg-green-500/20 border-green-300 text-green-100" :
                  (inspection.overallScore || 0) >= 50 ? "bg-amber-500/20 border-amber-300 text-amber-100" :
                  "bg-red-500/20 border-red-300 text-red-100"
                )}>
                  <span className="font-bold text-lg leading-none">{inspection.overallScore}</span>
                  <span className="text-[9px] opacity-70">/100</span>
                </div>
              )}
              <div>
                <p className="text-brand-200 text-sm">Report #{report.number}</p>
                <p className="text-brand-200 text-sm">{formatDate(report.generatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Market Analysis — THE DECISION (moved to top) */}
        {report.inspection.marketAnalysis && (
          <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
            <h3 className="text-lg font-bold text-text-primary mb-4">
              <BarChart3 className="inline h-5 w-5 mr-1" />
              Market Analysis
            </h3>
            <MarketAnalysisSection
              data={report.inspection.marketAnalysis as unknown as MarketAnalysisData}
            />
          </div>
        )}

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
            // Risk data lives in RISK_INSPECTION step (both risks + check statuses)
            const riskStep = inspection.steps?.find((s: { step: string }) => s.step === "RISK_INSPECTION")
              || inspection.steps?.find((s: { step: string }) => s.step === "RISK_REVIEW");
            const riskData = riskStep?.data as { aggregatedRisks?: Array<{ id: string; title: string; description: string; category: string; severity: string; cost: { low: number; high: number } }>; checkStatuses?: Record<string, { status: string; notes?: string }> } | null;
            const risks = riskData?.aggregatedRisks;
            const checks = riskData?.checkStatuses;

            if (!risks || risks.length === 0 || !checks) return null;

            const checkedRisks = risks
              .filter((r) => checks[r.id] && (checks[r.id].status === "CONFIRMED" || checks[r.id].status === "NOT_FOUND"))
              .map((r) => ({
                ...r,
                status: checks[r.id].status as string,
                notes: checks[r.id].notes,
              }));

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
                      ? { bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", text: "text-red-600", label: "Observed" }
                      : r.status === "NOT_FOUND"
                      ? { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500", text: "text-green-600", label: "Not Observed" }
                      : r.status === "UNABLE_TO_INSPECT"
                      ? { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400", text: "text-amber-600", label: "Unable to Inspect" }
                      : { bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-400", text: "text-gray-500", label: "Not Checked" };

                    return (
                      <div key={r.id} className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-md border text-xs",
                        statusStyle.bg, statusStyle.border,
                      )}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={cn("w-2 h-2 rounded-full shrink-0", statusStyle.dot)} />
                          <span className="text-text-primary font-medium truncate">{r.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.status === "CONFIRMED" && r.cost && (
                            <span className="text-red-600 font-medium">
                              {formatCurrency(r.cost.low)} – {formatCurrency(r.cost.high)}
                            </span>
                          )}
                          <span className={cn("font-semibold", statusStyle.text)}>
                            {statusStyle.label}
                          </span>
                        </div>
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

          {/* Score breakdown — 4-area AI condition assessment with details */}
          {inspection.overallScore != null && (() => {
            const rawData = inspection.conditionRawData as Record<string, unknown> | null;
            const areas = [
              { label: "Exterior Body", key: "exteriorBody", score: inspection.exteriorBodyScore, weight: "30%" },
              { label: "Interior", key: "interior", score: inspection.interiorScore, weight: "15%" },
              { label: "Mechanical / Visual", key: "mechanicalVisual", score: inspection.mechanicalVisualScore, weight: "35%" },
              { label: "Underbody / Frame", key: "underbodyFrame", score: inspection.underbodyFrameScore, weight: "20%" },
            ];

            return (
              <div className="mt-4 space-y-3">
                {areas.map((item) => {
                  const detail = rawData?.[item.key] as { summary?: string; keyObservations?: string[]; concerns?: string[]; scoreJustification?: string } | undefined;
                  return (
                    <div key={item.label} className="rounded-lg border border-border-default p-3">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-semibold text-text-primary">{item.label} ({item.weight})</span>
                        <span className={cn(
                          "text-sm font-bold",
                          (item.score || 0) >= 7 ? "text-green-600" :
                          (item.score || 0) >= 5 ? "text-amber-600" : "text-red-600"
                        )}>{item.score ?? "—"}/10</span>
                      </div>
                      <Progress value={((item.score || 0) / 10) * 100} size="sm" color={
                        (item.score || 0) >= 7 ? "green" :
                        (item.score || 0) >= 5 ? "yellow" : "red"
                      } />
                      {detail && (
                        <div className="mt-2 space-y-1">
                          {detail.summary && (
                            <p className="text-xs text-text-secondary">{detail.summary}</p>
                          )}
                          {detail.keyObservations && detail.keyObservations.length > 0 && (
                            <ul className="text-[11px] text-text-tertiary space-y-0.5 mt-1">
                              {detail.keyObservations.slice(0, 3).map((obs, i) => (
                                <li key={i}>+ {obs}</li>
                              ))}
                            </ul>
                          )}
                          {detail.concerns && detail.concerns.length > 0 && (
                            <ul className="text-[11px] text-amber-700 space-y-0.5">
                              {detail.concerns.slice(0, 3).map((c, i) => (
                                <li key={i}>- {c}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Total repair estimate */}
          {totalRepairHigh > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-[#fde8e8] border border-red-300">
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
            Additional Findings ({findings.length})
          </h3>
          {findings.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No issues found during inspection</p>
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((f) => (
                <div
                  key={f.id}
                  className={`p-4 rounded-xl border ${severityColor(f.severity)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-text-primary">{f.title}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        f.severity === "CRITICAL" ? "danger" :
                        f.severity === "MAJOR" ? "warning" : "default"
                      }>
                        {f.severity}
                      </Badge>
                      <Badge>{f.category.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary">{f.description}</p>
                  {f.evidence && (
                    <p className="text-sm text-text-secondary mt-1 italic">Evidence: {f.evidence}</p>
                  )}
                  {(f.repairCostLow || f.repairCostHigh) && (
                    <p className="text-sm font-medium mt-2">
                      Estimated repair: {formatCurrency(f.repairCostLow || 0)} – {formatCurrency(f.repairCostHigh || 0)}
                    </p>
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
              ))}
            </div>
          )}
        </div>

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
