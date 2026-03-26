"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CaptureGrid } from "./CaptureGrid";
import { GUIDED_SHOTS } from "./GuidedCapture";
import {
  ShieldAlert,
  Camera,
  Sparkles,
  Clock,
  BarChart3,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Download,
  Car,
  Search,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { MarketAnalysisSection, type MarketAnalysisData } from "@/components/report/MarketAnalysisSection";
import type { AggregatedRiskProfile, AggregatedRisk, RiskCheckStatus, AIAnalysisResult, OverallConditionResult } from "@/types/risk";
import type { InspectionConfidence } from "@/lib/confidence";

interface StepPanelProps {
  activeStep: string;
  riskProfile: AggregatedRiskProfile | null | undefined;
  inspection: {
    id: string;
    media: Array<{ captureType: string | null; url: string | null; thumbnailUrl: string | null }>;
    report?: { id: string; pdfUrl?: string | null; number: string } | null;
    vehicleHistory?: {
      provider: string;
      titleStatus: string;
      accidentCount: number;
      ownerCount: number;
      serviceRecords: number;
      structuralDamage: boolean;
      floodDamage: boolean;
      openRecallCount: number;
    } | null;
    marketAnalysis?: {
      baselinePrice: number;
      adjustedPrice: number;
      recommendation: string;
      strongBuyMax: number | null;
      fairBuyMax: number | null;
      estRetailPrice: number | null;
      estReconCost: number | null;
      estGrossProfit: number | null;
      comparables: unknown;
    } | null;
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
  // Guided Capture
  onStartGuidedCapture?: () => void;
  // AI Analysis
  onRunAIAnalysis?: () => void;
  isRunningAIAnalysis?: boolean;
  aiAnalysisResults?: AIAnalysisResult[];
  overallConditionResult?: OverallConditionResult;
  // Condition Scan
  onRunConditionScan?: () => void;
  isRunningConditionScan?: boolean;
  conditionScanComplete?: boolean;
  // VIN Confirm
  onConfirmVin?: (vin: string) => void;
  isConfirmingVin?: boolean;
  detectedVin?: string | null;
  isDetectingVin?: boolean;
  // Vehicle History
  onFetchHistory?: () => void;
  isFetchingHistory?: boolean;
  // Market Analysis
  onFetchMarket?: () => void;
  isFetchingMarket?: boolean;
  // Report
  onViewReport?: () => void;
  // Confidence
  inspectionConfidence?: InspectionConfidence | null;
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
  onStartGuidedCapture,
  onRunAIAnalysis,
  isRunningAIAnalysis,
  aiAnalysisResults,
  overallConditionResult,
  onRunConditionScan,
  isRunningConditionScan,
  conditionScanComplete,
  onConfirmVin,
  isConfirmingVin,
  detectedVin,
  isDetectingVin,
  onFetchHistory,
  isFetchingHistory,
  onFetchMarket,
  isFetchingMarket,
  onViewReport,
  inspectionConfidence,
}: StepPanelProps) {
  // Count captured photos for gating
  const capturedPhotos = (inspection.media || []).filter(
    (m) => m.url && m.captureType && GUIDED_SHOTS.some((s) => s.type === m.captureType)
  ).length;
  const allPhotosCaptured = capturedPhotos >= GUIDED_SHOTS.length;

  switch (activeStep) {
    // ─── NEW WORKFLOW: MEDIA_CAPTURE (first step) ───────────────────
    case "MEDIA_CAPTURE":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-brand-600" />
              <CardTitle>Photo Capture</CardTitle>
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
            onStartGuidedCapture={onStartGuidedCapture || (() => {})}
          />
          <div className="mt-4 pt-4 border-t border-border-default">
            {!allPhotosCaptured && (
              <p className="text-xs text-text-tertiary text-center mb-2">
                {capturedPhotos}/{GUIDED_SHOTS.length} photos captured — all {GUIDED_SHOTS.length} required to continue
              </p>
            )}
            <Button
              onClick={() => onAdvanceStep("MEDIA_CAPTURE")}
              loading={isAdvancingStep}
              disabled={!allPhotosCaptured}
              className={cn(
                "w-full",
                allPhotosCaptured
                  ? "bg-brand-gradient text-white"
                  : "bg-surface-overlay text-text-tertiary cursor-not-allowed"
              )}
            >
              Continue to VIN Confirmation
            </Button>
          </div>
        </Card>
      );

    // ─── VIN_CONFIRM ────────────────────────────────────────────────
    case "VIN_CONFIRM":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-brand-600" />
              <CardTitle>VIN Confirmation</CardTitle>
            </div>
          </CardHeader>
          {/* Always show the VIN input — OCR pre-fills if successful */}
          <VinConfirmPanel
            detectedVin={detectedVin || ""}
            onConfirm={onConfirmVin || (() => {})}
            isConfirming={isConfirmingVin || false}
            isDetectingVin={isDetectingVin || false}
          />
        </Card>
      );

    // ─── AI_CONDITION_SCAN ──────────────────────────────────────────
    case "AI_CONDITION_SCAN":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-600" />
              <CardTitle>AI Condition Assessment</CardTitle>
            </div>
          </CardHeader>

          {conditionScanComplete ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-[#dcfce7] border border-green-300">
                <CheckCircle className="h-6 w-6 text-green-700" />
                <div>
                  <p className="font-semibold text-green-700">Condition Assessment Complete</p>
                  <p className="text-sm text-green-600">4-area photo analysis finished. Scores saved.</p>
                </div>
              </div>

              {/* Unexpected findings preview */}
              {overallConditionResult && overallConditionResult.unexpectedFindings.length > 0 && (
                <div className="p-3 rounded-lg bg-[#fde8e8] border border-red-300">
                  <p className="text-xs font-bold text-red-700 mb-1">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    {overallConditionResult.unexpectedFindings.length} unexpected issue(s) found in photos
                  </p>
                  {overallConditionResult.unexpectedFindings.slice(0, 3).map((uf, i) => (
                    <p key={i} className="text-xs text-red-600">• {uf.title}</p>
                  ))}
                </div>
              )}

              <Button
                onClick={() => onAdvanceStep("AI_CONDITION_SCAN")}
                loading={isAdvancingStep}
                className="w-full bg-brand-gradient text-white"
              >
                Continue to Risk Inspection
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Sparkles className="h-6 w-6 mx-auto text-brand-600 mb-3" />
                <h4 className="font-semibold text-text-primary mb-1">AI Photo Condition Scan</h4>
                <p className="text-sm text-text-secondary max-w-md mx-auto">
                  GPT-4o Vision will analyze your {capturedPhotos} photos across 4 areas: exterior body,
                  interior, mechanical, and underbody. It will also scan for unexpected issues.
                </p>
              </div>

              {isRunningConditionScan ? (
                <div className="text-center py-4">
                  <Loader2 className="h-8 w-8 text-brand-600 animate-spin mx-auto mb-3" />
                  <p className="font-semibold text-text-primary mb-1">Scanning Photos...</p>
                  <p className="text-xs text-text-tertiary">
                    Running 4 parallel AI assessments + unexpected issue scan...
                  </p>
                </div>
              ) : (
                <Button
                  onClick={onRunConditionScan}
                  className="w-full bg-brand-gradient text-white hover:opacity-90"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Run Condition Scan
                  </span>
                </Button>
              )}
            </div>
          )}
        </Card>
      );

    // ─── RISK_INSPECTION (new name for risk review + AI analysis) ───
    case "RISK_INSPECTION":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-brand-600" />
              <CardTitle>Risk Inspection</CardTitle>
            </div>
          </CardHeader>

          {!riskProfile ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-3" />
              <h4 className="font-semibold text-text-primary mb-1">Building Risk Profile</h4>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Querying NHTSA databases and generating inspection checklist...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="text-center p-3 rounded-lg bg-surface-sunken">
                  <p className="text-2xl font-bold text-text-primary">{riskProfile.aggregatedRisks.length}</p>
                  <p className="text-xs text-text-secondary">Total Risks</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#fde8e8]">
                  <p className="text-2xl font-bold text-red-700">
                    {riskProfile.aggregatedRisks.filter((r) => r.severity === "CRITICAL").length}
                  </p>
                  <p className="text-xs text-text-secondary">Critical</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#fde8e8]">
                  <p className="text-2xl font-bold text-red-700">
                    {riskProfile.nhtsaData.recallCount}
                  </p>
                  <p className="text-xs text-text-secondary">Recalls</p>
                </div>
              </div>

              {/* NHTSA data summary */}
              <div className="p-3 rounded-lg bg-[#fce8f3] border border-brand-300 text-xs text-brand-700">
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
                  <div className="p-3 rounded-lg bg-[#fde8e8] border border-red-300">
                    <p className="text-xs font-semibold text-red-700 mb-1">
                      <AlertTriangle className="inline h-3 w-3 mr-1" />
                      Total Potential Repair Exposure
                    </p>
                    <p className="text-lg font-bold text-red-700">
                      {formatCurrency(totalLow)} – {formatCurrency(totalHigh)}
                    </p>
                  </div>
                ) : null;
              })()}

              {/* Assessment Confidence */}
              {inspectionConfidence && inspectionConfidence.overall > 0 && (
                <div className="p-3 rounded-lg bg-surface-sunken border border-border-default">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-text-secondary">Assessment Confidence</span>
                    <span className="text-xs font-bold text-text-primary">{Math.round(inspectionConfidence.overall * 100)}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        inspectionConfidence.overall >= 0.7 ? "bg-green-500" :
                        inspectionConfidence.overall >= 0.45 ? "bg-brand-400" : "bg-gray-500"
                      )}
                      style={{ width: `${inspectionConfidence.overall * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1.5">{inspectionConfidence.summary}</p>
                </div>
              )}

              <Button
                onClick={() => onAdvanceStep("RISK_INSPECTION")}
                loading={isAdvancingStep}
                className="w-full bg-brand-gradient text-white"
              >
                Continue to Vehicle History
              </Button>
            </div>
          )}
        </Card>
      );

    // ─── LEGACY: RISK_REVIEW ────────────────────────────────────────
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-3" />
              <h4 className="font-semibold text-text-primary mb-1">Building Risk Profile</h4>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Querying NHTSA databases and generating inspection checklist...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="text-center p-3 rounded-lg bg-surface-sunken">
                  <p className="text-2xl font-bold text-text-primary">{riskProfile.aggregatedRisks.length}</p>
                  <p className="text-xs text-text-secondary">Total Risks</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#fde8e8]">
                  <p className="text-2xl font-bold text-red-700">
                    {riskProfile.aggregatedRisks.filter((r) => r.severity === "CRITICAL").length}
                  </p>
                  <p className="text-xs text-text-secondary">Critical</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#fde8e8]">
                  <p className="text-2xl font-bold text-red-700">
                    {riskProfile.nhtsaData.recallCount}
                  </p>
                  <p className="text-xs text-text-secondary">Recalls</p>
                </div>
              </div>
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

    // ─── LEGACY: AI_ANALYSIS ────────────────────────────────────────
    case "AI_ANALYSIS":
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-600" />
              <CardTitle>AI Photo Analysis</CardTitle>
            </div>
          </CardHeader>

          {!aiAnalysisResults || aiAnalysisResults.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Sparkles className="h-6 w-6 mx-auto text-brand-600 mb-3" />
                <h4 className="font-semibold text-text-primary mb-1">AI-Powered Condition Analysis</h4>
                <p className="text-sm text-text-secondary mb-1 max-w-md mx-auto">
                  Our AI will analyze your captured photos against each identified risk and scan for unexpected issues.
                </p>
              </div>

              {(() => {
                const photoCount = (inspection.media || []).filter(m => m.url).length;
                const riskCount = riskProfile?.aggregatedRisks.length || 0;
                const isDisabled = !riskProfile || photoCount === 0;
                return (
                  <>
                    <div className={`p-3 rounded-lg border ${photoCount > 0 ? "bg-[#fce8f3] border-brand-300" : "bg-surface-overlay border-border-strong"}`}>
                      <p className={`text-xs font-semibold mb-1 ${photoCount > 0 ? "text-brand-700" : "text-text-secondary"}`}>
                        <Camera className="inline h-3 w-3 mr-1" />
                        {photoCount} photos captured
                      </p>
                      {photoCount === 0 ? (
                        <p className="text-xs text-text-tertiary">Capture photos first.</p>
                      ) : (
                        <p className="text-xs text-brand-600">{riskCount} risk items + issue scan</p>
                      )}
                    </div>
                    <Button
                      onClick={onRunAIAnalysis}
                      loading={isRunningAIAnalysis}
                      disabled={isDisabled}
                      className={`w-full ${isDisabled ? "bg-surface-overlay text-text-tertiary cursor-not-allowed" : "bg-brand-gradient text-white hover:opacity-90"}`}
                    >
                      {isRunningAIAnalysis ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" /> Run AI Analysis
                        </span>
                      )}
                    </Button>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Unexpected findings from scan */}
              {overallConditionResult && overallConditionResult.unexpectedFindings.length > 0 && (
                <div className="p-4 rounded-lg border border-red-300 bg-[#fde8e8]">
                  <p className="text-xs font-bold text-red-700 mb-1">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    Unexpected Issues ({overallConditionResult.unexpectedFindings.length})
                  </p>
                  {overallConditionResult.unexpectedFindings.map((uf, i) => (
                    <div key={i} className="p-2 mt-1 rounded bg-white/40 border border-red-200 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-red-700">{uf.title}</span>
                        <Badge variant="danger">{uf.severity}</Badge>
                      </div>
                      <p className="text-red-600 mt-0.5">{uf.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Results summary */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="text-center p-3 rounded-lg bg-[#fde8e8]">
                  <p className="text-2xl font-bold text-red-700">
                    {aiAnalysisResults.filter(r => r.verdict === "CONFIRMED").length}
                  </p>
                  <p className="text-xs text-text-secondary">Confirmed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#dcfce7]">
                  <p className="text-2xl font-bold text-green-700">
                    {aiAnalysisResults.filter(r => r.verdict === "CLEARED").length}
                  </p>
                  <p className="text-xs text-text-secondary">Cleared</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface-overlay">
                  <p className="text-2xl font-bold text-text-secondary">
                    {aiAnalysisResults.filter(r => r.verdict === "INCONCLUSIVE").length}
                  </p>
                  <p className="text-xs text-text-secondary">Inconclusive</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border-default">
                <Button
                  onClick={() => onAdvanceStep("AI_ANALYSIS")}
                  loading={isAdvancingStep}
                  className="w-full bg-brand-gradient text-white"
                >
                  Continue to Vehicle History
                </Button>
              </div>
            </div>
          )}
        </Card>
      );

    case "VEHICLE_HISTORY": {
      const history = inspection.vehicleHistory;
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-600" />
              <CardTitle>Vehicle History</CardTitle>
            </div>
          </CardHeader>

          {!history ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Clock className="h-6 w-6 mx-auto text-brand-600 mb-3" />
                <h4 className="font-semibold text-text-primary mb-1">Pull Vehicle History Report</h4>
                <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">
                  Fetch recall status from NHTSA and initialize vehicle history.
                </p>
              </div>
              <Button
                onClick={onFetchHistory}
                loading={isFetchingHistory}
                className="w-full bg-brand-gradient text-white hover:opacity-90"
              >
                {isFetchingHistory ? "Fetching History..." : "Fetch Vehicle History"}
              </Button>
              <div className="text-center">
                <button
                  onClick={() => onAdvanceStep("VEHICLE_HISTORY")}
                  className="text-xs text-text-tertiary hover:text-text-secondary underline"
                >
                  Skip this step
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={cn(
                "p-3 rounded-lg border",
                history.titleStatus === "CLEAN"
                  ? "bg-[#dcfce7] border-green-300"
                  : "bg-[#fde8e8] border-red-300"
              )}>
                <div className="flex items-center gap-2">
                  {history.titleStatus === "CLEAN" ? (
                    <CheckCircle className="h-5 w-5 text-green-700" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-700" />
                  )}
                  <span className={cn(
                    "font-semibold text-sm",
                    history.titleStatus === "CLEAN" ? "text-green-700" : "text-red-700"
                  )}>
                    Title: {history.titleStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Owners", value: history.ownerCount, icon: "👤" },
                  { label: "Accidents", value: history.accidentCount, icon: history.accidentCount > 0 ? "⚠️" : "✅" },
                  { label: "Service Records", value: history.serviceRecords, icon: "🔧" },
                  { label: "Open Recalls", value: history.openRecallCount, icon: history.openRecallCount > 0 ? "🔴" : "✅" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-surface-sunken text-sm">
                    <span>{item.icon}</span>
                    <div>
                      <p className="font-semibold text-text-primary">{item.value}</p>
                      <p className="text-xs text-text-secondary">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {(history.structuralDamage || history.floodDamage) && (
                <div className="p-3 rounded-lg bg-[#fde8e8] border border-red-300">
                  <p className="text-xs font-semibold text-red-700 mb-1">
                    <AlertTriangle className="inline h-3 w-3 mr-1" /> Damage Flags
                  </p>
                  {history.structuralDamage && <p className="text-xs text-red-700">Structural damage reported</p>}
                  {history.floodDamage && <p className="text-xs text-red-700">Flood damage reported</p>}
                </div>
              )}

              <p className="text-[10px] text-text-tertiary text-center">
                Data provided by {history.provider}
              </p>

              <Button
                onClick={() => onAdvanceStep("VEHICLE_HISTORY")}
                loading={isAdvancingStep}
                className="w-full bg-brand-gradient text-white mt-2"
              >
                Continue to Market Analysis
              </Button>
            </div>
          )}
        </Card>
      );
    }

    case "MARKET_ANALYSIS": {
      const market = inspection.marketAnalysis;
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              <CardTitle>Market Analysis</CardTitle>
            </div>
          </CardHeader>

          {!market ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <BarChart3 className="h-6 w-6 mx-auto text-brand-600 mb-3" />
                <h4 className="font-semibold text-text-primary mb-1">Run Market Analysis</h4>
                <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">
                  Fetch comparable listings and estimate fair market value adjusted for vehicle condition.
                </p>
              </div>
              <Button
                onClick={onFetchMarket}
                loading={isFetchingMarket}
                className="w-full bg-brand-gradient text-white hover:opacity-90"
              >
                {isFetchingMarket ? "Analyzing Market..." : "Run Market Analysis"}
              </Button>
              <div className="text-center">
                <button
                  onClick={() => onAdvanceStep("MARKET_ANALYSIS")}
                  className="text-xs text-text-tertiary hover:text-text-secondary underline"
                >
                  Skip this step
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <MarketAnalysisSection
                data={market as unknown as MarketAnalysisData}
                compact
              />

              <Button
                onClick={() => onAdvanceStep("MARKET_ANALYSIS")}
                loading={isAdvancingStep}
                className="w-full bg-brand-gradient text-white mt-2"
              >
                Continue to Report Generation
              </Button>
            </div>
          )}
        </Card>
      );
    }

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
              <div className="flex items-center gap-3 p-4 rounded-lg bg-[#dcfce7] border border-green-300">
                <CheckCircle className="h-6 w-6 text-green-700" />
                <div>
                  <p className="font-semibold text-green-700">Report Generated</p>
                  <p className="text-sm text-green-700">{inspection.report.number}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-brand-gradient text-white hover:opacity-90"
                  onClick={onViewReport}
                >
                  <FileText className="h-4 w-4" /> View Report
                </Button>
                {inspection.report.pdfUrl && (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => window.open(inspection.report!.pdfUrl!, "_blank")}
                  >
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-6 w-6 mx-auto text-brand-600 mb-3" />
              <h4 className="font-semibold text-text-primary mb-1">Ready to Generate Report</h4>
              <p className="text-sm text-text-secondary mb-4">
                Compile all findings, media, and risk data into a comprehensive inspection report.
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

// ─── VIN Confirmation sub-component ─────────────────────────────────
import { useState as useStateLocal } from "react";

function VinConfirmPanel({
  detectedVin,
  onConfirm,
  isConfirming,
  isDetectingVin,
}: {
  detectedVin: string;
  onConfirm: (vin: string) => void;
  isConfirming: boolean;
  isDetectingVin: boolean;
}) {
  const [vin, setVin] = useStateLocal(detectedVin);
  const [hasUserEdited, setHasUserEdited] = useStateLocal(false);

  // Update VIN when OCR detection completes (only if user hasn't started typing)
  const prevDetectedRef = useStateLocal(detectedVin);
  if (detectedVin && detectedVin !== prevDetectedRef[0] && !hasUserEdited) {
    setVin(detectedVin);
    prevDetectedRef[1](detectedVin);
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <Car className="h-6 w-6 mx-auto text-brand-600 mb-3" />
        <h4 className="font-semibold text-text-primary mb-1">Enter Vehicle VIN</h4>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Type the 17-character VIN from the door jamb sticker or dashboard plate.
        </p>
      </div>

      {/* OCR status indicator */}
      {isDetectingVin && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-sunken text-xs text-text-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
          <span>Scanning door jamb photo for VIN...</span>
        </div>
      )}
      {!isDetectingVin && detectedVin && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#dcfce7] text-xs text-green-700">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>VIN detected from photo — please verify it&apos;s correct</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">VIN Number</label>
        <input
          type="text"
          value={vin}
          onChange={(e) => {
            setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ""));
            setHasUserEdited(true);
          }}
          maxLength={17}
          placeholder="e.g. 1FTHX26F7TEA10490"
          className="w-full px-3 py-2.5 rounded-lg border border-border-strong bg-surface-raised text-text-primary font-mono tracking-wider text-center text-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        {vin.length > 0 && vin.length < 17 && (
          <p className="text-xs text-text-tertiary mt-1">{vin.length}/17 characters</p>
        )}
      </div>

      <Button
        onClick={() => onConfirm(vin)}
        loading={isConfirming}
        disabled={vin.length !== 17}
        className={cn(
          "w-full",
          vin.length === 17
            ? "bg-brand-gradient text-white"
            : "bg-surface-overlay text-text-tertiary cursor-not-allowed"
        )}
      >
        {isConfirming ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Decoding VIN...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Confirm & Decode VIN
          </span>
        )}
      </Button>
    </div>
  );
}
