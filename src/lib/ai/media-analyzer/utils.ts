/**
 * Shared utilities for the media analysis pipeline.
 *
 * Includes: concurrency helper, photo URL validation, GPT-4o vision wrapper.
 */

import { getOpenAI } from "@/lib/openai";
import type { MediaForAnalysis } from "./types";

// ---------------------------------------------------------------------------
//  Concurrency helper (moved from old media-analyzer.ts)
// ---------------------------------------------------------------------------

export async function processWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  maxConcurrent: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrent, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
//  Photo URL validation
// ---------------------------------------------------------------------------

/**
 * Validates photo URLs via HEAD request. Returns only photos with accessible URLs.
 * Dead URLs cause OpenAI to return 400 errors, so we filter them out.
 */
export async function validatePhotoUrls(
  photos: MediaForAnalysis[],
  label: string,
): Promise<MediaForAnalysis[]> {
  const valid: MediaForAnalysis[] = [];

  await Promise.all(
    photos.map(async (m) => {
      try {
        // Use GET with Range header to fetch only the first byte.
        // HEAD requests fail on some storage providers (e.g., Supabase Storage
        // returns 400/405 for HEAD on public object URLs). A ranged GET is
        // equally lightweight but universally supported.
        const res = await fetch(m.url, {
          method: "GET",
          headers: { Range: "bytes=0-0" },
          signal: AbortSignal.timeout(5000),
        });
        // 200 (full body) or 206 (partial content) both mean the URL is valid
        if (res.ok || res.status === 206) {
          valid.push(m);
        } else {
          console.warn(
            `[media-analyzer:${label}] skipping broken URL (${res.status}) for ${m.captureType}`,
          );
        }
      } catch {
        console.warn(
          `[media-analyzer:${label}] skipping unreachable URL for ${m.captureType}`,
        );
      }
    }),
  );

  return valid;
}

// ---------------------------------------------------------------------------
//  GPT-4o Vision call wrapper
// ---------------------------------------------------------------------------

interface VisionCallOptions {
  model?: "gpt-4o" | "gpt-4o-mini";
  systemPrompt: string;
  userText: string;
  photos: MediaForAnalysis[];
  /** Additional images as data URLs (e.g., cropped zones). Sent after photos. */
  extraImageUrls?: { url: string; label: string }[];
  temperature?: number;
  maxTokens?: number;
  label: string;
}

/**
 * Makes a single GPT-4o Vision API call with photos.
 * Returns the parsed JSON response or null on failure.
 */
export async function callVision<T = Record<string, unknown>>(
  options: VisionCallOptions,
): Promise<{ result: T; raw: string } | null> {
  const {
    model = "gpt-4o",
    systemPrompt,
    userText,
    photos,
    extraImageUrls,
    temperature = 0.2,
    maxTokens = 1000,
    label,
  } = options;

  const openai = getOpenAI();

  const imageBlocks = [
    ...photos.map((m) => ({
      type: "image_url" as const,
      image_url: { url: m.url, detail: "high" as const },
    })),
    ...(extraImageUrls || []).map((img) => ({
      type: "image_url" as const,
      image_url: { url: img.url, detail: "high" as const },
    })),
  ];

  // Never give up on retryable errors (429 rate limit, timeouts).
  // The inspection depends on every photo being analyzed.
  let attempt = 0;

  while (true) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              ...imageBlocks,
            ],
          },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) {
        console.warn(`[media-analyzer:${label}] empty response from ${model}`);
        return null;
      }

      const parsed = JSON.parse(raw) as T;
      return { result: parsed, raw };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || msg.includes("Rate limit");
      const isTimeout = msg.includes("timeout") || msg.includes("Timeout");

      if (is429 || isTimeout) {
        attempt++;
        // Extract wait time from error message if available (e.g., "Please try again in 5.108s")
        const waitMatch = msg.match(/try again in (\d+\.?\d*)/);
        const waitSec = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) + 1 : Math.min(attempt * 5, 30);
        console.warn(`[media-analyzer:${label}] ${is429 ? "rate limited" : "timeout"}, retrying in ${waitSec}s (attempt ${attempt})`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }

      // Non-retryable error (bad request, auth, etc.) — give up on this call
      console.error(`[media-analyzer:${label}] ${model} call failed (non-retryable): ${msg}`);
      return null;
    }
  }

  return null;
}

/**
 * Builds a photo label string for prompts, e.g.:
 * "Photo 0: FRONT CENTER\nPhoto 1: DRIVER SIDE"
 */
export function buildPhotoLabels(photos: MediaForAnalysis[]): string {
  return photos
    .map((m, i) => `Photo ${i}: ${m.captureType.replace(/_/g, " ")}`)
    .join("\n");
}
