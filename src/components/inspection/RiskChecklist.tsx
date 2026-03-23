"use client";

import { useState, useRef } from "react";
import { CheckCircle, XCircle, HelpCircle, Camera, ChevronDown, AlertTriangle, Loader2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { AggregatedRisk, RiskCheckStatus, AIAnalysisResult, QuestionAnswer } from "@/types/risk";
import { GuidedRiskCheck } from "./GuidedRiskCheck";

interface RiskChecklistProps {
  risks: AggregatedRisk[];
  checkStatuses: Record<string, RiskCheckStatus>;
  onCheckRisk: (riskId: string, status: RiskCheckStatus["status"], notes?: string) => void;
  onCreateFinding: (risk: AggregatedRisk) => void;
  onCaptureEvidence: (risk: AggregatedRisk) => void;
  onHighlightRisk: (riskId: string | null) => void;
  activeRiskId: string | null;
  onUploadEvidence?: (riskId: string, captureIndex: number, file: File) => Promise<string | null>;
  uploadingRiskCapture?: string | null;
  riskMediaMap?: Record<string, Array<{ mediaId: string; url: string; captureType: string }>>;
  aiResults?: AIAnalysisResult[];
  /** Guided question flow */
  onAnswerQuestion?: (riskId: string, questionId: string, answer: "yes" | "no") => void;
  onUploadQuestionMedia?: (riskId: string, questionId: string, file: File) => Promise<string | null>;
  uploadingQuestionId?: string | null;
}

export function RiskChecklist({
  risks,
  checkStatuses,
  onCheckRisk,
  onCreateFinding,
  onHighlightRisk,
  activeRiskId,
  onUploadEvidence,
  uploadingRiskCapture,
  riskMediaMap = {},
  onAnswerQuestion,
  onUploadQuestionMedia,
  uploadingQuestionId,
}: RiskChecklistProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const checkedCount = Object.values(checkStatuses).filter(
    (s) => s.status !== "NOT_CHECKED"
  ).length;
  const failedCount = Object.values(checkStatuses).filter(
    (s) => s.status === "CONFIRMED"
  ).length;
  const passedCount = Object.values(checkStatuses).filter(
    (s) => s.status === "NOT_FOUND"
  ).length;
  const progressPct = risks.length > 0 ? (checkedCount / risks.length) * 100 : 0;

  function handleFail(risk: AggregatedRisk) {
    // Mark as confirmed
    onCheckRisk(risk.id, "CONFIRMED");
    // Auto-create finding from the risk data — no form needed
    onCreateFinding(risk);
  }

  function handlePass(riskId: string) {
    onCheckRisk(riskId, "NOT_FOUND");
  }

  function handleSkip(riskId: string) {
    onCheckRisk(riskId, "UNABLE_TO_INSPECT");
  }

  function handleReset(riskId: string) {
    onCheckRisk(riskId, "NOT_CHECKED");
  }

  function toggleDetails(riskId: string) {
    setExpandedId(expandedId === riskId ? null : riskId);
    onHighlightRisk(riskId === activeRiskId ? null : riskId);
  }

  const handleFileSelect = async (riskId: string, captureIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadEvidence) return;
    await onUploadEvidence(riskId, captureIndex, file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Progress Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-text-primary">Inspection Checklist</h3>
          <span className="text-sm font-medium text-text-secondary">
            {checkedCount}/{risks.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-surface-sunken overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: failedCount > 0
                ? "linear-gradient(to right, #ef4444, #dc2626)"
                : "linear-gradient(to right, #22c55e, #16a34a)",
            }}
          />
        </div>

        {/* Summary chips */}
        {checkedCount > 0 && (
          <div className="flex gap-3 mt-2">
            {passedCount > 0 && (
              <span className="text-xs font-medium text-green-700">
                {passedCount} passed
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-xs font-medium text-red-700">
                {failedCount} failed
              </span>
            )}
            <span className="text-xs text-text-tertiary">
              {risks.length - checkedCount} remaining
            </span>
          </div>
        )}
      </div>

      {/* Checklist items */}
      <div className="space-y-1">
        {risks.map((risk) => {
          const status = checkStatuses[risk.id]?.status || "NOT_CHECKED";
          const isExpanded = expandedId === risk.id;
          const isActive = activeRiskId === risk.id;
          const riskMedia = riskMediaMap[risk.id] || [];

          return (
            <div
              key={risk.id}
              className={cn(
                "rounded-lg border transition-all",
                status === "CONFIRMED" ? "border-red-300 bg-red-50" :
                status === "NOT_FOUND" ? "border-green-200 bg-green-50/50" :
                status === "UNABLE_TO_INSPECT" ? "border-border-strong bg-surface-overlay" :
                isActive ? "border-brand-400 ring-1 ring-brand-500/30" :
                "border-border-default bg-surface-raised"
              )}
            >
              {/* Main row — always visible */}
              <div className="flex items-center gap-2 p-2.5">
                {/* Status indicator */}
                <div className="shrink-0">
                  {status === "CONFIRMED" && <XCircle className="h-5 w-5 text-red-500" />}
                  {status === "NOT_FOUND" && <CheckCircle className="h-5 w-5 text-green-500" />}
                  {status === "UNABLE_TO_INSPECT" && <HelpCircle className="h-5 w-5 text-text-tertiary" />}
                  {status === "NOT_CHECKED" && <div className="h-5 w-5 rounded-full border-2 border-border-strong" />}
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-sm font-medium truncate",
                      status === "NOT_FOUND" ? "text-text-tertiary line-through" : "text-text-primary"
                    )}>
                      {risk.title}
                    </span>
                    {risk.hasActiveRecall && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0">RECALL</span>
                    )}
                  </div>
                  {/* Repair cost shown inline when present */}
                  {risk.cost.low > 0 && status === "NOT_CHECKED" && (
                    <span className="text-[11px] text-text-tertiary">
                      Est. {formatCurrency(risk.cost.low)} – {formatCurrency(risk.cost.high)}
                    </span>
                  )}
                </div>

                {/* Severity badge */}
                <Badge
                  variant={
                    risk.severity === "CRITICAL" ? "danger" :
                    risk.severity === "MAJOR" ? "warning" : "default"
                  }
                  className="shrink-0 text-[10px]"
                >
                  {risk.severity}
                </Badge>

                {/* Action buttons — Pass / Fail or Guided expand */}
                {status === "NOT_CHECKED" ? (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Only show Pass/Fail for risks without guided questions */}
                    {!(risk.inspectionQuestions && risk.inspectionQuestions.length > 0 && onAnswerQuestion) && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePass(risk.id); }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
                          title="Pass"
                        >
                          <CheckCircle className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFail(risk); }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
                          title="Fail"
                        >
                          <XCircle className="h-4.5 w-4.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleDetails(risk.id); }}
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                        isExpanded ? "bg-brand-100 text-brand-700" : "bg-surface-overlay hover:bg-surface-sunken text-text-tertiary"
                      )}
                      title={risk.inspectionQuestions?.length ? "Inspect" : "Details"}
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Photo button (optional) */}
                    {onUploadEvidence && status === "CONFIRMED" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const key = `${risk.id}:0`;
                            fileInputRefs.current[key]?.click();
                          }}
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                            riskMedia.length > 0
                              ? "bg-brand-100 text-brand-700"
                              : "bg-surface-overlay hover:bg-surface-sunken text-text-tertiary"
                          )}
                          title="Add photo"
                        >
                          {uploadingRiskCapture?.startsWith(risk.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Camera className="h-4 w-4" />
                              {riskMedia.length > 0 && (
                                <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-brand-600 text-white rounded-full h-3.5 w-3.5 flex items-center justify-center">
                                  {riskMedia.length}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[`${risk.id}:0`] = el; }}
                          onChange={(e) => handleFileSelect(risk.id, 0, e)}
                        />
                      </>
                    )}
                    {/* Reset / undo */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReset(risk.id); }}
                      className="h-8 px-2 rounded-lg flex items-center justify-center bg-surface-overlay hover:bg-surface-sunken text-text-tertiary text-[11px] font-medium transition-colors"
                      title="Undo"
                    >
                      Undo
                    </button>
                  </div>
                )}
              </div>

              {/* Expandable details — guided questions or legacy static details */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-border-default pt-2">
                  {risk.inspectionQuestions && risk.inspectionQuestions.length > 0 && onAnswerQuestion ? (
                    /* Guided question flow */
                    <GuidedRiskCheck
                      risk={risk}
                      questionAnswers={checkStatuses[risk.id]?.questionAnswers || []}
                      onAnswerQuestion={(questionId, answer) => onAnswerQuestion(risk.id, questionId, answer)}
                      onUploadMedia={onUploadQuestionMedia ? (questionId, file) => onUploadQuestionMedia(risk.id, questionId, file) : undefined}
                      uploadingQuestionId={uploadingQuestionId}
                      onSkip={() => handleSkip(risk.id)}
                      onManualOverride={(s) => {
                        onCheckRisk(risk.id, s);
                        if (s === "CONFIRMED") onCreateFinding(risk);
                      }}
                      status={status}
                    />
                  ) : (
                    /* Legacy static details */
                    <div className="space-y-2">
                      {risk.whatToCheck && (
                        <div className="text-xs text-text-secondary">
                          <span className="font-semibold text-text-primary">Check: </span>
                          {risk.whatToCheck}
                        </div>
                      )}
                      {risk.whereToLook && (
                        <div className="text-xs text-text-secondary">
                          <span className="font-semibold text-text-primary">Where: </span>
                          {risk.whereToLook}
                        </div>
                      )}
                      {((risk.signsOfFailure && risk.signsOfFailure.length > 0) || risk.symptoms.length > 0) && (
                        <div>
                          <span className="text-xs font-semibold text-red-700">Signs of failure:</span>
                          <ul className="text-xs text-red-600 list-disc list-inside mt-0.5">
                            {(risk.signsOfFailure || risk.symptoms).slice(0, 3).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {risk.cost.low > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <DollarSign className="h-3 w-3 text-text-tertiary" />
                          <span className="text-text-secondary">
                            Est. repair: <span className="font-medium text-text-primary">{formatCurrency(risk.cost.low)} – {formatCurrency(risk.cost.high)}</span>
                          </span>
                        </div>
                      )}
                      {risk.hasActiveRecall && risk.relatedRecalls && risk.relatedRecalls.length > 0 && (
                        <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                          <span className="font-bold">Recall: </span>
                          {risk.relatedRecalls[0].remedy}
                        </div>
                      )}
                      {status === "NOT_CHECKED" && (
                        <button
                          onClick={() => handleSkip(risk.id)}
                          className="text-[11px] text-text-tertiary hover:text-text-secondary underline"
                        >
                          Unable to inspect
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
