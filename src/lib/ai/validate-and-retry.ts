/**
 * Validated AI Call Pattern — 3-Tier Reliability
 *
 * Every AI valuation module uses this wrapper to ensure:
 *   1. Primary call with field-level validation + targeted follow-up
 *   2. Simplified AI fallback (different/upgraded model)
 *   3. Emergency heuristic (flagged, never silent)
 *
 * This solves the "lost info" problem — instead of retrying the whole call
 * or accepting partial data, we surgically ask for what's missing.
 */

import { getOpenAI } from "@/lib/openai";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ValidationSuccess<T> {
  valid: true;
  data: T;
}

export interface ValidationFailure {
  valid: false;
  /** Partial data that was successfully parsed */
  partial: unknown;
  /** Human-readable list of what's missing or invalid */
  errors: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface AICallConfig<T> {
  /** Label for logging, e.g. "[HistoryAdjuster]" */
  label: string;

  /** Primary AI call configuration */
  primary: {
    model: string;
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  };

  /** Validate the parsed JSON response. Return valid data or list of errors. */
  validate: (parsed: unknown) => ValidationResult<T>;

  /**
   * Build a follow-up prompt to ask for specific missing fields.
   * Receives the partial data and list of errors from validation.
   */
  buildFollowUp: (partial: unknown, errors: string[]) => string;

  /** Simplified AI fallback — used if primary + follow-up both fail */
  simplified: {
    model: string;
    buildPrompt: () => string;
  };

  /** Emergency heuristic fallback — used if all AI calls fail */
  emergencyFallback: () => T;
}

export interface AIResult<T> {
  /** The result data */
  result: T;
  /** Whether any AI was used (false = emergency heuristic only) */
  aiAnalyzed: boolean;
  /** Which tier produced the result: 1=primary, 2=simplified AI, 3=emergency heuristic */
  fallbackTier: 1 | 2 | 3;
  /** Whether a follow-up call was needed within the tier */
  retried: boolean;
  /** Which model produced the result */
  model: string;
  /** AI reasoning (if available) */
  reasoning?: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

/**
 * Execute a validated AI call with 3-tier reliability.
 *
 * Flow:
 *   Tier 1: Primary call → validate → follow-up if partial → validate
 *   Tier 2: Simplified AI call (different prompt, possibly upgraded model) → validate
 *   Tier 3: Emergency heuristic fallback (flagged)
 */
export async function validatedAICall<T>(config: AICallConfig<T>): Promise<AIResult<T>> {
  const { label, primary, validate, buildFollowUp, simplified, emergencyFallback } = config;

  // ── Tier 1: Primary call ─────────────────────────────────────────
  try {
    const openai = getOpenAI();
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

    if (primary.systemPrompt) {
      messages.push({ role: "system", content: primary.systemPrompt });
    }
    messages.push({ role: "user", content: primary.userPrompt });

    const response = await openai.chat.completions.create({
      model: primary.model,
      messages,
      temperature: primary.temperature ?? 0.1,
      max_tokens: primary.maxTokens ?? 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const result = validate(parsed);

      if (result.valid) {
        const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : undefined;
        console.log(`${label} Tier 1 success (${primary.model})`);
        return {
          result: result.data,
          aiAnalyzed: true,
          fallbackTier: 1,
          retried: false,
          model: primary.model,
          reasoning,
        };
      }

      // Validation failed — try follow-up for missing fields
      console.log(`${label} Tier 1 partial — missing: ${result.errors.join(", ")}`);

      try {
        const followUpPrompt = buildFollowUp(result.partial, result.errors);
        const followUpResponse = await openai.chat.completions.create({
          model: primary.model,
          messages: [
            ...messages,
            { role: "assistant", content },
            { role: "user", content: followUpPrompt },
          ],
          temperature: primary.temperature ?? 0.1,
          max_tokens: primary.maxTokens ?? 800,
          response_format: { type: "json_object" },
        });

        const followUpContent = followUpResponse.choices[0]?.message?.content;
        if (followUpContent) {
          const followUpParsed = JSON.parse(followUpContent);
          // Merge: follow-up data overwrites original partial data
          const merged = { ...parsed, ...followUpParsed };
          const mergedResult = validate(merged);

          if (mergedResult.valid) {
            const reasoning = typeof merged.reasoning === "string" ? merged.reasoning : undefined;
            console.log(`${label} Tier 1 success after follow-up (${primary.model})`);
            return {
              result: mergedResult.data,
              aiAnalyzed: true,
              fallbackTier: 1,
              retried: true,
              model: primary.model,
              reasoning,
            };
          }
        }
      } catch (followUpErr) {
        console.warn(`${label} Follow-up failed: ${followUpErr instanceof Error ? followUpErr.message : followUpErr}`);
      }
    }
  } catch (err) {
    console.warn(`${label} Tier 1 failed: ${err instanceof Error ? err.message : err}`);
  }

  // ── Tier 2: Simplified AI fallback ───────────────────────────────
  try {
    console.log(`${label} Falling back to Tier 2 (${simplified.model})`);
    const openai = getOpenAI();

    const simplifiedPrompt = simplified.buildPrompt();
    const response = await openai.chat.completions.create({
      model: simplified.model,
      messages: [{ role: "user", content: simplifiedPrompt }],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const result = validate(parsed);

      if (result.valid) {
        const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : undefined;
        console.log(`${label} Tier 2 success (${simplified.model})`);
        return {
          result: result.data,
          aiAnalyzed: true,
          fallbackTier: 2,
          retried: false,
          model: simplified.model,
          reasoning,
        };
      }

      console.warn(`${label} Tier 2 validation failed: ${result.errors.join(", ")}`);
    }
  } catch (err) {
    console.warn(`${label} Tier 2 failed: ${err instanceof Error ? err.message : err}`);
  }

  // ── Tier 3: Emergency heuristic ──────────────────────────────────
  console.warn(`${label} ⚠ ALL AI CALLS FAILED — using emergency heuristic fallback`);
  return {
    result: emergencyFallback(),
    aiAnalyzed: false,
    fallbackTier: 3,
    retried: false,
    model: "heuristic",
    reasoning: "Emergency fallback — all AI calls failed",
  };
}
