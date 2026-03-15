"use client";

import { useState, useRef } from "react";
import { CheckCircle, XCircle, HelpCircle, Camera, ChevronDown, ChevronUp, AlertTriangle, MapPin, Wrench, Eye, Info, ImageIcon, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { AggregatedRisk, RiskCheckStatus, AIAnalysisResult } from "@/types/risk";
import { computeRiskConfidence, computeInspectionConfidence, type InspectionConfidence, type RiskConfidence } from "@/lib/confidence";

interface RiskChecklistProps {
  risks: AggregatedRisk[];
  checkStatuses: Record<string, RiskCheckStatus>;
  onCheckRisk: (riskId: string, status: RiskCheckStatus["status"], notes?: string) => void;
  onCreateFinding: (risk: AggregatedRisk) => void;
  onCaptureEvidence: (risk: AggregatedRisk) => void;
  onHighlightRisk: (riskId: string | null) => void;
  activeRiskId: string | null;
  // Inline capture props
  onUploadEvidence?: (riskId: string, captureIndex: number, file: File) => Promise<string | null>;
  uploadingRiskCapture?: string | null; // "riskId:captureIndex" while uploading
  riskMediaMap?: Record<string, Array<{ mediaId: string; url: string; captureType: string }>>;
  aiResults?: AIAnalysisResult[];
}

export function RiskChecklist({
  risks,
  checkStatuses,
  onCheckRisk,
  onCreateFinding,
  onCaptureEvidence,
  onHighlightRisk,
  activeRiskId,
  onUploadEvidence,
  uploadingRiskCapture,
  riskMediaMap = {},
  aiResults = [],
}: RiskChecklistProps) {
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const checkedCount = Object.values(checkStatuses).filter(
    (s) => s.status !== "NOT_CHECKED"
  ).length;
  const confirmedCount = Object.values(checkStatuses).filter(
    (s) => s.status === "CONFIRMED"
  ).length;
  const progressPct = risks.length > 0 ? (checkedCount / risks.length) * 100 : 0;

  // Compute confidence
  const inspectionConfidence = computeInspectionConfidence(risks, checkStatuses, aiResults);
  const confidenceByRisk = new Map(inspectionConfidence.perRisk.map((r) => [r.riskId, r]));

  const toggleExpanded = (riskId: string) => {
    setExpandedRisks((prev) => {
      const next = new Set(prev);
      if (next.has(riskId)) next.delete(riskId);
      else next.add(riskId);
      return next;
    });
    onHighlightRisk(riskId === activeRiskId ? null : riskId);
  };

  const getStatusIcon = (status: RiskCheckStatus["status"]) => {
    switch (status) {
      case "CONFIRMED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "NOT_FOUND":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "UNABLE_TO_INSPECT":
        return <HelpCircle className="h-4 w-4 text-text-tertiary" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-border-strong" />;
    }
  };

  const getStatusLabel = (status: RiskCheckStatus["status"]) => {
    switch (status) {
      case "CONFIRMED": return "Issue Found";
      case "NOT_FOUND": return "Clear";
      case "UNABLE_TO_INSPECT": return "Unable to Inspect";
      default: return "Not Checked";
    }
  };

  const handleFileSelect = async (riskId: string, captureIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadEvidence) return;
    await onUploadEvidence(riskId, captureIndex, file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const getConfidenceBadge = (rc: RiskConfidence | undefined) => {
    if (!rc || rc.tier === "UNCHECKED") return null;
    const styles = {
      VERIFIED: "bg-[#0a2e1a] text-green-400 border-green-800/50",
      EVIDENCED: "bg-[#1a0a2e] text-brand-300 border-brand-800/50",
      MANUAL: "bg-surface-overlay text-text-secondary border-border-strong",
      UNCHECKED: "",
    };
    const icons = {
      VERIFIED: <ShieldCheck className="h-3 w-3" />,
      EVIDENCED: <Camera className="h-3 w-3" />,
      MANUAL: <ShieldAlert className="h-3 w-3" />,
      UNCHECKED: null,
    };
    return (
      <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border", styles[rc.tier])}>
        {icons[rc.tier]} {rc.label}
      </span>
    );
  };

  const confidenceColor = inspectionConfidence.overall >= 0.7 ? "bg-green-500" :
    inspectionConfidence.overall >= 0.45 ? "bg-brand-400" : "bg-gray-500";

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Known Issues Checklist</h3>
          <p className="text-sm text-text-secondary">
            {checkedCount} of {risks.length} items inspected
            {confirmedCount > 0 && (
              <span className="text-red-600 font-medium"> · {confirmedCount} issues found</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-32 rounded-full bg-surface-sunken overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: confirmedCount > 0
                  ? "linear-gradient(to right, #ef4444, #dc2626)"
                  : "linear-gradient(to right, #22c55e, #16a34a)",
              }}
            />
          </div>
          <span className="text-sm font-medium text-text-secondary">
            {Math.round(progressPct)}%
          </span>
        </div>
      </div>

      {/* Confidence Meter */}
      {checkedCount > 0 && (
        <div className="p-3 rounded-lg bg-surface-sunken border border-border-default">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-secondary">Assessment Confidence</span>
            <span className="text-xs font-bold text-text-primary">{Math.round(inspectionConfidence.overall * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-overlay overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", confidenceColor)}
              style={{ width: `${inspectionConfidence.overall * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-text-tertiary mt-1.5">{inspectionConfidence.summary}</p>
          {inspectionConfidence.evidenceCoverage < 1 && checkedCount > 0 && (
            <p className="text-[11px] text-text-tertiary mt-0.5">
              {Math.round(inspectionConfidence.evidenceCoverage * 100)}% of checked items have photo evidence
            </p>
          )}
        </div>
      )}

      {/* Risk Items */}
      <div className="space-y-2">
        {risks.map((risk) => {
          const status = checkStatuses[risk.id]?.status || "NOT_CHECKED";
          const isExpanded = expandedRisks.has(risk.id);
          const isActive = activeRiskId === risk.id;
          const riskMedia = riskMediaMap[risk.id] || [];
          const riskConfidence = confidenceByRisk.get(risk.id);
          const isCheckedWithoutPhotos = status !== "NOT_CHECKED" && riskMedia.length === 0;

          return (
            <div
              key={risk.id}
              className={cn(
                "rounded-lg border transition-colors",
                isActive ? "border-brand-400 ring-1 ring-brand-500/30" :
                status === "CONFIRMED" ? "border-red-900/50 bg-[#2e0a0a]" :
                status === "NOT_FOUND" ? "border-green-900/50 bg-[#0a2e1a]" :
                status === "UNABLE_TO_INSPECT" ? "border-border-strong bg-surface-overlay" :
                "border-border-default bg-surface-raised"
              )}
            >
              {/* Header row */}
              <button
                onClick={() => toggleExpanded(risk.id)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                {getStatusIcon(status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-text-primary truncate">{risk.title}</span>
                    {risk.hasActiveRecall && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0">RECALL</span>
                    )}
                    {/* Evidence badge on collapsed header */}
                    {riskMedia.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#1a0a2e] text-brand-300 shrink-0">
                        <Camera className="h-2.5 w-2.5" /> {riskMedia.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-tertiary">{risk.category.replace(/_/g, " ")}</span>
                    <span className="text-xs text-text-tertiary">·</span>
                    <span className="text-xs text-text-tertiary">{getStatusLabel(status)}</span>
                    {/* Per-risk confidence badge */}
                    {riskConfidence && riskConfidence.tier !== "UNCHECKED" && getConfidenceBadge(riskConfidence)}
                  </div>
                </div>
                <Badge
                  variant={
                    risk.severity === "CRITICAL" ? "danger" :
                    risk.severity === "MAJOR" ? "warning" : "default"
                  }
                >
                  {risk.severity}
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-text-tertiary shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-border-default pt-3">
                  {/* What + Where — combined header for AI-generated items */}
                  {risk.whatToCheck && (
                    <div className="p-2.5 rounded-lg bg-surface-sunken border border-border-default">
                      <div className="flex items-start gap-2 mb-1.5">
                        <Wrench className="h-3.5 w-3.5 text-text-tertiary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase text-text-tertiary mb-0.5">What to Check</p>
                          <p className="text-xs text-text-primary font-medium">{risk.whatToCheck}</p>
                        </div>
                      </div>
                      {risk.whereToLook && (
                        <div className="flex items-start gap-2 mt-2">
                          <MapPin className="h-3.5 w-3.5 text-text-tertiary mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold uppercase text-text-tertiary mb-0.5">Where to Look</p>
                            <p className="text-xs text-text-primary">{risk.whereToLook}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* How to Inspect — step-by-step guidance */}
                  {(risk.howToInspect || risk.inspectionGuidance) && (
                    <div className="p-2.5 rounded-lg bg-[#1a0a2e] border border-brand-800/50">
                      <p className="text-[10px] font-bold uppercase text-brand-300 mb-1">
                        <Eye className="inline h-3 w-3 mr-1" />
                        How to Inspect
                      </p>
                      <p className="text-[11px] text-brand-200 leading-relaxed">
                        {risk.howToInspect || risk.inspectionGuidance}
                      </p>
                    </div>
                  )}

                  {/* Signs of Failure */}
                  {((risk.signsOfFailure && risk.signsOfFailure.length > 0) || risk.symptoms.length > 0) && (
                    <div className="p-2.5 rounded-lg bg-[#2e0a0a] border border-red-900/50">
                      <p className="text-[10px] font-bold uppercase text-red-400 mb-1">
                        <AlertTriangle className="inline h-3 w-3 mr-1" />
                        Signs of Failure
                      </p>
                      <ul className="text-[11px] text-red-300 list-disc list-inside space-y-0.5">
                        {(risk.signsOfFailure || risk.symptoms).map((s, si) => <li key={si}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Inline Evidence Capture */}
                  {risk.capturePrompts && risk.capturePrompts.length > 0 && onUploadEvidence && (
                    <div className="p-2.5 rounded-lg bg-[#1a0a2e] border border-brand-800/50">
                      <p className="text-[10px] font-bold uppercase text-brand-300 mb-2">
                        <Camera className="inline h-3 w-3 mr-1" />
                        Capture Evidence
                      </p>
                      <div className="space-y-2">
                        {risk.capturePrompts.map((prompt, idx) => {
                          const captureKey = `${risk.id}:${idx}`;
                          const isUploading = uploadingRiskCapture === captureKey;
                          const captureType = `FINDING_EVIDENCE_${risk.id}_${idx}`;
                          const captured = riskMedia.find((m) => m.captureType === captureType);

                          return (
                            <div key={idx} className="flex items-center gap-2">
                              {captured ? (
                                <div className="h-10 w-10 rounded border border-green-800/50 bg-[#0a2e1a] overflow-hidden shrink-0 relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={captured.url} alt="" className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                  </div>
                                </div>
                              ) : isUploading ? (
                                <div className="h-10 w-10 rounded border border-brand-800/50 bg-[#1a0a2e] flex items-center justify-center shrink-0">
                                  <Loader2 className="h-4 w-4 text-brand-400 animate-spin" />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ref = fileInputRefs.current[captureKey];
                                    ref?.click();
                                  }}
                                  className="h-10 w-10 rounded border-2 border-dashed border-brand-600/50 bg-surface-sunken flex items-center justify-center shrink-0 hover:bg-[#1a0a2e] hover:border-brand-400 transition-colors"
                                >
                                  <Camera className="h-4 w-4 text-brand-400" />
                                </button>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                ref={(el) => { fileInputRefs.current[captureKey] = el; }}
                                onChange={(e) => handleFileSelect(risk.id, idx, e)}
                              />
                              <p className="text-[11px] text-brand-200 leading-tight flex-1">{prompt}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Already-captured evidence thumbnails (from CaptureGrid or previous sessions) */}
                  {riskMedia.length > 0 && !onUploadEvidence && (
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                      <span className="text-[11px] text-brand-300 font-medium">{riskMedia.length} photo(s) captured</span>
                      <div className="flex gap-1">
                        {riskMedia.slice(0, 4).map((m) => (
                          <div key={m.mediaId} className="h-8 w-8 rounded border border-border-default overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                        {riskMedia.length > 4 && (
                          <div className="h-8 w-8 rounded border border-border-default flex items-center justify-center bg-surface-overlay text-[10px] font-bold text-brand-300">
                            +{riskMedia.length - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Why It Matters + Cost */}
                  {(risk.whyItMatters || risk.description) && (
                    <div className="p-2.5 rounded-lg bg-[#1a0a2e] border border-brand-800/50">
                      <div className="flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 text-brand-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase text-brand-300 mb-0.5">Why It Matters</p>
                          <p className="text-[11px] text-brand-200 leading-relaxed">
                            {risk.whyItMatters || risk.description}
                          </p>
                        </div>
                      </div>
                      {risk.cost.low > 0 && (
                        <p className="text-[11px] font-semibold text-brand-300 mt-1.5 ml-5">
                          Est. repair: {formatCurrency(risk.cost.low)} – {formatCurrency(risk.cost.high)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Likelihood badge */}
                  {risk.likelihood && (
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                        risk.likelihood === "VERY_COMMON" ? "bg-[#2e0a0a] text-red-400" :
                        risk.likelihood === "COMMON" ? "bg-[#2e0a0a] text-red-400" :
                        risk.likelihood === "OCCASIONAL" ? "bg-surface-overlay text-text-secondary" :
                        "bg-surface-overlay text-text-tertiary"
                      )}>
                        {risk.likelihood.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-text-tertiary">likelihood on this vehicle</span>
                    </div>
                  )}

                  {/* Active recall info */}
                  {risk.hasActiveRecall && risk.relatedRecalls && risk.relatedRecalls.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-[#2e0a0a] border border-red-900/50">
                      <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Active Recall</p>
                      <p className="text-[11px] text-red-300">{risk.relatedRecalls[0].remedy}</p>
                    </div>
                  )}

                  {/* No evidence warning */}
                  {isCheckedWithoutPhotos && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-overlay border border-border-strong">
                      <ShieldAlert className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                      <p className="text-[11px] text-text-secondary">
                        No photo evidence — assessment confidence will be lower
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {status === "NOT_CHECKED" && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onCheckRisk(risk.id, "CONFIRMED")}
                          className="text-xs bg-[#2e0a0a] text-red-400 border-red-900/50 hover:bg-[#3e0a0a]"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Issue Found
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onCheckRisk(risk.id, "NOT_FOUND")}
                          className="text-xs bg-[#0a2e1a] text-green-400 border-green-900/50 hover:bg-[#0a3e1a]"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Clear
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onCheckRisk(risk.id, "UNABLE_TO_INSPECT")}
                          className="text-xs"
                        >
                          <HelpCircle className="h-3.5 w-3.5" /> Unable to Inspect
                        </Button>
                      </>
                    )}
                    {status === "CONFIRMED" && (
                      <Button
                        size="sm"
                        onClick={() => onCreateFinding(risk)}
                        className="text-xs bg-brand-gradient text-white"
                      >
                        Create Finding
                      </Button>
                    )}
                    {!onUploadEvidence && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onCaptureEvidence(risk)}
                        className="text-xs"
                      >
                        <Camera className="h-3.5 w-3.5" /> Capture Evidence
                      </Button>
                    )}
                    {status !== "NOT_CHECKED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCheckRisk(risk.id, "NOT_CHECKED")}
                        className="text-xs text-text-tertiary"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
