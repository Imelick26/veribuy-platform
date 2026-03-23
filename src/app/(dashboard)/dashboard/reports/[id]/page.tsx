"use client";

import { use, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, severityColor } from "@/lib/utils";
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
  const { vehicle, findings, media, inspector } = inspection;

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

        {/* Report Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-4 sm:px-8 py-5 sm:py-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-brand-200 text-sm font-medium">VeriBuy Inspection Report</p>
              <h2 className="text-xl sm:text-2xl font-bold mt-1">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
              <p className="text-brand-200 font-mono text-xs sm:text-sm mt-1">VIN: {vehicle.vin}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-brand-200 text-sm">Report #{report.number}</p>
              <p className="text-brand-200 text-sm">{formatDate(report.generatedAt)}</p>
              {inspector && <p className="text-brand-200 text-sm mt-1">Inspector: {inspector.name}</p>}
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
              <p className="text-xs text-text-secondary mt-1">Critical/Major</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-surface-overlay">
              <p className="text-4xl font-bold text-text-secondary">{moderateCount}</p>
              <p className="text-xs text-text-secondary mt-1">Moderate</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-[#fce8f3]">
              <p className="text-4xl font-bold text-brand-700">{minorCount}</p>
              <p className="text-xs text-text-secondary mt-1">Minor/Info</p>
            </div>
          </div>

          {/* Score breakdown */}
          {inspection.overallScore != null && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: "Structural / Drivetrain", score: inspection.structuralScore, weight: "45%" },
                { label: "Cosmetic / Interior", score: inspection.cosmeticScore, weight: "30%" },
                { label: "Electronics / Software", score: inspection.electronicsScore, weight: "25%" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary">{item.label}</span>
                    <span className="font-medium">{item.score}/100</span>
                  </div>
                  <Progress value={item.score || 0} size="sm" color={
                    (item.score || 0) >= 70 ? "green" :
                    (item.score || 0) >= 50 ? "yellow" : "red"
                  } />
                </div>
              ))}
            </div>
          )}

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

        {/* Market Analysis */}
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

        {/* Findings */}
        <div className="px-4 sm:px-8 py-5 sm:py-6 border-b border-border-default">
          <h3 className="text-lg font-bold text-text-primary mb-4">
            <Wrench className="inline h-5 w-5 mr-1" />
            Findings ({findings.length})
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
