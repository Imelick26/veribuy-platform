"use client";

import { use } from "react";
import { Badge } from "@/components/ui/Badge";

import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, severityColor } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Wrench, BarChart3 } from "lucide-react";
import { MarketAnalysisSection, type MarketAnalysisData } from "@/components/report/MarketAnalysisSection";
import { PhotoGallery } from "@/components/report/PhotoGallery";

export default function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data: report, isLoading, error } = trpc.report.viewShared.useQuery({ token });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (error || !report || !report.inspection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Report Not Found</h1>
          <p className="text-text-secondary">
            {error?.message || "This report link may have expired or is invalid."}
          </p>
        </div>
      </div>
    );
  }

  const { inspection, org } = report;
  const vehicle = inspection.vehicle;
  const { findings, media, inspector } = inspection;

  if (!vehicle) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Incomplete Report</h1>
          <p className="text-text-secondary">No vehicle linked to this inspection yet.</p>
        </div>
      </div>
    );
  }

  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const majorCount = findings.filter((f) => f.severity === "MAJOR").length;
  const totalRepairLow = findings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
  const totalRepairHigh = findings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);

  // AI recon cost — single source of truth
  const reconLog = (inspection as { aiValuationLogs?: Array<{ output: unknown }> })?.aiValuationLogs?.[0];
  const reconOutput = reconLog?.output as { totalReconCost?: number } | null;
  const aiReconCost = reconOutput?.totalReconCost || null;

  return (
    <div className="min-h-screen bg-surface-base py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-surface-raised rounded-xl border border-border-default shadow-sm overflow-hidden">

          {/* Report Header */}
          <div className="bg-brand-gradient px-4 sm:px-8 py-5 sm:py-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                {org && <p className="text-white/80 text-sm font-medium">{org.name}</p>}
                <p className="text-white/80 text-xs mt-0.5">Powered by VeriBuy</p>
                <h2 className="text-xl sm:text-2xl font-bold mt-2">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h2>
                <p className="text-white/80 font-mono text-xs sm:text-sm mt-1">VIN: {vehicle.vin}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-white/80 text-sm">Report #{report.number}</p>
                <p className="text-white/80 text-sm">{formatDate(report.generatedAt)}</p>
                {inspector && <p className="text-white/80 text-sm mt-1">Inspector: {inspector.name}</p>}
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
            <h3 className="text-lg font-bold text-text-primary mb-4">Executive Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-surface-sunken">
                <p className={`text-4xl font-bold ${
                  (inspection.overallScore || 0) >= 70 ? "text-green-700" :
                  (inspection.overallScore || 0) >= 50 ? "text-text-secondary" : "text-red-700"
                }`}>
                  {inspection.overallScore ?? "—"}
                </p>
                <p className="text-xs text-text-secondary mt-1">Overall Score</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#fde8e8]">
                <p className="text-4xl font-bold text-red-700">{criticalCount + majorCount}</p>
                <p className="text-xs text-text-secondary mt-1">Critical/Major Issues</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#fce8f3]">
                <p className="text-4xl font-bold text-brand-700">{findings.length}</p>
                <p className="text-xs text-text-secondary mt-1">Additional Findings</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#dcfce7]">
                <p className="text-4xl font-bold text-green-700">{media?.length || 0}</p>
                <p className="text-xs text-text-secondary mt-1">Photos</p>
              </div>
            </div>

            {totalRepairHigh > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-[#fde8e8] border border-red-300">
                <p className="text-sm font-semibold text-red-700">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Total Estimated Repair Cost: {formatCurrency(totalRepairLow)} – {formatCurrency(totalRepairHigh)}
                </p>
              </div>
            )}

            {inspection.overallScore != null && (
              <div className="mt-4 space-y-0">
                {[
                  { label: "Exterior Body", key: "exteriorBody", score: inspection.exteriorBodyScore },
                  { label: "Interior", key: "interior", score: inspection.interiorScore },
                  { label: "Mechanical / Visual", key: "mechanicalVisual", score: inspection.mechanicalVisualScore },
                  { label: "Underbody / Frame", key: "underbodyFrame", score: inspection.underbodyFrameScore },
                ].map((item) => {
                  const rawData = inspection.conditionRawData as Record<string, unknown> | null;
                  const detail = rawData?.[item.key] as { summary?: string; concerns?: string[] } | undefined;
                  const dotColor = (item.score || 0) >= 7 ? "bg-green-500" : (item.score || 0) >= 6 ? "bg-caution-400" : "bg-red-500";
                  return (
                    <div key={item.label} className="pb-4 border-b border-border-default last:border-0 last:pb-0 pt-4 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
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
            )}
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
                  <div key={f.id} className={`p-4 rounded-xl border ${severityColor(f.severity)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-text-primary">{f.title}</h4>
                      <Badge variant={
                        f.severity === "CRITICAL" ? "danger" :
                        f.severity === "MAJOR" ? "warning" : "default"
                      }>
                        {f.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-secondary">{f.description}</p>
                    {(f.repairCostLow || f.repairCostHigh) && (
                      <p className="text-sm font-medium mt-2">
                        Estimated repair: {formatCurrency(f.repairCostLow || 0)} – {formatCurrency(f.repairCostHigh || 0)}
                      </p>
                    )}
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
    </div>
  );
}
