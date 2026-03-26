"use client";

import { use, useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  FileText,
  Camera,
  Car,
  BarChart3,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { StepPanel } from "@/components/inspection/StepPanel";
import { RiskChecklist } from "@/components/inspection/RiskChecklist";
import { FindingFromRisk } from "@/components/inspection/FindingFromRisk";
import { ReportModal } from "@/components/inspection/ReportModal";
import { GuidedCapture } from "@/components/inspection/GuidedCapture";

// Dynamic import to avoid SSR issues with Three.js
const VehicleViewer = dynamic(
  () => import("@/components/vehicle/VehicleViewer").then((m) => ({ default: m.VehicleViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[280px] sm:h-[400px] bg-[#1a1f2e] rounded-xl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    ),
  }
);
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { computeInspectionConfidence } from "@/lib/confidence";
import type { AggregatedRisk, RiskCheckStatus } from "@/types/risk";


const STEP_META: Record<string, { label: string; icon: typeof CheckCircle }> = {
  // New workflow
  MEDIA_CAPTURE: { label: "Capture", icon: Camera },
  VIN_CONFIRM: { label: "VIN", icon: Car },
  AI_CONDITION_SCAN: { label: "Condition", icon: ShieldAlert },
  RISK_INSPECTION: { label: "Risk Check", icon: AlertTriangle },
  VEHICLE_HISTORY: { label: "History", icon: Clock },
  MARKET_ANALYSIS: { label: "Market", icon: BarChart3 },
  REPORT_GENERATION: { label: "Report", icon: FileText },
  // Deprecated — kept for backward compat with old inspections
  VIN_DECODE: { label: "VIN Decode", icon: Car },
  RISK_REVIEW: { label: "Risk Review", icon: AlertTriangle },
  AI_ANALYSIS: { label: "AI Analysis", icon: ShieldAlert },
};

const NEW_STEP_ORDER = [
  "MEDIA_CAPTURE", "VIN_CONFIRM", "AI_CONDITION_SCAN", "RISK_INSPECTION",
  "VEHICLE_HISTORY", "MARKET_ANALYSIS", "REPORT_GENERATION",
];

const LEGACY_STEP_ORDER = [
  "VIN_DECODE", "RISK_REVIEW", "MEDIA_CAPTURE", "AI_ANALYSIS",
  "VEHICLE_HISTORY", "MARKET_ANALYSIS", "REPORT_GENERATION",
];

const SEVERITY_OPTIONS = ["CRITICAL", "MAJOR", "MODERATE", "MINOR", "INFO"] as const;

const CATEGORY_OPTIONS = [
  "STRUCTURAL", "DRIVETRAIN", "ENGINE", "TRANSMISSION", "ELECTRICAL",
  "COSMETIC_EXTERIOR", "COSMETIC_INTERIOR", "ELECTRONICS", "SAFETY",
  "TIRES_WHEELS", "BRAKES", "SUSPENSION", "HVAC", "OTHER",
] as const;

export default function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const { data: inspection, isLoading } = trpc.inspection.get.useQuery({ id });

  // Fetch dynamic risk profile (stored in RISK_REVIEW step after enrichment)
  const { data: riskProfile } = trpc.inspection.getRiskProfile.useQuery(
    { inspectionId: id },
    { enabled: !!inspection }
  );

  // Fetch risk checklist statuses
  const { data: checkStatuses } = trpc.inspection.getRiskChecklist.useQuery(
    { inspectionId: id },
    { enabled: !!inspection }
  );

  // Mutations
  const enrichRiskProfile = trpc.vehicle.enrichRiskProfile.useMutation({
    onSuccess: () => {
      utils.inspection.get.invalidate({ id });
      utils.inspection.getRiskProfile.invalidate({ inspectionId: id });
    },
  });

  const advanceStep = trpc.inspection.advanceStep.useMutation({
    onSuccess: () => utils.inspection.get.invalidate({ id }),
  });

  // Auto-trigger risk enrichment when page loads without a risk profile
  const enrichTriggeredRef = useRef(false);
  useEffect(() => {
    if (
      inspection &&
      !riskProfile &&
      !enrichRiskProfile.isPending &&
      !enrichTriggeredRef.current
    ) {
      // Only auto-trigger if RISK_REVIEW step exists and isn't completed
      const riskStep = inspection.steps.find((s) => s.step === "RISK_REVIEW");
      if (riskStep && riskStep.status !== "COMPLETED") {
        enrichTriggeredRef.current = true;
        enrichRiskProfile.mutate({ inspectionId: id });
      }
    }
  }, [inspection, riskProfile, enrichRiskProfile, id]);

  const addFinding = trpc.inspection.addFinding.useMutation({
    onSuccess: () => {
      utils.inspection.get.invalidate({ id });
      setFindingFromRisk(null);
    },
  });

  const recordRiskCheck = trpc.inspection.recordRiskCheck.useMutation({
    onSuccess: () => {
      utils.inspection.getRiskChecklist.invalidate({ inspectionId: id });
    },
  });

  const recordQuestionAnswer = trpc.inspection.recordQuestionAnswer.useMutation({
    onSuccess: () => {
      utils.inspection.getRiskChecklist.invalidate({ inspectionId: id });
    },
  });

  const generateReport = trpc.report.generate.useMutation({
    onSuccess: () => utils.inspection.get.invalidate({ id }),
  });

  // AI Analysis (legacy)
  const runAIAnalysis = trpc.inspection.runAIAnalysis.useMutation({
    onSuccess: () => {
      utils.inspection.get.invalidate({ id });
      utils.inspection.getAIAnalysisResults.invalidate({ inspectionId: id });
    },
  });

  // Condition Scan (new workflow)
  const runConditionScan = trpc.inspection.runConditionScan.useMutation({
    onSuccess: () => {
      utils.inspection.get.invalidate({ id });
    },
  });

  // VIN Confirm (new workflow)
  const confirmVin = trpc.inspection.confirmVin.useMutation({
    onSuccess: () => {
      utils.inspection.get.invalidate({ id });
      // Auto-trigger risk profile generation after VIN confirmed
      enrichRiskProfile.mutate({ inspectionId: id });
    },
  });

  const { data: aiAnalysisData } = trpc.inspection.getAIAnalysisResults.useQuery(
    { inspectionId: id },
    { enabled: !!inspection }
  );
  const aiAnalysisResults = aiAnalysisData?.aiResults;
  const overallConditionResult = aiAnalysisData?.overallCondition;

  // Vehicle History
  const fetchHistory = trpc.inspection.fetchHistory.useMutation({
    onSuccess: () => utils.inspection.get.invalidate({ id }),
  });

  // Market Analysis
  const fetchMarket = trpc.inspection.fetchMarket.useMutation({
    onSuccess: () => utils.inspection.get.invalidate({ id }),
  });

  // VIN Detection (new workflow)
  const detectVin = trpc.inspection.detectVin.useMutation();
  const [detectedVin, setDetectedVin] = useState<string | null>(null);

  // Auto-trigger VIN OCR when entering VIN_CONFIRM step
  const vinDetectTriggeredRef = useRef(false);
  useEffect(() => {
    if (!inspection || vinDetectTriggeredRef.current) return;
    const vinStep = inspection.steps.find((s) => s.step === "VIN_CONFIRM");
    if (!vinStep || vinStep.status === "COMPLETED") return;
    // Only trigger if MEDIA_CAPTURE is completed (photos exist)
    const mediaStep = inspection.steps.find((s) => s.step === "MEDIA_CAPTURE");
    if (!mediaStep || mediaStep.status !== "COMPLETED") return;
    // Only if no vehicle linked yet (VIN not already confirmed)
    if (inspection.vehicle) return;

    vinDetectTriggeredRef.current = true;
    detectVin.mutate(
      { inspectionId: id },
      {
        onSuccess: (result) => {
          if (result.vin && result.confidence >= 0.6) {
            setDetectedVin(result.vin);
          }
        },
      }
    );
  }, [inspection, detectVin, id]);

  // Auto-trigger condition scan when entering AI_CONDITION_SCAN step
  const conditionScanTriggeredRef = useRef(false);
  useEffect(() => {
    if (!inspection || conditionScanTriggeredRef.current) return;
    const scanStep = inspection.steps.find((s) => s.step === "AI_CONDITION_SCAN");
    if (!scanStep || scanStep.status === "COMPLETED") return;
    // Only trigger if VIN_CONFIRM is completed
    const vinStep = inspection.steps.find((s) => s.step === "VIN_CONFIRM");
    if (!vinStep || vinStep.status !== "COMPLETED") return;
    // Must have a vehicle linked
    if (!inspection.vehicle) return;

    conditionScanTriggeredRef.current = true;
    runConditionScan.mutate({ inspectionId: id });
  }, [inspection, runConditionScan, id]);

  // Media upload hook
  const mediaUpload = useMediaUpload(id);

  // UI state
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showGuidedCapture, setShowGuidedCapture] = useState(false);
  const [findingFromRisk, setFindingFromRisk] = useState<AggregatedRisk | null>(null);
  const [uploadingRiskCapture, setUploadingRiskCapture] = useState<string | null>(null);

  // Build riskMediaMap from inspection.media — parse FINDING_EVIDENCE_${riskId}_${idx} capture types
  const riskMediaMap = useMemo(() => {
    const map: Record<string, Array<{ mediaId: string; url: string; captureType: string }>> = {};
    if (!inspection?.media) return map;
    for (const m of inspection.media) {
      if (!m.captureType || !m.url) continue;
      const match = m.captureType.match(/^FINDING_EVIDENCE_(.+)_(\d+)$/);
      if (!match) continue;
      const riskId = match[1];
      if (!map[riskId]) map[riskId] = [];
      map[riskId].push({
        mediaId: (m as { id?: string }).id || m.captureType,
        url: m.url,
        captureType: m.captureType,
      });
    }
    return map;
  }, [inspection?.media]);

  // Handle inline evidence upload from RiskChecklist
  const handleUploadEvidence = useCallback(async (riskId: string, captureIndex: number, file: File): Promise<string | null> => {
    const captureType = `FINDING_EVIDENCE_${riskId}_${captureIndex}`;
    setUploadingRiskCapture(`${riskId}:${captureIndex}`);
    try {
      const result = await mediaUpload.upload(file, captureType);
      if (result) {
        // Update risk check status with new mediaId
        const existing = checkStatuses?.[riskId];
        const existingMediaIds = (existing as { mediaIds?: string[] })?.mediaIds || [];
        const newMediaIds = [...existingMediaIds, result.mediaItemId];
        recordRiskCheck.mutate({
          inspectionId: id,
          riskId,
          status: (existing?.status as RiskCheckStatus["status"]) || "NOT_CHECKED",
          notes: existing?.notes || undefined,
          mediaIds: newMediaIds,
        });
        return result.mediaItemId;
      }
      return null;
    } finally {
      setUploadingRiskCapture(null);
    }
  }, [mediaUpload, checkStatuses, id, recordRiskCheck]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">Inspection not found</p>
        <Link href="/dashboard/inspections">
          <Button variant="secondary" className="mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to Inspections
          </Button>
        </Link>
      </div>
    );
  }

  // Detect workflow version: new inspections have MEDIA_CAPTURE as first step
  const isNewWorkflow = inspection.steps.some((s) => s.step === "VIN_CONFIRM" || s.step === "AI_CONDITION_SCAN");
  const STEP_ORDER = isNewWorkflow ? NEW_STEP_ORDER : LEGACY_STEP_ORDER;

  const completedSteps = inspection.steps.filter((s) => s.status === "COMPLETED").length;
  const progressPct = (completedSteps / inspection.steps.length) * 100;
  const currentStepIndex = STEP_ORDER.findIndex((step) => {
    const s = inspection.steps.find((is) => is.step === step);
    return s && s.status !== "COMPLETED";
  });
  const currentStep = currentStepIndex >= 0 ? STEP_ORDER[currentStepIndex] : "COMPLETED";
  const isCompleted = inspection.status === "COMPLETED";
  const isCancelled = inspection.status === "CANCELLED";

  function handleAdvanceStep(step: string) {
    advanceStep.mutate({ inspectionId: id, step: step as never });
  }

  function handleCheckRisk(riskId: string, status: RiskCheckStatus["status"], notes?: string) {
    // Preserve existing mediaIds when changing status
    const existing = checkStatuses?.[riskId] as { mediaIds?: string[] } | undefined;
    const existingMediaIds = existing?.mediaIds || [];
    recordRiskCheck.mutate({ inspectionId: id, riskId, status, notes, mediaIds: existingMediaIds });
  }

  function handleAnswerQuestion(riskId: string, questionId: string, answer: "yes" | "no") {
    recordQuestionAnswer.mutate({ inspectionId: id, riskId, questionId, answer });
  }

  async function handleUploadQuestionMedia(riskId: string, questionId: string, file: File): Promise<string | null> {
    try {
      const result = await mediaUpload.upload(file, `RISK_Q_${riskId}_${questionId}`);
      // After upload, record the answer again with the new mediaId
      const existing = normalizedCheckStatuses[riskId];
      const qa = existing?.questionAnswers?.find((a: { questionId: string }) => a.questionId === questionId);
      if (qa && result?.mediaItemId) {
        const existingMedia = (qa.mediaIds as string[]) || [];
        recordQuestionAnswer.mutate({
          inspectionId: id,
          riskId,
          questionId,
          answer: qa.answer as "yes" | "no",
          mediaIds: [...existingMedia, result.mediaItemId],
        });
      }
      return result?.mediaItemId || null;
    } catch {
      return null;
    }
  }

  function handleCreateFindingFromRisk(risk: AggregatedRisk) {
    // Auto-create finding directly from risk data — no form needed
    const validCategories = new Set(CATEGORY_OPTIONS);
    const category = validCategories.has(risk.category as typeof CATEGORY_OPTIONS[number])
      ? (risk.category as typeof CATEGORY_OPTIONS[number])
      : "OTHER" as typeof CATEGORY_OPTIONS[number];

    const validSeverities = new Set(SEVERITY_OPTIONS);
    const severity = validSeverities.has(risk.severity as typeof SEVERITY_OPTIONS[number])
      ? (risk.severity as typeof SEVERITY_OPTIONS[number])
      : "MODERATE" as typeof SEVERITY_OPTIONS[number];

    addFinding.mutate({
      inspectionId: id,
      title: risk.title,
      description: risk.aiSummary || risk.description,
      severity,
      category,
      repairCostLow: risk.cost.low > 0 ? risk.cost.low : undefined,
      repairCostHigh: risk.cost.high > 0 ? risk.cost.high : undefined,
      positionX: risk.position?.x || undefined,
      positionY: risk.position?.y || undefined,
      positionZ: risk.position?.z || undefined,
    });
  }

  function handleSubmitFindingFromRisk(finding: {
    title: string;
    description: string;
    severity: (typeof SEVERITY_OPTIONS)[number];
    category: (typeof CATEGORY_OPTIONS)[number];
    repairCostLow?: number;
    repairCostHigh?: number;
    evidence?: string;
    positionX?: number;
    positionY?: number;
    positionZ?: number;
  }) {
    addFinding.mutate({
      inspectionId: id,
      ...finding,
    });
  }

  // Normalize check statuses for the RiskChecklist component
  const normalizedCheckStatuses: Record<string, RiskCheckStatus> = {};
  if (checkStatuses) {
    for (const [key, val] of Object.entries(checkStatuses)) {
      const v = val as Record<string, unknown>;
      normalizedCheckStatuses[key] = {
        riskId: val.riskId,
        status: val.status as RiskCheckStatus["status"],
        notes: val.notes,
        checkedAt: val.checkedAt,
        mediaIds: (v.mediaIds as string[]) || [],
        hasPhotoEvidence: !!v.hasPhotoEvidence,
      };
    }
  }

  // Extract photo-discovered risks from AI_CONDITION_SCAN step data
  const conditionScanStep = inspection.steps.find((s) => s.step === "AI_CONDITION_SCAN");
  const conditionScanData = (conditionScanStep?.data as Record<string, unknown>) || {};
  const photoDiscoveredRisks = (conditionScanData.unexpectedFindings as Array<{
    title: string;
    description: string;
    severity: string;
    category: string;
    confidence: number;
  }>) || [];

  // Compute inspection confidence for StepPanel (not a hook — after early returns)
  const inspectionConfidence = riskProfile
    ? computeInspectionConfidence(
        riskProfile.aggregatedRisks,
        normalizedCheckStatuses,
        aiAnalysisResults || [],
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/dashboard/inspections">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary truncate">
                {inspection.vehicle ? `${inspection.vehicle.year} ${inspection.vehicle.make} ${inspection.vehicle.model}` : "Vehicle Pending"}
              </h1>
              <Badge
                variant={isCompleted ? "success" : isCancelled ? "danger" : "info"}
              >
                {inspection.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-text-secondary font-mono text-xs sm:text-sm truncate">
              {inspection.number}{inspection.vehicle ? ` · VIN: ${inspection.vehicle.vin}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2 pl-10 sm:pl-0">
          {inspection.report && (
            <Badge variant="success">Report Generated</Badge>
          )}
        </div>
      </div>

      {/* Workflow Stepper */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-text-secondary">Inspection Progress</p>
          <p className="text-sm text-text-secondary">{completedSteps}/{inspection.steps.length} steps</p>
        </div>
        <Progress value={progressPct} color={progressPct === 100 ? "green" : "brand"} />

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2 md:grid md:grid-cols-7 md:overflow-visible">
          {STEP_ORDER.map((stepKey, idx) => {
            const step = inspection.steps.find((s) => s.step === stepKey);
            const meta = STEP_META[stepKey] || { label: stepKey, icon: Circle };
            const Icon = meta.icon;
            const isStepCompleted = step?.status === "COMPLETED";
            const isActive = idx === currentStepIndex;

            return (
              <div key={stepKey} className="text-center flex-shrink-0 min-w-[4.5rem] md:min-w-0">
                <div
                  className={`mx-auto h-8 w-8 rounded-full flex items-center justify-center mb-1 transition-colors ${
                    isStepCompleted
                      ? "bg-[#dcfce7] text-green-700"
                      : isActive
                      ? "bg-[#fce8f3] text-brand-600 ring-2 ring-brand-400/40"
                      : "bg-surface-overlay text-text-tertiary"
                  }`}
                >
                  {isStepCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : isActive ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <p className={`text-xs ${
                  isStepCompleted ? "text-green-700 font-medium" :
                  isActive ? "text-brand-700 font-medium" : "text-text-tertiary"
                }`}>
                  {meta.label}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3D Risk Intelligence Viewer (shown when risk profile exists) */}
      {riskProfile && riskProfile.aggregatedRisks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-0 overflow-hidden">
            <VehicleViewer
              vehicle={{
                bodyStyle: inspection.vehicle?.bodyStyle ?? null,
                nhtsaData: (inspection.vehicle?.nhtsaData as Record<string, unknown> | null) ?? null,
              }}
              risks={riskProfile.aggregatedRisks}
              activeRiskId={activeHotspot}
              onRiskClick={(riskId) => setActiveHotspot(riskId === activeHotspot ? null : riskId)}
              className="h-[280px] sm:h-[400px]"
            />
          </Card>
          <Card className="p-4">
            <RiskChecklist
              risks={riskProfile.aggregatedRisks}
              checkStatuses={normalizedCheckStatuses}
              onCheckRisk={handleCheckRisk}
              onCreateFinding={handleCreateFindingFromRisk}
              onCaptureEvidence={(risk) => setActiveHotspot(risk.id)}
              onHighlightRisk={setActiveHotspot}
              activeRiskId={activeHotspot}
              onUploadEvidence={handleUploadEvidence}
              uploadingRiskCapture={uploadingRiskCapture}
              riskMediaMap={riskMediaMap}
              aiResults={aiAnalysisResults || []}
              onAnswerQuestion={handleAnswerQuestion}
              onUploadQuestionMedia={handleUploadQuestionMedia}
              uploadingQuestionId={mediaUpload.currentCaptureType?.startsWith("RISK_Q_") ? mediaUpload.currentCaptureType : null}
              photoDiscoveredRisks={photoDiscoveredRisks}
            />
          </Card>
        </div>
      )}

      {/* Active Step Panel */}
      {!isCompleted && !isCancelled && (
        <StepPanel
          activeStep={currentStep}
          riskProfile={riskProfile}
          inspection={{
            id: inspection.id,
            media: inspection.media || [],
            report: inspection.report,
            vehicleHistory: inspection.vehicleHistory ? {
              ...inspection.vehicleHistory,
              ownerCount: inspection.vehicleHistory.ownerCount ?? 0,
            } : null,
            marketAnalysis: inspection.marketAnalysis,
          }}
          checkStatuses={normalizedCheckStatuses}
          onStartVerification={() => enrichRiskProfile.mutate({ inspectionId: id })}
          isEnriching={enrichRiskProfile.isPending}
          onMediaCapture={(captureType, file) => mediaUpload.upload(file, captureType)}
          uploadingCaptureType={mediaUpload.currentCaptureType || undefined}
          onCheckRisk={handleCheckRisk}
          onCreateFinding={handleCreateFindingFromRisk}
          onCaptureEvidence={(risk) => {
            // Scroll to or trigger evidence capture for this risk
            setActiveHotspot(risk.id);
          }}
          onHighlightRisk={setActiveHotspot}
          activeRiskId={activeHotspot}
          onAdvanceStep={handleAdvanceStep}
          onGenerateReport={() => generateReport.mutate({ inspectionId: id })}
          isGeneratingReport={generateReport.isPending}
          isAdvancingStep={advanceStep.isPending}
          onStartGuidedCapture={() => setShowGuidedCapture(true)}
          onRunAIAnalysis={() => runAIAnalysis.mutate({ inspectionId: id })}
          isRunningAIAnalysis={runAIAnalysis.isPending}
          aiAnalysisResults={aiAnalysisResults || undefined}
          overallConditionResult={overallConditionResult || undefined}
          onRunConditionScan={() => runConditionScan.mutate({ inspectionId: id })}
          isRunningConditionScan={runConditionScan.isPending}
          conditionScanComplete={inspection.steps.some((s) => s.step === "AI_CONDITION_SCAN" && s.status === "COMPLETED")}
          onConfirmVin={(vin) => confirmVin.mutate({ inspectionId: id, vin })}
          isConfirmingVin={confirmVin.isPending}
          detectedVin={detectedVin}
          isDetectingVin={detectVin.isPending}
          onFetchHistory={() => fetchHistory.mutate({ inspectionId: id })}
          isFetchingHistory={fetchHistory.isPending}
          onFetchMarket={() => fetchMarket.mutate({ inspectionId: id })}
          isFetchingMarket={fetchMarket.isPending}
          onViewReport={() => setShowReportModal(true)}
          inspectionConfidence={inspectionConfidence}
        />
      )}

      {/* Finding from Risk slide-out (kept for auto-creation from risk checks) */}
      {findingFromRisk && (
        <FindingFromRisk
          risk={findingFromRisk}
          onSubmit={handleSubmitFindingFromRisk}
          onClose={() => setFindingFromRisk(null)}
          onCaptureEvidence={() => {}}
          isSubmitting={addFinding.isPending}
        />
      )}

      {/* Guided Capture Overlay */}
      {showGuidedCapture && (
        <GuidedCapture
          inspectionId={inspection.id}
          captures={(inspection.media || []).filter((m) => m.captureType).map((m) => ({
            captureType: m.captureType as string,
            url: m.url || undefined,
            thumbnailUrl: m.thumbnailUrl || m.url || undefined,
          }))}
          onCapture={(captureType, file) => mediaUpload.upload(file, captureType)}
          isUploading={mediaUpload.currentCaptureType}
          onClose={() => setShowGuidedCapture(false)}
        />
      )}

      {/* Report Modal */}
      {showReportModal && inspection.report && (
        <ReportModal
          reportId={inspection.report.id}
          reportNumber={inspection.report.number}
          pdfUrl={inspection.report.pdfUrl}
          shareToken={(inspection.report as { shareToken?: string }).shareToken}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
