"use client";

import { use, useState, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { formatCurrency, severityColor } from "@/lib/utils";
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
  Plus,
  X,
  Wrench,
  ShieldAlert,
} from "lucide-react";
import { StepPanel } from "@/components/inspection/StepPanel";
import { RiskChecklist } from "@/components/inspection/RiskChecklist";
import { FindingFromRisk } from "@/components/inspection/FindingFromRisk";
import { VehicleDiagram } from "@/components/vehicle/VehicleDiagram";
import { ReportModal } from "@/components/inspection/ReportModal";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { computeInspectionConfidence } from "@/lib/confidence";
import type { AggregatedRisk, RiskCheckStatus } from "@/types/risk";


const STEP_META: Record<string, { label: string; icon: typeof CheckCircle }> = {
  VIN_DECODE: { label: "VIN Decode", icon: Car },
  RISK_REVIEW: { label: "Risk Review", icon: AlertTriangle },
  MEDIA_CAPTURE: { label: "Media Capture", icon: Camera },
  AI_ANALYSIS: { label: "AI Analysis", icon: ShieldAlert },
  VEHICLE_HISTORY: { label: "History", icon: Clock },
  MARKET_ANALYSIS: { label: "Market", icon: BarChart3 },
  REPORT_GENERATION: { label: "Report", icon: FileText },
};

const STEP_ORDER = [
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

  const addFinding = trpc.inspection.addFinding.useMutation({
    onSuccess: () => {
      utils.inspection.get.invalidate({ id });
      setShowFindingForm(false);
      setFindingFromRisk(null);
      setFindingForm({
        title: "", description: "", severity: "MODERATE", category: "OTHER",
        repairCostLow: "", repairCostHigh: "", evidence: "",
      });
    },
  });

  const recordRiskCheck = trpc.inspection.recordRiskCheck.useMutation({
    onSuccess: () => {
      utils.inspection.getRiskChecklist.invalidate({ inspectionId: id });
    },
  });

  const generateReport = trpc.report.generate.useMutation({
    onSuccess: () => utils.inspection.get.invalidate({ id }),
  });

  // AI Analysis
  const runAIAnalysis = trpc.inspection.runAIAnalysis.useMutation({
    onSuccess: () => {
      utils.inspection.get.invalidate({ id });
      utils.inspection.getAIAnalysisResults.invalidate({ inspectionId: id });
    },
  });

  const { data: aiAnalysisResults } = trpc.inspection.getAIAnalysisResults.useQuery(
    { inspectionId: id },
    { enabled: !!inspection }
  );

  // Vehicle History
  const fetchHistory = trpc.inspection.fetchHistory.useMutation({
    onSuccess: () => utils.inspection.get.invalidate({ id }),
  });

  // Market Analysis
  const fetchMarket = trpc.inspection.fetchMarket.useMutation({
    onSuccess: () => utils.inspection.get.invalidate({ id }),
  });

  // Media upload hook
  const mediaUpload = useMediaUpload(id);

  // UI state
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [showFindingForm, setShowFindingForm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
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
  const [findingForm, setFindingForm] = useState({
    title: "",
    description: "",
    severity: "MODERATE" as (typeof SEVERITY_OPTIONS)[number],
    category: "OTHER" as (typeof CATEGORY_OPTIONS)[number],
    repairCostLow: "",
    repairCostHigh: "",
    evidence: "",
  });

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

  function handleAddFinding(e: React.FormEvent) {
    e.preventDefault();
    addFinding.mutate({
      inspectionId: id,
      title: findingForm.title,
      description: findingForm.description,
      severity: findingForm.severity,
      category: findingForm.category,
      repairCostLow: findingForm.repairCostLow ? Math.round(parseFloat(findingForm.repairCostLow) * 100) : undefined,
      repairCostHigh: findingForm.repairCostHigh ? Math.round(parseFloat(findingForm.repairCostHigh) * 100) : undefined,
      evidence: findingForm.evidence || undefined,
    });
  }

  function handleCheckRisk(riskId: string, status: RiskCheckStatus["status"], notes?: string) {
    // Preserve existing mediaIds when changing status
    const existing = checkStatuses?.[riskId] as { mediaIds?: string[] } | undefined;
    const existingMediaIds = existing?.mediaIds || [];
    recordRiskCheck.mutate({ inspectionId: id, riskId, status, notes, mediaIds: existingMediaIds });
  }

  function handleCreateFindingFromRisk(risk: AggregatedRisk) {
    setFindingFromRisk(risk);
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
      <div className="flex items-center gap-4">
        <Link href="/dashboard/inspections">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              {inspection.vehicle.year} {inspection.vehicle.make} {inspection.vehicle.model}
            </h1>
            <Badge
              variant={isCompleted ? "success" : isCancelled ? "danger" : "info"}
            >
              {inspection.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-text-secondary font-mono text-sm">
            {inspection.number} &middot; VIN: {inspection.vehicle.vin}
          </p>
        </div>
        <div className="flex gap-2">
          {!isCompleted && !isCancelled && (
            <Button
              onClick={() => setShowFindingForm(true)}
              variant="secondary"
              size="sm"
            >
              <Plus className="h-4 w-4" /> Add Finding
            </Button>
          )}
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

        <div className="mt-5 grid grid-cols-7 gap-2">
          {STEP_ORDER.map((stepKey, idx) => {
            const step = inspection.steps.find((s) => s.step === stepKey);
            const meta = STEP_META[stepKey] || { label: stepKey, icon: Circle };
            const Icon = meta.icon;
            const isStepCompleted = step?.status === "COMPLETED";
            const isActive = idx === currentStepIndex;

            return (
              <div key={stepKey} className="text-center">
                <div
                  className={`mx-auto h-10 w-10 rounded-full flex items-center justify-center mb-1 transition-all ${
                    isStepCompleted
                      ? "bg-[#0a2e1a] text-green-400"
                      : isActive
                      ? "bg-[#1a0a2e] text-brand-400 ring-2 ring-brand-500/40"
                      : "bg-surface-overlay text-text-tertiary"
                  }`}
                >
                  {isStepCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : isActive ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <p className={`text-xs ${
                  isStepCompleted ? "text-green-400 font-medium" :
                  isActive ? "text-brand-300 font-medium" : "text-text-tertiary"
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
            <VehicleDiagram
              hotspots={riskProfile.aggregatedRisks.map((r) => ({
                id: r.id,
                position: [r.position.x, r.position.y, r.position.z] as [number, number, number],
                severity: r.severity as "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR" | "INFO",
                label: r.title,
              }))}
              onHotspotClick={(hotspotId) => setActiveHotspot(hotspotId === activeHotspot ? null : hotspotId)}
              activeHotspot={activeHotspot}
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
          onRunAIAnalysis={() => runAIAnalysis.mutate({ inspectionId: id })}
          isRunningAIAnalysis={runAIAnalysis.isPending}
          aiAnalysisResults={aiAnalysisResults || undefined}
          onFetchHistory={() => fetchHistory.mutate({ inspectionId: id })}
          isFetchingHistory={fetchHistory.isPending}
          onFetchMarket={() => fetchMarket.mutate({ inspectionId: id })}
          isFetchingMarket={fetchMarket.isPending}
          onViewReport={() => setShowReportModal(true)}
          inspectionConfidence={inspectionConfidence}
        />
      )}

      {/* Vehicle Details + Score + Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Details */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {[
              ["VIN", inspection.vehicle.vin],
              ["Year", inspection.vehicle.year],
              ["Make", inspection.vehicle.make],
              ["Model", inspection.vehicle.model],
              ["Trim", inspection.vehicle.trim || "—"],
              ["Body", inspection.vehicle.bodyStyle || "—"],
              ["Drivetrain", inspection.vehicle.drivetrain || "—"],
              ["Odometer", inspection.odometer ? `${inspection.odometer.toLocaleString()} mi` : "—"],
              ["Location", inspection.location || "—"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between text-sm">
                <span className="text-text-secondary">{label}</span>
                <span className="font-medium text-text-primary">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Condition Score */}
        <Card>
          <CardHeader>
            <CardTitle>Condition Score</CardTitle>
          </CardHeader>
          {inspection.overallScore != null ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className={`text-5xl font-bold ${
                  inspection.overallScore >= 70 ? "text-green-400" :
                  inspection.overallScore >= 50 ? "text-text-secondary" : "text-red-400"
                }`}>
                  {inspection.overallScore}
                </p>
                <p className="text-sm text-text-secondary mt-1">out of 100</p>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Structural / Drivetrain", score: inspection.structuralScore },
                  { label: "Cosmetic / Interior", score: inspection.cosmeticScore },
                  { label: "Electronics / Software", score: inspection.electronicsScore },
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
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Add findings to calculate score</p>
            </div>
          )}
        </Card>

        {/* Findings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Findings</CardTitle>
              <div className="flex items-center gap-2">
                <Badge>{inspection.findings.length}</Badge>
                {!isCompleted && !isCancelled && (
                  <button
                    onClick={() => setShowFindingForm(true)}
                    className="rounded-full h-6 w-6 flex items-center justify-center bg-[#1a0a2e] text-brand-400 hover:bg-brand-800 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          {inspection.findings.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No findings yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {inspection.findings.map((f) => (
                <div
                  key={f.id}
                  className={`p-3 rounded-lg border text-sm ${severityColor(f.severity)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{f.title}</span>
                    <Badge
                      variant={
                        f.severity === "CRITICAL" ? "danger" :
                        f.severity === "MAJOR" ? "warning" : "default"
                      }
                    >
                      {f.severity}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-80">{f.description}</p>
                  {(f.repairCostLow || f.repairCostHigh) && (
                    <p className="text-xs mt-1 font-medium">
                      Est. repair: ${((f.repairCostLow || 0) / 100).toLocaleString()} – ${((f.repairCostHigh || 0) / 100).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Finding from Risk slide-out */}
      {findingFromRisk && (
        <FindingFromRisk
          risk={findingFromRisk}
          onSubmit={handleSubmitFindingFromRisk}
          onClose={() => setFindingFromRisk(null)}
          onCaptureEvidence={() => {
            // Could trigger camera here
          }}
          isSubmitting={addFinding.isPending}
        />
      )}

      {/* Manual Add Finding Slide-out Panel */}
      {showFindingForm && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowFindingForm(false)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-surface-overlay shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-text-primary">Add Finding</h3>
                <button
                  onClick={() => setShowFindingForm(false)}
                  className="rounded-lg p-1.5 hover:bg-surface-hover"
                >
                  <X className="h-5 w-5 text-text-tertiary" />
                </button>
              </div>

              <form onSubmit={handleAddFinding} className="space-y-4">
                <Input
                  id="finding-title"
                  label="Title"
                  placeholder="e.g., Head Gasket Compromised"
                  value={findingForm.title}
                  onChange={(e) => setFindingForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-secondary">Description</label>
                  <textarea
                    placeholder="Describe the finding in detail..."
                    value={findingForm.description}
                    onChange={(e) => setFindingForm((p) => ({ ...p, description: e.target.value }))}
                    required
                    rows={3}
                    className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary shadow-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">Severity</label>
                    <select
                      value={findingForm.severity}
                      onChange={(e) => setFindingForm((p) => ({ ...p, severity: e.target.value as never }))}
                      className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                    >
                      {SEVERITY_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">Category</label>
                    <select
                      value={findingForm.category}
                      onChange={(e) => setFindingForm((p) => ({ ...p, category: e.target.value as never }))}
                      className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="cost-low"
                    label="Repair Cost Low ($)"
                    type="number"
                    placeholder="e.g., 2800"
                    value={findingForm.repairCostLow}
                    onChange={(e) => setFindingForm((p) => ({ ...p, repairCostLow: e.target.value }))}
                  />
                  <Input
                    id="cost-high"
                    label="Repair Cost High ($)"
                    type="number"
                    placeholder="e.g., 4200"
                    value={findingForm.repairCostHigh}
                    onChange={(e) => setFindingForm((p) => ({ ...p, repairCostHigh: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-secondary">Evidence Notes (optional)</label>
                  <textarea
                    placeholder="What was observed during inspection..."
                    value={findingForm.evidence}
                    onChange={(e) => setFindingForm((p) => ({ ...p, evidence: e.target.value }))}
                    rows={2}
                    className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary shadow-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowFindingForm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={addFinding.isPending}
                    className="flex-1"
                  >
                    Add Finding
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
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
