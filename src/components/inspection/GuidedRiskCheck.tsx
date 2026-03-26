"use client";

import { useRef } from "react";
import { Camera, CheckCircle, Loader2, AlertTriangle, MapPin, Wrench, DollarSign, ImageIcon, RefreshCw, X } from "lucide-react";
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
  /** For photo-check: capture the primary evidence photo for this risk */
  onCaptureRiskPhoto?: (file: File) => Promise<string | null>;
  /** Replace a specific evidence photo (retake) */
  onRetakeRiskPhoto?: (captureIndex: number, file: File) => Promise<string | null>;
  uploadingQuestionId?: string | null;
  /** Is the primary risk photo currently uploading? */
  uploadingRiskPhoto?: boolean;
  /** Number of photos already captured for this risk */
  riskPhotoCount?: number;
  /** Actual media items with URLs for preview */
  riskPhotos?: RiskMediaItem[];
  onSkip: () => void;
  onManualOverride: (status: "CONFIRMED" | "NOT_FOUND") => void;
  status: string;
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
}: GuidedRiskCheckProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const riskPhotoRef = useRef<HTMLInputElement | null>(null);

  const checkMethod = risk.checkMethod || "photo";
  const questions = risk.inspectionQuestions || [];
  const hasQuestions = questions.length > 0 && (checkMethod === "manual" || checkMethod === "both");
  const hasPhotoCapture = checkMethod === "photo" || checkMethod === "both";

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

  // Get all capture prompts
  const capturePrompts = risk.capturePrompts?.length
    ? risk.capturePrompts
    : [`Photograph the ${risk.whatToCheck || risk.title}`];
  const recommendedPhotos = capturePrompts.length;

  // Photo capture state — complete when at least 1 photo taken (recommended = all prompts)
  const hasPhotos = riskPhotoCount > 0;
  const photoComplete = !hasPhotoCapture || hasPhotos;

  // Overall readiness
  const isComplete = photoComplete && allQuestionsAnswered;

  const handleFileSelect = async (questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadMedia) return;
    await onUploadMedia(questionId, file);
    e.target.value = "";
  };

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
      // Fallback: just add another photo
      await onCaptureRiskPhoto(file);
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Instruction header */}
      <div className="space-y-1.5">
        {risk.description && (
          <p className="text-xs text-text-secondary leading-relaxed">
            {risk.description}
          </p>
        )}
        {risk.whatToCheck && (
          <div className="flex items-start gap-1.5 text-xs">
            <Wrench className="h-3.5 w-3.5 text-brand-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-text-primary">Check: </span>
              <span className="text-text-secondary">{risk.whatToCheck}</span>
            </div>
          </div>
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
        {risk.cost.low > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            <span className="text-text-secondary">
              Est. repair: <span className="font-medium text-text-primary">{formatCurrency(risk.cost.low)} – {formatCurrency(risk.cost.high)}</span>
              {risk.costTiers && risk.costTiers.length > 0 && (
                <span className="text-text-tertiary ml-1">(narrows after inspection)</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ─── PHOTO CAPTURE SECTION (photo / both) ─── */}
      {hasPhotoCapture && (
        <div className={cn(
          "rounded-lg border p-3 transition-all",
          riskPhotoCount >= recommendedPhotos ? "border-green-200 bg-green-50/50" :
          hasPhotos ? "border-amber-300 bg-amber-50/30" :
          "border-brand-400 bg-brand-50/30"
        )}>
          <div className="flex items-start gap-2 mb-2">
            <ImageIcon className={cn(
              "h-4 w-4 shrink-0 mt-0.5",
              riskPhotoCount >= recommendedPhotos ? "text-green-600" :
              hasPhotos ? "text-amber-600" : "text-brand-600"
            )} />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">
                {riskPhotoCount >= recommendedPhotos
                  ? `${riskPhotoCount} photo${riskPhotoCount > 1 ? "s" : ""} captured`
                  : hasPhotos
                    ? `${riskPhotoCount} of ${recommendedPhotos} photos`
                    : `Capture ${recommendedPhotos} photo${recommendedPhotos > 1 ? "s" : ""}`}
              </p>
              {recommendedPhotos > 1 && !hasPhotos && (
                <p className="text-[11px] text-text-tertiary mt-0.5">
                  Multiple angles needed for accurate cost assessment
                </p>
              )}
            </div>
          </div>

          {/* Capture prompts with photo previews */}
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

                  {/* Photo thumbnail with retake */}
                  {isCaptured && photo && (
                    <div className="ml-5 relative group inline-block">
                      <div className="relative rounded-lg overflow-hidden border border-green-200 w-28 h-20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={`Evidence photo ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {/* Retake overlay on hover */}
                        <button
                          onClick={() => fileInputRefs.current[`retake-${i}`]?.click()}
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
                        ref={(el) => { fileInputRefs.current[`retake-${i}`] = el; }}
                        onChange={(e) => handleRetakePhoto(i, e)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add / next photo button */}
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
              {uploadingRiskPhoto ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {riskPhotoCount >= recommendedPhotos
                ? "Add Another Photo"
                : hasPhotos
                  ? `Take Photo ${riskPhotoCount + 1} of ${recommendedPhotos}`
                  : "Take Photo"}
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

          {/* Signs of failure hints */}
          {!hasPhotos && risk.signsOfFailure && risk.signsOfFailure.length > 0 && (
            <div className="ml-6 mt-2">
              <p className="text-[11px] font-semibold text-text-secondary mb-0.5">Look for:</p>
              <ul className="text-[11px] text-text-tertiary list-disc list-inside">
                {risk.signsOfFailure.slice(0, 3).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ─── MANUAL QUESTIONS SECTION (manual / both) ─── */}
      {hasQuestions && (
        <>
          {checkMethod === "both" && (
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Hands-on checks
            </p>
          )}
          <div className="space-y-2">
            {questions.map((q, idx) => {
              const qa = answerMap.get(q.id);
              const answer = qa?.answer;
              const isFailure = answer === q.failureAnswer;
              const isAnswered = answer === "yes" || answer === "no";
              const showMediaPrompt = isFailure && q.mediaPrompt;
              const questionMedia = qa?.mediaIds || [];

              return (
                <div
                  key={q.id}
                  className={cn(
                    "rounded-lg border p-2.5 transition-all",
                    isAnswered && isFailure ? "border-red-300 bg-red-50" :
                    isAnswered ? "border-green-200 bg-green-50/50" :
                    "border-border-default bg-surface-raised"
                  )}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className={cn(
                      "shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      isAnswered && isFailure ? "bg-red-200 text-red-800" :
                      isAnswered ? "bg-green-200 text-green-800" :
                      "bg-surface-overlay text-text-tertiary"
                    )}>
                      {isAnswered ? (isFailure ? "✗" : "✓") : idx + 1}
                    </span>
                    <p className="text-sm text-text-primary leading-snug flex-1">
                      {q.question}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-7">
                    <button
                      onClick={() => onAnswerQuestion(q.id, "yes")}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        answer === "yes"
                          ? (q.failureAnswer === "yes" ? "bg-red-600 text-white" : "bg-green-600 text-white")
                          : "bg-surface-overlay text-text-secondary hover:bg-surface-sunken"
                      )}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => onAnswerQuestion(q.id, "no")}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        answer === "no"
                          ? (q.failureAnswer === "no" ? "bg-red-600 text-white" : "bg-green-600 text-white")
                          : "bg-surface-overlay text-text-secondary hover:bg-surface-sunken"
                      )}
                    >
                      No
                    </button>

                    {showMediaPrompt && onUploadMedia && (
                      <>
                        <button
                          onClick={() => fileInputRefs.current[q.id]?.click()}
                          className={cn(
                            "ml-auto flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                            questionMedia.length > 0
                              ? "bg-brand-100 text-brand-700"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          )}
                        >
                          {uploadingQuestionId === q.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Camera className="h-3.5 w-3.5" />
                          )}
                          {questionMedia.length > 0 ? `${questionMedia.length}` : "Photo"}
                        </button>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          capture="environment"
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[q.id] = el; }}
                          onChange={(e) => handleFileSelect(q.id, e)}
                        />
                      </>
                    )}
                  </div>

                  {showMediaPrompt && questionMedia.length === 0 && (
                    <p className="text-[11px] text-amber-600 ml-7 mt-1.5 italic">
                      📸 {q.mediaPrompt}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ─── VERDICT SUMMARY ─── */}
      {isComplete && (
        <div className={cn(
          "rounded-lg p-3 border",
          hasFailures ? "bg-red-50 border-red-300" : "bg-green-50 border-green-200"
        )}>
          <div className="flex items-center gap-2 mb-2">
            {hasFailures ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">
                  {failedQuestions.length} issue{failedQuestions.length > 1 ? "s" : ""} detected
                </span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">
                  {hasQuestions ? "All checks passed" : "Photo captured for AI analysis"}
                </span>
              </>
            )}
          </div>

          {status === "NOT_CHECKED" && hasQuestions && (
            <button
              onClick={() => onManualOverride(hasFailures ? "CONFIRMED" : "NOT_FOUND")}
              className={cn(
                "w-full py-2 rounded-lg text-sm font-medium transition-colors",
                hasFailures
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              )}
            >
              {hasFailures ? "Mark as Issue Found" : "Mark as Clear"}
            </button>
          )}

          {/* For photo-only checks, the verdict comes from AI analysis later */}
          {!hasQuestions && status === "NOT_CHECKED" && (
            <p className="text-xs text-text-secondary">
              AI will analyze this photo during the analysis step.
            </p>
          )}
        </div>
      )}

      {/* Progress + skip */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-tertiary">
          {hasQuestions && `${answeredCount}/${questions.length} checks`}
          {hasQuestions && hasPhotoCapture && " · "}
          {hasPhotoCapture && `${riskPhotoCount} photo${riskPhotoCount !== 1 ? "s" : ""}`}
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

      {/* Recall info */}
      {risk.hasActiveRecall && risk.relatedRecalls && risk.relatedRecalls.length > 0 && (
        <div className="p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
          <span className="font-bold">Recall: </span>
          {risk.relatedRecalls[0].remedy}
        </div>
      )}
    </div>
  );
}
