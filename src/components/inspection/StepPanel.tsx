"use client";

import { useState } from "react";
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
  CheckCircle2,
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
    odometer?: number | null;
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
  // Odometer confirm
  onConfirmOdometer?: (mileage: number) => void;
  isConfirmingOdometer?: boolean;
  // Vehicle History
  onFetchHistory?: () => void;
  isFetchingHistory?: boolean;
  // Market Analysis
  onFetchMarket?: () => void;
  isFetchingMarket?: boolean;
  completionPhase?: "history" | "market" | "finalizing" | null;
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
  onConfirmOdometer,
  isConfirmingOdometer,
  onFetchHistory,
  isFetchingHistory,
  onFetchMarket,
  isFetchingMarket,
  completionPhase,
  onViewReport,
  inspectionConfidence,
}: StepPanelProps) {
  // Count captured photos for gating — only CONFIRMED uploads count
  const capturedPhotos = (inspection.media || []).filter(
    (m) => m.url && m.captureType
      && GUIDED_SHOTS.some((s) => s.type === m.captureType)
      && ((m as { uploadStatus?: string }).uploadStatus || "CONFIRMED") === "CONFIRMED"
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
              uploadStatus: (m as { uploadStatus?: string }).uploadStatus || "CONFIRMED",
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

              {/* Odometer confirmation */}
              <OdometerConfirmRow
                currentOdometer={inspection.odometer}
                onConfirm={onConfirmOdometer}
                isConfirming={isConfirmingOdometer}
              />

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
            <div>
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
                    {riskProfile.aggregatedRisks.filter((r) => r.severity === "MAJOR").length}
                  </p>
                  <p className="text-xs text-text-secondary">Major</p>
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

    case "VEHICLE_HISTORY":
      // Vehicle history is now auto-fetched as part of "Complete Inspection"
      // (triggered from the MARKET_ANALYSIS step). Skip to market analysis.
      return null;

    case "MARKET_ANALYSIS": {
      const market = inspection.marketAnalysis;
      return (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              <CardTitle>Complete Inspection</CardTitle>
            </div>
          </CardHeader>

          {completionPhase ? (
            // Multi-step progress during auto-completion chain
            <div className="space-y-3 py-6 px-4">
              <div className="flex items-center gap-3">
                {completionPhase === "history" ? (
                  <div className="spinner-gradient h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
                )}
                <span className={cn("text-sm", completionPhase === "history" ? "text-text-primary font-medium" : "text-text-secondary")}>
                  Fetching vehicle history
                </span>
              </div>
              <div className="flex items-center gap-3">
                {completionPhase === "market" ? (
                  <div className="spinner-gradient h-4 w-4 shrink-0" />
                ) : completionPhase === "finalizing" ? (
                  <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-border-default shrink-0" />
                )}
                <span className={cn("text-sm", completionPhase === "market" ? "text-text-primary font-medium" : completionPhase === "finalizing" ? "text-text-secondary" : "text-text-tertiary")}>
                  Running market analysis
                </span>
              </div>
              <div className="flex items-center gap-3">
                {completionPhase === "finalizing" ? (
                  <div className="spinner-gradient h-4 w-4 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-border-default shrink-0" />
                )}
                <span className={cn("text-sm", completionPhase === "finalizing" ? "text-text-primary font-medium" : "text-text-tertiary")}>
                  Redirecting to vehicle dashboard
                </span>
              </div>
            </div>
          ) : !market ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <BarChart3 className="h-6 w-6 mx-auto text-brand-600 mb-3" />
                <h4 className="font-semibold text-text-primary mb-1">Run Market Analysis & Valuation</h4>
                <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">
                  Fetch comparable listings and estimate fair acquisition price adjusted for vehicle condition, history, and recon costs.
                </p>
              </div>
              <Button
                onClick={onFetchMarket}
                loading={isFetchingMarket}
                className="w-full bg-brand-gradient text-white hover:opacity-90"
              >
                {isFetchingMarket ? "Running Market Analysis..." : "Complete Inspection"}
              </Button>
            </div>
          ) : (
            // Fallback: market data exists but auto-redirect didn't fire (e.g., page refresh)
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
                View in Vehicle Dashboard
              </Button>
            </div>
          )}
        </Card>
      );
    }

    case "REPORT_GENERATION":
      // Report generation is handled from the vehicle dashboard, not the inspection flow.
      // Auto-advance past this step silently.
      return null;

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

  // While OCR is running, show a prominent scanning state
  if (isDetectingVin) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="relative mx-auto w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-brand-200" />
            <div className="absolute inset-0 rounded-full border-4 border-brand-600 border-t-transparent animate-spin" />
            <Search className="absolute inset-0 m-auto h-6 w-6 text-brand-600" />
          </div>
          <h4 className="font-semibold text-text-primary mb-1">Reading VIN from Photo</h4>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Running OCR on your door jamb sticker photo to extract the VIN...
          </p>
        </div>
        <p className="text-xs text-center text-text-tertiary">
          This runs locally in your browser — no data sent to external servers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <Car className="h-6 w-6 mx-auto text-brand-600 mb-3" />
        <h4 className="font-semibold text-text-primary mb-1">
          {detectedVin ? "Verify Detected VIN" : "Enter Vehicle VIN"}
        </h4>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          {detectedVin
            ? "We read this VIN from your door jamb photo. Please verify it's correct before confirming."
            : "OCR couldn't read the VIN. Please type the 17-character VIN from the door jamb sticker."}
        </p>
      </div>

      {/* OCR result indicator */}
      {detectedVin && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#dcfce7] border border-green-200 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">VIN detected from photo — verify and confirm below</span>
        </div>
      )}
      {!detectedVin && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-caution-50 border border-caution-200 text-sm text-caution-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Couldn&apos;t read VIN from photo — please enter it manually</span>
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
          className={cn(
            "w-full px-3 py-2.5 rounded-lg border bg-surface-raised text-text-primary font-mono tracking-wider text-center text-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
            detectedVin && !hasUserEdited
              ? "border-green-400 bg-green-50"
              : "border-border-strong"
          )}
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

/* ------------------------------------------------------------------ */
/*  OdometerConfirmRow — inline odometer verify from AI OCR            */
/* ------------------------------------------------------------------ */

function OdometerConfirmRow({
  currentOdometer,
  onConfirm,
  isConfirming,
}: {
  currentOdometer?: number | null;
  onConfirm?: (mileage: number) => void;
  isConfirming?: boolean;
}) {
  const [editing, setEditing] = useState(!currentOdometer);
  const [value, setValue] = useState(currentOdometer ? String(currentOdometer) : "");
  const [confirmed, setConfirmed] = useState(false);

  // Already confirmed or saved from creation
  if (currentOdometer && !editing && !confirmed) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface-overlay border border-border-default">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-text-primary font-medium">
            {currentOdometer.toLocaleString()} mi
          </span>
          <span className="text-xs text-green-600">Odometer reading detected</span>
        </div>
        <button
          onClick={() => { setEditing(true); setValue(String(currentOdometer)); }}
          className="text-xs text-brand-600 hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-[#dcfce7] border border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700 font-medium">
          Odometer confirmed: {parseInt(value).toLocaleString()} mi
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-caution-50 border border-caution-200">
      <p className="text-xs font-semibold text-caution-700 mb-2">
        {currentOdometer ? "Verify Odometer Reading" : "Enter Odometer Reading"}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="e.g. 198432"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          className="flex-1 px-3 py-2 text-sm font-medium border border-caution-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <span className="text-xs text-text-tertiary">mi</span>
        <Button
          size="sm"
          disabled={!value || parseInt(value) <= 0 || isConfirming}
          onClick={() => {
            const mileage = parseInt(value);
            if (mileage > 0 && onConfirm) {
              onConfirm(mileage);
              setConfirmed(true);
              setEditing(false);
            }
          }}
          className="bg-brand-gradient text-white text-xs px-4"
        >
          {isConfirming ? "..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
