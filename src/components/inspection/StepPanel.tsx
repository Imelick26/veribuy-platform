"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CaptureGrid } from "./CaptureGrid";
import { RiskChecklist } from "./RiskChecklist";
import {
  ShieldAlert,
  Camera,
  Wrench,
  Clock,
  BarChart3,
  FileText,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AggregatedRiskProfile, AggregatedRisk, RiskCheckStatus } from "@/types/risk";

interface StepPanelProps {
  activeStep: string;
  riskProfile: AggregatedRiskProfile | null | undefined;
  inspection: {
    id: string;
    media: Array<{ captureType: string | null; url: string | null; thumbnailUrl: string | null }>;
    report?: { id: string; pdfUrl?: string | null; number: string } | null;
  };
  checkStatuses: Record<string, RiskCheckStatus>;
  onStartVerification: () => void;
  isEnriching: boolean;
  onMediaCapture: (captureType: string, file: File) => void;
  uploadingCaptureType: string | undefined;
  onCheckRisk: (riskId: string, status: RiskCheckStatus["status"], notes?: string) => void;
  onCreateFinding: (risk: AggregatedRisk) => void;
  onCaptureEvidence: (risk: AggregatedRisk) => void;
  onHighlightRisk: (riskId: string | null) => void;
  activeRiskId: string | null;
  onAdvanceStep: (step: string) => void;
  onGenerateReport: () => void;
  isGeneratingReport: boolean;
  isAdvancingStep: boolean;
}

export function StepPanel({
  activeStep,
  riskProfile,
  inspection,
  checkStatuses,
  onStartVerification,
  isEnriching,
  onMediaCapture,
  uploadingCaptureType,
  onCheckRisk,
  onCreateFinding,
  onCaptureEvidence,
  onHighlightRisk,
  activeRiskId,
  onAdvanceStep,
  onGenerateReport,
  isGeneratingReport,
  isAdvancingStep,
}: StepPanelProps) {
  switch (activeStep) {
    case "RISK_REVIEW":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-brand-600" />
              <CardTitle>Risk Analysis</CardTitle>
            </div>
          </CardHeader>

          {!riskProfile ? (
            <div className="text-center py-8">
              <ShieldAlert className="h-12 w-12 mx-auto text-brand-300 mb-3" />
              <h4 className="font-semibold text-gray-900 mb-1">Ready to Analyze Vehicle Risks</h4>
              <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                We&apos;ll query NHTSA for complaints, recalls, and investigations, then merge with our curated risk database to build a complete risk profile.
              </p>
              <Button
                onClick={onStartVerification}
                loading={isEnriching}
                className="bg-brand-gradient text-white hover:opacity-90"
              >
                <ShieldAlert className="h-4 w-4" />
                {isEnriching ? "Analyzing..." : "Start Verification"}
              </Button>
              {isEnriching && (
                <p className="text-xs text-gray-400 mt-2">Fetching data from NHTSA databases...</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-2xl font-bold text-gray-900">{riskProfile.aggregatedRisks.length}</p>
                  <p className="text-xs text-gray-500">Total Risks</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50">
                  <p className="text-2xl font-bold text-red-600">
                    {riskProfile.aggregatedRisks.filter((r) => r.severity === "CRITICAL").length}
                  </p>
                  <p className="text-xs text-gray-500">Critical</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-50">
                  <p className="text-2xl font-bold text-orange-600">
                    {riskProfile.nhtsaData.recallCount}
                  </p>
                  <p className="text-xs text-gray-500">Recalls</p>
                </div>
              </div>

              {/* NHTSA data summary */}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
                <p className="font-semibold mb-1">NHTSA Intelligence Summary</p>
                <ul className="space-y-0.5">
                  <li>{riskProfile.nhtsaData.complaintCount} owner complaints analyzed</li>
                  <li>{riskProfile.nhtsaData.recallCount} active recalls found</li>
                  <li>{riskProfile.nhtsaData.investigationCount} federal investigations</li>
                  {riskProfile.curatedProfileId && <li>Curated risk data available for this model</li>}
                </ul>
              </div>

              {/* Estimated repair cost range */}
              {riskProfile.aggregatedRisks.length > 0 && (() => {
                const totalLow = riskProfile.aggregatedRisks.reduce((s, r) => s + r.cost.low, 0);
                const totalHigh = riskProfile.aggregatedRisks.reduce((s, r) => s + r.cost.high, 0);
                return totalLow > 0 ? (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-700 mb-1">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />
                      Total Potential Repair Exposure
                    </p>
                    <p className="text-lg font-bold text-amber-800">
                      {formatCurrency(totalLow)} – {formatCurrency(totalHigh)}
                    </p>
                  </div>
                ) : null;
              })()}

              <Button
                onClick={() => onAdvanceStep("RISK_REVIEW")}
                loading={isAdvancingStep}
                className="w-full bg-brand-gradient text-white"
              >
                Continue to Media Capture
              </Button>
            </div>
          )}
        </Card>
      );

    case "MEDIA_CAPTURE":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-brand-600" />
              <CardTitle>Media Capture</CardTitle>
            </div>
          </CardHeader>
          <CaptureGrid
            inspectionId={inspection.id}
            captures={(inspection.media || []).filter((m) => m.captureType).map((m) => ({
              captureType: m.captureType as string,
              url: m.url || undefined,
              thumbnailUrl: m.thumbnailUrl || m.url || undefined,
            }))}
            onCapture={onMediaCapture}
            isUploading={uploadingCaptureType}
            risks={riskProfile?.aggregatedRisks}
          />
          <div className="mt-4 pt-4 border-t">
            <Button
              onClick={() => onAdvanceStep("MEDIA_CAPTURE")}
              loading={isAdvancingStep}
              className="w-full bg-brand-gradient text-white"
            >
              Continue to Physical Inspection
            </Button>
          </div>
        </Card>
      );

    case "PHYSICAL_INSPECTION":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-brand-600" />
              <CardTitle>Physical Inspection</CardTitle>
            </div>
          </CardHeader>
          {riskProfile && riskProfile.aggregatedRisks.length > 0 ? (
            <>
              <RiskChecklist
                risks={riskProfile.aggregatedRisks}
                checkStatuses={checkStatuses}
                onCheckRisk={onCheckRisk}
                onCreateFinding={onCreateFinding}
                onCaptureEvidence={onCaptureEvidence}
                onHighlightRisk={onHighlightRisk}
                activeRiskId={activeRiskId}
              />
              <div className="mt-4 pt-4 border-t">
                <Button
                  onClick={() => onAdvanceStep("PHYSICAL_INSPECTION")}
                  loading={isAdvancingStep}
                  className="w-full bg-brand-gradient text-white"
                >
                  Continue to Vehicle History
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Generate a risk profile first to start the inspection checklist.</p>
            </div>
          )}
        </Card>
      );

    case "VEHICLE_HISTORY":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-600" />
              <CardTitle>Vehicle History</CardTitle>
            </div>
          </CardHeader>
          <div className="text-center py-8 text-gray-400">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Vehicle history integration coming soon.</p>
            <p className="text-xs mt-1">Carfax/AutoCheck data will appear here.</p>
          </div>
          <Button
            onClick={() => onAdvanceStep("VEHICLE_HISTORY")}
            loading={isAdvancingStep}
            className="w-full bg-brand-gradient text-white mt-4"
          >
            Continue to Market Analysis
          </Button>
        </Card>
      );

    case "MARKET_ANALYSIS":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              <CardTitle>Market Analysis</CardTitle>
            </div>
          </CardHeader>
          <div className="text-center py-8 text-gray-400">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Market comps being developed separately.</p>
            <p className="text-xs mt-1">Pricing analysis will appear here.</p>
          </div>
          <Button
            onClick={() => onAdvanceStep("MARKET_ANALYSIS")}
            loading={isAdvancingStep}
            className="w-full bg-brand-gradient text-white mt-4"
          >
            Continue to Report Generation
          </Button>
        </Card>
      );

    case "REPORT_GENERATION":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-600" />
              <CardTitle>Report Generation</CardTitle>
            </div>
          </CardHeader>
          {inspection.report ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Report Generated</p>
                  <p className="text-sm text-green-600">{inspection.report.number}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => window.open(`/dashboard/reports/${inspection.report!.id}`, "_blank")}
                >
                  <FileText className="h-4 w-4" /> View Report
                </Button>
                {inspection.report.pdfUrl && (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => window.open(inspection.report!.pdfUrl!, "_blank")}
                  >
                    Download PDF
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-brand-300 mb-3" />
              <h4 className="font-semibold text-gray-900 mb-1">Ready to Generate Report</h4>
              <p className="text-sm text-gray-500 mb-4">
                This will compile all findings, media, and risk data into a comprehensive inspection report.
              </p>
              <Button
                onClick={onGenerateReport}
                loading={isGeneratingReport}
                className="bg-brand-gradient text-white hover:opacity-90"
              >
                <FileText className="h-4 w-4" />
                {isGeneratingReport ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          )}
        </Card>
      );

    default:
      return null;
  }
}
