"use client";

import { useRef } from "react";
import { Camera, CheckCircle, XCircle, Loader2, AlertTriangle, MapPin, Wrench, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { AggregatedRisk, QuestionAnswer, InspectionQuestion } from "@/types/risk";

interface GuidedRiskCheckProps {
  risk: AggregatedRisk;
  questionAnswers: QuestionAnswer[];
  onAnswerQuestion: (questionId: string, answer: "yes" | "no") => void;
  onUploadMedia?: (questionId: string, file: File) => Promise<string | null>;
  uploadingQuestionId?: string | null;
  onSkip: () => void;
  onManualOverride: (status: "CONFIRMED" | "NOT_FOUND") => void;
  status: string;
}

export function GuidedRiskCheck({
  risk,
  questionAnswers,
  onAnswerQuestion,
  onUploadMedia,
  uploadingQuestionId,
  onSkip,
  onManualOverride,
  status,
}: GuidedRiskCheckProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const questions = risk.inspectionQuestions || [];

  // Build answer lookup
  const answerMap = new Map<string, QuestionAnswer>();
  for (const qa of questionAnswers) {
    answerMap.set(qa.questionId, qa);
  }

  // Compute results
  const answeredCount = questions.filter((q) => answerMap.has(q.id) && answerMap.get(q.id)!.answer != null).length;
  const allAnswered = answeredCount >= questions.length;
  const failedQuestions = questions.filter((q) => {
    const qa = answerMap.get(q.id);
    return qa && qa.answer === q.failureAnswer;
  });
  const hasFailures = failedQuestions.length > 0;

  const handleFileSelect = async (questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadMedia) return;
    await onUploadMedia(questionId, file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Instruction header */}
      <div className="space-y-1.5">
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
            </span>
          </div>
        )}
      </div>

      {/* Questions */}
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
              {/* Question number + text */}
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

              {/* Yes / No buttons */}
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

                {/* Inline camera when failure detected + mediaPrompt exists */}
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
                      {questionMedia.length > 0 ? `${questionMedia.length} photo${questionMedia.length > 1 ? "s" : ""}` : "Add Photo"}
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

              {/* Media prompt hint */}
              {showMediaPrompt && questionMedia.length === 0 && (
                <p className="text-[11px] text-amber-600 ml-7 mt-1.5 italic">
                  📸 {q.mediaPrompt}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Auto-verdict summary */}
      {allAnswered && (
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
                  All checks passed
                </span>
              </>
            )}
          </div>

          {status === "NOT_CHECKED" && (
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
        </div>
      )}

      {/* Progress + skip */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-tertiary">
          {answeredCount}/{questions.length} questions answered
        </span>
        {status === "NOT_CHECKED" && (
          <button
            onClick={onSkip}
            className="text-[11px] text-text-tertiary hover:text-text-secondary underline"
          >
            Unable to inspect
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
