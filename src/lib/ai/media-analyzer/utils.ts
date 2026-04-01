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
        const res = await fetch(m.url, {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
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
    temperature = 0.2,
    maxTokens = 1000,
    label,
  } = options;

  const openai = getOpenAI();

  const imageBlocks = photos.map((m) => ({
    type: "image_url" as const,
    image_url: { url: m.url, detail: "high" as const },
  }));

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
    console.error(`[media-analyzer:${label}] ${model} call failed: ${msg}`);
    return null;
  }
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
