"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CaptureGrid } from "./CaptureGrid";
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
  // AI Analysis
  onRunAIAnalysis?: () => void;
  isRunningAIAnalysis?: boolean;
  aiAnalysisResults?: AIAnalysisResult[];
  overallConditionResult?: OverallConditionResult;
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
  onRunAIAnalysis,
  isRunningAIAnalysis,
  aiAnalysisResults,
  overallConditionResult,
  onFetchHistory,
  isFetchingHistory,
  onFetchMarket,
  isFetchingMarket,
  onViewReport,
  inspectionConfidence,
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
              <ShieldAlert className="h-6 w-6 mx-auto text-brand-600 mb-3" />
              <h4 className="font-semibold text-text-primary mb-1">Ready to Analyze Vehicle Risks</h4>
              <p className="text-sm text-text-secondary mb-4 max-w-md mx-auto">
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
                <p className="text-xs text-text-tertiary mt-2">Fetching data from NHTSA databases...</p>
              )}
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
                  {inspectionConfidence.evidenceCoverage < 1 && (
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      {Math.round(inspectionConfidence.evidenceCoverage * 100)}% of checked items have photo evidence
                    </p>
                  )}
                </div>
              )}

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
          <div className="mt-4 pt-4 border-t border-border-default">
            <Button
              onClick={() => onAdvanceStep("MEDIA_CAPTURE")}
              loading={isAdvancingStep}
              className="w-full bg-brand-gradient text-white"
            >
              Continue to AI Analysis
            </Button>
          </div>
        </Card>
      );

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
                  Our AI will analyze your captured photos against each identified risk and perform a
                  general vehicle condition scan.
                </p>
                <p className="text-xs text-text-tertiary max-w-sm mx-auto">
                  Photos are sent to GPT-4o Vision for expert-level analysis.
                </p>
              </div>

              {/* Show captured media count */}
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
                        <p className="text-xs text-text-tertiary">
                          Capture photos in the Media Capture step before running analysis.
                        </p>
                      ) : (
                        <p className="text-xs text-brand-600">
                          {riskCount} risk items + general condition scan
                        </p>
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
                          <Loader2 className="h-4 w-4 animate-spin" /> Analyzing Photos...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" /> Run AI Analysis
                        </span>
                      )}
                    </Button>

                    {isRunningAIAnalysis && (
                      <p className="text-xs text-center text-text-tertiary">
                        Analyzing photos against {riskCount} risk items + general condition scan...
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Overall Condition Assessment */}
              {overallConditionResult && (
                <div className="p-4 rounded-lg border border-brand-300 bg-[#fce8f3]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase text-brand-700">Overall Condition</span>
                    <Badge variant={
                      overallConditionResult.overallGrade === "EXCELLENT" || overallConditionResult.overallGrade === "GOOD"
                        ? "success"
                        : overallConditionResult.overallGrade === "FAIR"
                          ? "warning"
                          : "danger"
                    }>
                      {overallConditionResult.overallGrade}
                    </Badge>
                  </div>
                  <p className="text-xs text-brand-600 mb-2">{overallConditionResult.summary}</p>

                  {/* Sub-grades */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="text-center p-2 rounded bg-surface-overlay">
                      <p className="text-xs font-semibold text-text-primary">{overallConditionResult.exteriorCondition}</p>
                      <p className="text-[10px] text-text-tertiary">Exterior</p>
                    </div>
                    {overallConditionResult.engineBayCondition && (
                      <div className="text-center p-2 rounded bg-surface-overlay">
                        <p className="text-xs font-semibold text-text-primary">{overallConditionResult.engineBayCondition}</p>
                        <p className="text-[10px] text-text-tertiary">Engine Bay</p>
                      </div>
                    )}
                  </div>

                  {/* Unexpected findings */}
                  {overallConditionResult.unexpectedFindings.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <p className="text-[10px] font-bold uppercase text-red-700">
                        Unexpected Issues ({overallConditionResult.unexpectedFindings.length})
                      </p>
                      {overallConditionResult.unexpectedFindings.map((uf, i) => (
                        <div key={i} className="p-2 rounded bg-[#fde8e8] border border-red-200 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-red-700">{uf.title}</span>
                            <Badge variant="danger">{uf.severity}</Badge>
                          </div>
                          <p className="text-red-600 mt-0.5">{uf.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
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

              {/* Per-risk results */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {aiAnalysisResults.map((result) => {
                  const risk = riskProfile?.aggregatedRisks.find(r => r.id === result.riskId);
                  return (
                    <div
                      key={result.riskId}
                      className={cn(
                        "p-3 rounded-lg border text-sm",
                        result.verdict === "CONFIRMED"
                          ? "border-red-300 bg-[#fde8e8]"
                          : result.verdict === "CLEARED"
                            ? "border-green-300 bg-[#dcfce7]"
                            : "border-border-strong bg-surface-overlay"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-text-primary">
                          {risk?.title || result.riskId}
                        </span>
                        <Badge
                          variant={
                            result.verdict === "CONFIRMED" ? "danger" :
                            result.verdict === "CLEARED" ? "success" : "warning"
                          }
                        >
                          {result.verdict}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-secondary">{result.explanation}</p>

                      {/* Visual Observations */}
                      {result.visualObservations && result.visualObservations.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] font-bold uppercase text-text-tertiary">Observations</p>
                          <ul className="text-xs text-text-secondary list-disc list-inside space-y-0.5">
                            {result.visualObservations.map((obs, i) => (
                              <li key={i}>{obs}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Observed Condition + Suggested Action */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1.5 flex-1 rounded-full bg-surface-sunken overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              result.confidence > 0.7 ? "bg-green-500" :
                              result.confidence > 0.4 ? "bg-brand-400" : "bg-red-500"
                            )}
                            style={{ width: `${result.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-text-tertiary">
                          {Math.round(result.confidence * 100)}%
                        </span>
                        {result.observedCondition && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            result.observedCondition === "GOOD" ? "bg-[#dcfce7] text-green-700" :
                            result.observedCondition === "FAIR" ? "bg-surface-overlay text-text-secondary" :
                            result.observedCondition === "WORN" ? "bg-[#fce8f3] text-brand-700" :
                            "bg-[#fde8e8] text-red-700"
                          )}>
                            {result.observedCondition}
                          </span>
                        )}
                      </div>

                      {/* Suggested Action */}
                      {result.suggestedAction && (
                        <p className="text-[10px] text-text-tertiary mt-1 italic">
                          {result.suggestedAction}
                        </p>
                      )}
                    </div>
                  );
                })}
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
                  Fetch recall status from NHTSA and initialize vehicle history for this inspection.
                </p>
              </div>
              <Button
                onClick={onFetchHistory}
                loading={isFetchingHistory}
                className="w-full bg-brand-gradient text-white hover:opacity-90"
              >
                {isFetchingHistory ? "Fetching History..." : "Fetch Vehicle History (~$5)"}
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
              {/* Title status */}
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

              {/* Key facts */}
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

              {/* Damage flags */}
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
