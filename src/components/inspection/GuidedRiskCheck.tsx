"use client";

import { useRef, useState, useEffect } from "react";
import { Camera, CheckCircle, Loader2, AlertTriangle, MapPin, Wrench, DollarSign, Info, ChevronDown, RefreshCw, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { AggregatedRisk, QuestionAnswer } from "@/types/risk";

export interface RiskMediaItem {
  mediaId: string;
  url: string;
  captureType: string;
}

interface GuidedRiskCheckProps {
  risk: AggregatedRisk;
  questionAnswers: QuestionAnswer[];
  onAnswerQuestion: (questionId: string, answer: "yes" | "no") => void;
  onUploadMedia?: (questionId: string, file: File) => Promise<string | null>;
  /** For evidence photo capture when failure is detected */
  onCaptureRiskPhoto?: (file: File) => Promise<string | null>;
  /** Replace a specific evidence photo (retake) */
  onRetakeRiskPhoto?: (captureIndex: number, file: File) => Promise<string | null>;
  uploadingQuestionId?: string | null;
  /** Is the evidence photo currently uploading? */
  uploadingRiskPhoto?: boolean;
  /** Number of photos already captured for this risk */
  riskPhotoCount?: number;
  /** Actual media items with URLs for preview */
  riskPhotos?: RiskMediaItem[];
  onSkip: () => void;
  onManualOverride: (status: "CONFIRMED" | "NOT_FOUND") => void;
  status: string;
  /** Whether this is the first expanded risk (shows whatThisIs expanded) */
  isFirstRisk?: boolean;
}

export function GuidedRiskCheck({
  risk,
  questionAnswers,
  onAnswerQuestion,
  onUploadMedia,
  onCaptureRiskPhoto,
  onRetakeRiskPhoto,
  uploadingQuestionId,
  uploadingRiskPhoto,
  riskPhotoCount = 0,
  riskPhotos = [],
  onSkip,
  onManualOverride,
  status,
  isFirstRisk = false,
}: GuidedRiskCheckProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const riskPhotoRef = useRef<HTMLInputElement | null>(null);
  const [guidanceExpanded, setGuidanceExpanded] = useState(isFirstRisk);

  const questions = risk.inspectionQuestions || [];
  const hasQuestions = questions.length > 0;

  // Build answer lookup
  const answerMap = new Map<string, QuestionAnswer>();
  for (const qa of questionAnswers) {
    answerMap.set(qa.questionId, qa);
  }

  // Question results
  const answeredCount = questions.filter((q) => answerMap.has(q.id) && answerMap.get(q.id)!.answer != null).length;
  const allQuestionsAnswered = !hasQuestions || answeredCount >= questions.length;
  const failedQuestions = questions.filter((q) => {
    const qa = answerMap.get(q.id);
    return qa && qa.answer === q.failureAnswer;
  });
  const hasFailures = failedQuestions.length > 0;

  // Evidence photo is needed when: checkMethod is "visual" AND there are failure answers
  const isVisualCheck = risk.checkMethod === "visual" || risk.checkMethod === "photo" || risk.checkMethod === "both";
  const needsEvidencePhoto = isVisualCheck && hasFailures;
  const hasEvidencePhoto = riskPhotoCount > 0;

  // Overall readiness — questions answered (photo is optional but prompted)
  const isComplete = allQuestionsAnswered;

  // Determine the evidence prompt to show
  const evidencePrompt = risk.evidencePrompt
    || (risk.capturePrompts?.length ? risk.capturePrompts[0] : null)
    || `Photograph the ${risk.whatToCheck || risk.title}`;

  // Use howToLocate if available, fall back to whereToLook
  const locationGuide = risk.howToLocate || risk.whereToLook;

  // Stable ref for onManualOverride to prevent effect re-fires
  const onManualOverrideRef = useRef(onManualOverride);
  onManualOverrideRef.current = onManualOverride;

  // Auto-resolve when all questions answered with no failures
  useEffect(() => {
    if (allQuestionsAnswered && hasQuestions && !hasFailures && status === "NOT_CHECKED") {
      onManualOverrideRef.current("NOT_FOUND");
    }
  }, [allQuestionsAnswered, hasQuestions, hasFailures, status]);

  const handleRiskPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onCaptureRiskPhoto) return;
    await onCaptureRiskPhoto(file);
    e.target.value = "";
  };

  const handleRetakePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (onRetakeRiskPhoto) {
      await onRetakeRiskPhoto(0, file);
    } else if (onCaptureRiskPhoto) {
      await onCaptureRiskPhoto(file);
    }
    e.target.value = "";
  };

  // Legacy path: risks without inspectionQuestions use old photo-capture flow
  if (!hasQuestions && (risk.checkMethod === "photo" || risk.checkMethod === "both")) {
    return <LegacyPhotoCheck
      risk={risk}
      onCaptureRiskPhoto={onCaptureRiskPhoto}
      onRetakeRiskPhoto={onRetakeRiskPhoto}
      uploadingRiskPhoto={uploadingRiskPhoto}
      riskPhotoCount={riskPhotoCount}
      riskPhotos={riskPhotos}
      onSkip={onSkip}
      onManualOverride={onManualOverride}
      status={status}
    />;
  }

  return (
    <div className="space-y-3">
      {/* ─── SECTION 1: GUIDANCE — What This Is + How to Locate ─── */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden">
        {/* What This Is — collapsible */}
        {risk.whatThisIs && (
          <button
            onClick={() => setGuidanceExpanded(!guidanceExpanded)}
            className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-blue-50/60 transition-colors"
          >
            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="text-xs font-semibold text-blue-700 flex-1">What is this?</span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-blue-400 transition-transform", guidanceExpanded && "rotate-180")} />
          </button>
        )}
        {risk.whatThisIs && guidanceExpanded && (
          <div className="px-2.5 pb-2.5 -mt-1">
            <p className="text-xs text-blue-800 leading-relaxed ml-5.5">
              {risk.whatThisIs}
            </p>
          </div>
        )}

        {/* How to Locate — always visible, this is the key guide */}
        {locationGuide && (
          <div className={cn(
            "p-2.5",
            risk.whatThisIs ? "border-t border-blue-200/60" : ""
          )}>
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-700 mb-1">How to find it</p>
                <div className="text-xs text-blue-800 leading-relaxed whitespace-pre-line">
                  {locationGuide}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cost info */}
        {risk.cost.low > 0 && (
          <div className="px-2.5 pb-2.5">
            <div className="flex items-center gap-1.5 text-xs ml-5.5">
              <DollarSign className="h-3 w-3 text-blue-400 shrink-0" />
              <span className="text-blue-600">
                If found: <span className="font-medium text-blue-700">{formatCurrency(risk.cost.low)} – {formatCurrency(risk.cost.high)}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: YES/NO QUESTIONS ─── */}
      {hasQuestions && (
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const qa = answerMap.get(q.id);
            const answer = qa?.answer;
            const isAnswered = answer === "yes" || answer === "no";
            const isFailing = isAnswered && answer === q.failureAnswer;

            return (
              <div
                key={q.id}
                className={cn(
                  "rounded-lg border p-2.5 transition-all",
                  isFailing ? "border-amber-300 bg-amber-50/50" :
                  isAnswered ? "border-green-200 bg-green-50/30" :
                  "border-border-default bg-surface-raised"
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={cn(
                    "shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    isFailing ? "bg-amber-200 text-amber-800" :
                    isAnswered ? "bg-green-200 text-green-800" :
                    "bg-surface-overlay text-text-tertiary"
                  )}>
                    {isFailing ? "!" : isAnswered ? "✓" : idx + 1}
                  </span>
                  <p className="text-sm text-text-primary leading-snug flex-1">
                    {q.question}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-7">
                  <button
                    onClick={() => onAnswerQuestion(q.id, "yes")}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                      answer === "yes"
                        ? answer === q.failureAnswer
                          ? "bg-amber-500 text-white"
                          : "bg-green-600 text-white"
                        : "bg-surface-overlay text-text-secondary hover:bg-surface-sunken"
                    )}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => onAnswerQuestion(q.id, "no")}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                      answer === "no"
                        ? answer === q.failureAnswer
                          ? "bg-amber-500 text-white"
                          : "bg-green-600 text-white"
                        : "bg-surface-overlay text-text-secondary hover:bg-surface-sunken"
                    )}
                  >
                    No
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── SECTION 3: EVIDENCE PHOTO — Only when failure detected ─── */}
      {needsEvidencePhoto && (
        <div className={cn(
          "rounded-lg border p-3 transition-all",
          hasEvidencePhoto ? "border-green-200 bg-green-50/30" : "border-amber-300 bg-amber-50/40"
        )}>
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className={cn(
              "h-4 w-4 shrink-0 mt-0.5",
              hasEvidencePhoto ? "text-green-600" : "text-amber-600"
            )} />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">
                {hasEvidencePhoto ? "Evidence captured" : "Issue detected — grab a photo"}
              </p>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                {evidencePrompt}
              </p>
            </div>
          </div>

          {/* Photo thumbnail if captured */}
          {hasEvidencePhoto && riskPhotos[0] && (
            <div className="ml-6 mb-2 relative group inline-block">
              <div className="relative rounded-lg overflow-hidden border border-green-200 w-28 h-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={riskPhotos[0].url}
                  alt="Evidence photo"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => fileInputRefs.current["retake"]?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-white" />
                  <span className="text-xs font-medium text-white">Retake</span>
                </button>
              </div>
              <input
                type="file"
                accept="image/*,video/*"
                capture="environment"
                className="hidden"
                ref={(el) => { fileInputRefs.current["retake"] = el; }}
                onChange={handleRetakePhoto}
              />
            </div>
          )}

          {/* Take photo button */}
          <div className="flex items-center gap-2 ml-6">
            <button
              onClick={() => riskPhotoRef.current?.click()}
              disabled={uploadingRiskPhoto}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                hasEvidencePhoto
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              )}
            >
              {uploadingRiskPhoto ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {hasEvidencePhoto ? "Retake Photo" : "Take Photo"}
            </button>
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              ref={riskPhotoRef}
              onChange={handleRiskPhotoSelect}
            />
          </div>
        </div>
      )}

      {/* ─── SECTION 4: COMPLETION / CONFIRM ─── */}
      {isComplete && hasFailures && status === "NOT_CHECKED" && (
        <div className="rounded-lg p-3 border border-amber-200 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">
              {failedQuestions.length} issue{failedQuestions.length > 1 ? "s" : ""} detected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onManualOverride("CONFIRMED")}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors bg-amber-500 text-white hover:bg-amber-600"
            >
              Confirm Issue{!hasEvidencePhoto && needsEvidencePhoto ? " (no photo)" : ""}
            </button>
          </div>
        </div>
      )}

      {/* Progress + skip */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-tertiary">
          {hasQuestions && `${answeredCount}/${questions.length} checks`}
          {hasEvidencePhoto && " · 1 photo"}
        </span>
        {status === "NOT_CHECKED" && (
          <button
            onClick={onSkip}
            className="text-[11px] text-text-tertiary hover:text-text-secondary underline"
          >
            Skip
          </button>
        )}
      </div>

    </div>
  );
}

/**
 * Legacy photo-capture flow for old-format risks without inspection questions.
 * Keeps backward compatibility.
 */
function LegacyPhotoCheck({
  risk,
  onCaptureRiskPhoto,
  onRetakeRiskPhoto,
  uploadingRiskPhoto,
  riskPhotoCount = 0,
  riskPhotos = [],
  onSkip,
  onManualOverride,
  status,
}: {
  risk: AggregatedRisk;
  onCaptureRiskPhoto?: (file: File) => Promise<string | null>;
  onRetakeRiskPhoto?: (captureIndex: number, file: File) => Promise<string | null>;
  uploadingRiskPhoto?: boolean;
  riskPhotoCount?: number;
  riskPhotos?: RiskMediaItem[];
  onSkip: () => void;
  onManualOverride: (status: "CONFIRMED" | "NOT_FOUND") => void;
  status: string;
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const riskPhotoRef = useRef<HTMLInputElement | null>(null);

  const capturePrompts = risk.capturePrompts?.length
    ? risk.capturePrompts
    : [`Photograph the ${risk.whatToCheck || risk.title}`];
  const recommendedPhotos = capturePrompts.length;
  const hasPhotos = riskPhotoCount > 0;

  const handleRiskPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onCaptureRiskPhoto) return;
    await onCaptureRiskPhoto(file);
    e.target.value = "";
  };

  const handleRetakePhoto = async (captureIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (onRetakeRiskPhoto) {
      await onRetakeRiskPhoto(captureIndex, file);
    } else if (onCaptureRiskPhoto) {
      await onCaptureRiskPhoto(file);
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {risk.description && (
        <p className="text-xs text-text-secondary leading-relaxed">{risk.description}</p>
      )}
      {risk.whereToLook && (
        <div className="flex items-start gap-1.5 text-xs">
          <MapPin className="h-3.5 w-3.5 text-brand-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-text-primary">Where: </span>
            <span className="text-text-secondary">{risk.whereToLook}</span>
          </div>
        </div>
      )}

      {/* Photo capture */}
      <div className={cn(
        "rounded-lg border p-3 transition-all",
        riskPhotoCount >= recommendedPhotos ? "border-green-200 bg-green-50/50" :
        hasPhotos ? "border-amber-300 bg-amber-50/30" :
        "border-brand-400 bg-brand-50/30"
      )}>
        <div className="ml-6 space-y-2 mb-2">
          {capturePrompts.map((prompt, i) => {
            const isCaptured = i < riskPhotoCount;
            const photo = riskPhotos[i];
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <span className={cn(
                    "shrink-0 mt-0.5 h-3.5 w-3.5 rounded-full flex items-center justify-center text-[8px] font-bold",
                    isCaptured ? "bg-green-200 text-green-800" : "bg-surface-overlay text-text-tertiary"
                  )}>
                    {isCaptured ? "✓" : i + 1}
                  </span>
                  <p className={cn(
                    "text-xs leading-snug flex-1",
                    isCaptured ? "text-text-tertiary" : "text-text-secondary"
                  )}>
                    {prompt}
                  </p>
                </div>
                {isCaptured && photo && (
                  <div className="ml-5 relative group inline-block">
                    <div className="relative rounded-lg overflow-hidden border border-green-200 w-28 h-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Evidence photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => fileInputRefs.current[`retake-${i}`]?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-white" />
                        <span className="text-xs font-medium text-white">Retake</span>
                      </button>
                    </div>
                    <input
                      type="file" accept="image/*,video/*" capture="environment" className="hidden"
                      ref={(el) => { fileInputRefs.current[`retake-${i}`] = el; }}
                      onChange={(e) => handleRetakePhoto(i, e)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-6">
          <button
            onClick={() => riskPhotoRef.current?.click()}
            disabled={uploadingRiskPhoto}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              riskPhotoCount >= recommendedPhotos
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-brand-gradient text-white hover:brightness-110"
            )}
          >
            {uploadingRiskPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {hasPhotos ? "Add Another Photo" : "Take Photo"}
          </button>
          <input type="file" accept="image/*,video/*" capture="environment" className="hidden" ref={riskPhotoRef} onChange={handleRiskPhotoSelect} />
        </div>
      </div>

      {/* Completion */}
      {hasPhotos && status === "NOT_CHECKED" && (
        <div className="rounded-lg p-3 border border-brand-200 bg-brand-50/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onManualOverride("NOT_FOUND")}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700"
            >
              Pass
            </button>
            <button
              onClick={() => onManualOverride("CONFIRMED")}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600"
            >
              Fail
            </button>
          </div>
          <p className="text-xs text-text-tertiary text-center mt-1.5">
            AI will also analyze these photos automatically.
          </p>
        </div>
      )}

      {status === "NOT_CHECKED" && (
        <div className="flex justify-end">
          <button onClick={onSkip} className="text-[11px] text-text-tertiary hover:text-text-secondary underline">Skip</button>
        </div>
      )}
    </div>
  );
}
