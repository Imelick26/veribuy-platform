"use client";

import { useState } from "react";
import { CheckCircle, XCircle, HelpCircle, Camera, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { formatCurrency, severityColor } from "@/lib/utils";
import type { AggregatedRisk, RiskCheckStatus } from "@/types/risk";

interface RiskChecklistProps {
  risks: AggregatedRisk[];
  checkStatuses: Record<string, RiskCheckStatus>;
  onCheckRisk: (riskId: string, status: RiskCheckStatus["status"], notes?: string) => void;
  onCreateFinding: (risk: AggregatedRisk) => void;
  onCaptureEvidence: (risk: AggregatedRisk) => void;
  onHighlightRisk: (riskId: string | null) => void;
  activeRiskId: string | null;
}

export function RiskChecklist({
  risks,
  checkStatuses,
  onCheckRisk,
  onCreateFinding,
  onCaptureEvidence,
  onHighlightRisk,
  activeRiskId,
}: RiskChecklistProps) {
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());

  const checkedCount = Object.values(checkStatuses).filter(
    (s) => s.status !== "NOT_CHECKED"
  ).length;
  const confirmedCount = Object.values(checkStatuses).filter(
    (s) => s.status === "CONFIRMED"
  ).length;
  const progressPct = risks.length > 0 ? (checkedCount / risks.length) * 100 : 0;

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

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Risk Inspection Checklist</h3>
          <p className="text-sm text-gray-500">
            {checkedCount} of {risks.length} risks inspected
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

      {/* Risk Items */}
      <div className="space-y-2">
        {risks.map((risk) => {
          const status = checkStatuses[risk.id]?.status || "NOT_CHECKED";
          const isExpanded = expandedRisks.has(risk.id);
          const isActive = activeRiskId === risk.id;

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
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{risk.category.replace(/_/g, " ")}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{getStatusLabel(status)}</span>
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
                  {/* Description */}
                  <p className="text-xs text-gray-600">{risk.description}</p>

                  {/* Repair cost */}
                  {risk.cost.low > 0 && (
                    <p className="text-xs font-medium text-gray-700">
                      Est. repair: {formatCurrency(risk.cost.low)} – {formatCurrency(risk.cost.high)}
                    </p>
                  )}

                  {/* Symptoms to look for */}
                  {risk.symptoms.length > 0 && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-[10px] font-bold uppercase text-amber-700 mb-1">
                        <AlertTriangle className="inline h-3 w-3 mr-1" />
                        Symptoms to Look For
                      </p>
                      <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-0.5">
                        {risk.symptoms.map((s, si) => <li key={si}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Inspection guidance */}
                  {risk.inspectionGuidance && (
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-[10px] font-bold uppercase text-blue-700 mb-1">Inspection Guidance</p>
                      <p className="text-[11px] text-blue-800">{risk.inspectionGuidance}</p>
                    </div>
                  )}

                  {/* Active recall info */}
                  {risk.hasActiveRecall && risk.relatedRecalls && risk.relatedRecalls.length > 0 && (
                    <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-[10px] font-bold uppercase text-red-700 mb-1">Active Recall</p>
                      <p className="text-[11px] text-red-800">{risk.relatedRecalls[0].remedy}</p>
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
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onCaptureEvidence(risk)}
                      className="text-xs"
                    >
                      <Camera className="h-3.5 w-3.5" /> Capture Evidence
                    </Button>
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
