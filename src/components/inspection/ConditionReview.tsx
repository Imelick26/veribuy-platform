"use client";

import { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Eye, Camera, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export interface PreliminaryFinding {
  index: number;
  title: string;
  description: string;
  severity: string;
  category: string;
  confidence: number;
  photoIndex: number;
  photoId: string | null;
}

export interface FindingReviewState {
  verified: boolean;
  notes?: string;
  mediaId?: string;
  reviewedAt: string;
}

interface ConditionReviewProps {
  findings: PreliminaryFinding[];
  reviews: Record<string, FindingReviewState>;
  /** Source photos from the inspection (for thumbnail display) */
  mediaUrls: Record<string, string>; // photoId → url
  onReviewFinding: (findingIndex: number, verified: boolean) => void;
  onComplete: () => void;
  isCompleting: boolean;
  /** Preliminary AI scores before verification */
  preliminaryScore?: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  MAJOR: "bg-orange-100 text-orange-800 border-orange-200",
  MODERATE: "bg-amber-100 text-amber-800 border-amber-200",
  MINOR: "bg-blue-100 text-blue-800 border-blue-200",
  INFO: "bg-gray-100 text-gray-600 border-gray-200",
};

const SEVERITY_RING: Record<string, string> = {
  CRITICAL: "ring-red-300",
  MAJOR: "ring-orange-300",
  MODERATE: "ring-amber-300",
  MINOR: "ring-blue-200",
  INFO: "ring-gray-200",
};

export function ConditionReview({
  findings,
  reviews,
  mediaUrls,
  onReviewFinding,
  onComplete,
  isCompleting,
  preliminaryScore,
}: ConditionReviewProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    findings.length > 0 ? findings[0].index : null,
  );

  const reviewedCount = Object.keys(reviews).length;
  const confirmedCount = Object.values(reviews).filter((r) => r.verified).length;
  const dismissedCount = Object.values(reviews).filter((r) => !r.verified).length;
  const allReviewed = reviewedCount >= findings.length;

  // Auto-advance to next unreviewed finding
  const advanceToNext = (currentIndex: number) => {
    const next = findings.find(
      (f) => f.index !== currentIndex && !reviews[String(f.index)],
    );
    setExpandedIndex(next?.index ?? null);
  };

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-600" />
        <p className="text-sm font-medium text-green-800">
          No issues detected by AI scan
        </p>
        <p className="mt-1 text-xs text-green-600">
          Condition scores are clean. Continue to risk inspection.
        </p>
        <button
          onClick={onComplete}
          disabled={isCompleting}
          className="mt-4 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isCompleting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Finalizing...
            </span>
          ) : (
            "Continue"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Verify AI Findings
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              The AI flagged {findings.length} potential issue{findings.length !== 1 ? "s" : ""}.
              Confirm which ones are real.
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900">
              {reviewedCount} / {findings.length}
            </div>
            <div className="text-xs text-slate-500">reviewed</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(reviewedCount / findings.length) * 100}%` }}
          />
        </div>

        {/* Summary chips */}
        {reviewedCount > 0 && (
          <div className="mt-2 flex gap-2">
            {confirmedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                <XCircle className="h-3 w-3" />
                {confirmedCount} confirmed
              </span>
            )}
            {dismissedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle className="h-3 w-3" />
                {dismissedCount} dismissed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Finding cards */}
      {findings.map((finding) => {
        const review = reviews[String(finding.index)];
        const isExpanded = expandedIndex === finding.index;
        const photoUrl = finding.photoId ? mediaUrls[finding.photoId] : null;

        return (
          <div
            key={finding.index}
            className={cn(
              "overflow-hidden rounded-xl border transition-all",
              review?.verified
                ? "border-red-200 bg-red-50/50"
                : review && !review.verified
                  ? "border-green-200 bg-green-50/50 opacity-60"
                  : isExpanded
                    ? `border-slate-300 bg-white ring-2 ${SEVERITY_RING[finding.severity] || "ring-slate-200"}`
                    : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            {/* Card header — clickable to expand */}
            <button
              onClick={() => setExpandedIndex(isExpanded ? null : finding.index)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              {/* Status icon */}
              {review?.verified ? (
                <XCircle className="h-5 w-5 shrink-0 text-red-500" />
              ) : review && !review.verified ? (
                <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    review && !review.verified ? "line-through text-slate-400" : "text-slate-900",
                  )}>
                    {finding.title}
                  </span>
                  <span className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                    SEVERITY_COLORS[finding.severity],
                  )}>
                    {finding.severity}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {Math.round(finding.confidence * 100)}% confidence
                  {review?.verified ? " — confirmed by inspector" : ""}
                  {review && !review.verified ? " — dismissed" : ""}
                </p>
              </div>
            </button>

            {/* Expanded detail + verification */}
            {isExpanded && !review && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                {/* Source photo */}
                {photoUrl && (
                  <div className="mb-3">
                    <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl}
                        alt={finding.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                        <Camera className="h-3 w-3" />
                        Source photo
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                <p className="mb-4 text-sm text-slate-700">
                  {finding.description}
                </p>

                {/* Verification buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      onReviewFinding(finding.index, true);
                      advanceToNext(finding.index);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 active:bg-red-200"
                  >
                    <XCircle className="h-4 w-4" />
                    Yes, Issue Present
                  </button>
                  <button
                    onClick={() => {
                      onReviewFinding(finding.index, false);
                      advanceToNext(finding.index);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100 active:bg-green-200"
                  >
                    <CheckCircle className="h-4 w-4" />
                    No, Looks Fine
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Complete button */}
      {allReviewed && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                All findings reviewed
              </p>
              <p className="text-xs text-blue-600">
                {confirmedCount} confirmed, {dismissedCount} dismissed
                {preliminaryScore != null && (
                  <> &middot; AI score: {preliminaryScore}/100</>
                )}
              </p>
            </div>
            <button
              onClick={onComplete}
              disabled={isCompleting}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCompleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finalizing...
                </span>
              ) : (
                "Finalize Condition"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
