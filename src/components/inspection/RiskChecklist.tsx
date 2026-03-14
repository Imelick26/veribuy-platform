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
        return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
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
      VERIFIED: "bg-green-100 text-green-700 border-green-200",
      EVIDENCED: "bg-blue-100 text-blue-700 border-blue-200",
      MANUAL: "bg-amber-100 text-amber-700 border-amber-200",
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
    inspectionConfidence.overall >= 0.45 ? "bg-amber-500" : "bg-gray-300";

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Known Issues Checklist</h3>
          <p className="text-sm text-gray-500">
            {checkedCount} of {risks.length} items inspected
            {confirmedCount > 0 && (
              <span className="text-red-600 font-medium"> · {confirmedCount} issues found</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-32 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: confirmedCount > 0
                  ? "linear-gradient(to right, #ef4444, #f97316)"
                  : "linear-gradient(to right, #22c55e, #16a34a)",
              }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600">
            {Math.round(progressPct)}%
          </span>
        </div>
      </div>

      {/* Confidence Meter */}
      {checkedCount > 0 && (
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-700">Assessment Confidence</span>
            <span className="text-xs font-bold text-gray-900">{Math.round(inspectionConfidence.overall * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", confidenceColor)}
              style={{ width: `${inspectionConfidence.overall * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">{inspectionConfidence.summary}</p>
          {inspectionConfidence.evidenceCoverage < 1 && checkedCount > 0 && (
            <p className="text-[11px] text-amber-600 mt-0.5">
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
                "rounded-xl border transition-all",
                isActive ? "border-brand-300 ring-1 ring-brand-200" :
                status === "CONFIRMED" ? "border-red-200 bg-red-50/50" :
                status === "NOT_FOUND" ? "border-green-200 bg-green-50/50" :
                status === "UNABLE_TO_INSPECT" ? "border-yellow-200 bg-yellow-50/50" :
                "border-gray-200 bg-white"
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
                    <span className="font-semibold text-sm text-gray-900 truncate">{risk.title}</span>
                    {risk.hasActiveRecall && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0">RECALL</span>
                    )}
                    {/* Evidence badge on collapsed header */}
                    {riskMedia.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                        <Camera className="h-2.5 w-2.5" /> {riskMedia.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{risk.category.replace(/_/g, " ")}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{getStatusLabel(status)}</span>
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
                  <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
                  {/* What + Where — combined header for AI-generated items */}
                  {risk.whatToCheck && (
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="flex items-start gap-2 mb-1.5">
                        <Wrench className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase text-gray-500 mb-0.5">What to Check</p>
                          <p className="text-xs text-gray-800 font-medium">{risk.whatToCheck}</p>
                        </div>
                      </div>
                      {risk.whereToLook && (
                        <div className="flex items-start gap-2 mt-2">
                          <MapPin className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold uppercase text-gray-500 mb-0.5">Where to Look</p>
                            <p className="text-xs text-gray-800">{risk.whereToLook}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* How to Inspect — step-by-step guidance */}
                  {(risk.howToInspect || risk.inspectionGuidance) && (
                    <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-[10px] font-bold uppercase text-blue-700 mb-1">
                        <Eye className="inline h-3 w-3 mr-1" />
                        How to Inspect
                      </p>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        {risk.howToInspect || risk.inspectionGuidance}
                      </p>
                    </div>
                  )}

                  {/* Signs of Failure */}
                  {((risk.signsOfFailure && risk.signsOfFailure.length > 0) || risk.symptoms.length > 0) && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-[10px] font-bold uppercase text-amber-700 mb-1">
                        <AlertTriangle className="inline h-3 w-3 mr-1" />
                        Signs of Failure
                      </p>
                      <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-0.5">
                        {(risk.signsOfFailure || risk.symptoms).map((s, si) => <li key={si}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Inline Evidence Capture */}
                  {risk.capturePrompts && risk.capturePrompts.length > 0 && onUploadEvidence && (
                    <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                      <p className="text-[10px] font-bold uppercase text-indigo-700 mb-2">
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
                                <div className="h-10 w-10 rounded border border-green-300 bg-green-50 overflow-hidden shrink-0 relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={captured.url} alt="" className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </div>
                                </div>
                              ) : isUploading ? (
                                <div className="h-10 w-10 rounded border border-indigo-300 bg-indigo-100 flex items-center justify-center shrink-0">
                                  <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ref = fileInputRefs.current[captureKey];
                                    ref?.click();
                                  }}
                                  className="h-10 w-10 rounded border-2 border-dashed border-indigo-300 bg-white flex items-center justify-center shrink-0 hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                                >
                                  <Camera className="h-4 w-4 text-indigo-500" />
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
                              <p className="text-[11px] text-indigo-800 leading-tight flex-1">{prompt}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Already-captured evidence thumbnails (from CaptureGrid or previous sessions) */}
                  {riskMedia.length > 0 && !onUploadEvidence && (
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="text-[11px] text-blue-700 font-medium">{riskMedia.length} photo(s) captured</span>
                      <div className="flex gap-1">
                        {riskMedia.slice(0, 4).map((m) => (
                          <div key={m.mediaId} className="h-8 w-8 rounded border border-blue-200 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                        {riskMedia.length > 4 && (
                          <div className="h-8 w-8 rounded border border-blue-200 flex items-center justify-center bg-blue-50 text-[10px] font-bold text-blue-600">
                            +{riskMedia.length - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Why It Matters + Cost */}
                  {(risk.whyItMatters || risk.description) && (
                    <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                      <div className="flex items-start gap-2">
                        <Info className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase text-purple-700 mb-0.5">Why It Matters</p>
                          <p className="text-[11px] text-purple-800 leading-relaxed">
                            {risk.whyItMatters || risk.description}
                          </p>
                        </div>
                      </div>
                      {risk.cost.low > 0 && (
                        <p className="text-[11px] font-semibold text-purple-700 mt-1.5 ml-5">
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
                        risk.likelihood === "VERY_COMMON" ? "bg-red-100 text-red-700" :
                        risk.likelihood === "COMMON" ? "bg-orange-100 text-orange-700" :
                        risk.likelihood === "OCCASIONAL" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {risk.likelihood.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-gray-400">likelihood on this vehicle</span>
                    </div>
                  )}

                  {/* Active recall info */}
                  {risk.hasActiveRecall && risk.relatedRecalls && risk.relatedRecalls.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-[10px] font-bold uppercase text-red-700 mb-1">Active Recall</p>
                      <p className="text-[11px] text-red-800">{risk.relatedRecalls[0].remedy}</p>
                    </div>
                  )}

                  {/* No evidence warning */}
                  {isCheckedWithoutPhotos && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <p className="text-[11px] text-amber-700">
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
                          className="text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Issue Found
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onCheckRisk(risk.id, "NOT_FOUND")}
                          className="text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
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
                        className="text-xs text-gray-400"
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
