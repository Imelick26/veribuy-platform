"use client";

/**
 * Client-side VIN OCR using Tesseract.js
 *
 * Processes door jamb sticker / VIN plate photos locally in the browser.
 * No API key required — runs entirely on the client.
 */

import Tesseract from "tesseract.js";

// VIN is always 17 characters: digits + uppercase letters (no I, O, Q)
const VIN_CHAR_RE = /[A-HJ-NPR-Z0-9]/g;
const VIN_LENGTH = 17;

/**
 * Common OCR misreads for VIN characters.
 * VINs never contain I, O, or Q — so we can confidently correct these.
 */
function correctOcrChar(ch: string): string {
  const corrections: Record<string, string> = {
    O: "0",
    o: "0",
    I: "1",
    i: "1",
    l: "1",
    "|": "1",
    Q: "0",
    q: "0",
    S: "5",
    s: "5",
    B: "8",
    D: "0",
    G: "6",
    Z: "2",
    " ": "",
  };
  // Only correct if the char is not already valid
  if (/[A-HJ-NPR-Z0-9]/.test(ch)) return ch;
  const upper = ch.toUpperCase();
  if (corrections[upper] !== undefined) return corrections[upper];
  if (corrections[ch] !== undefined) return corrections[ch];
  return ch.toUpperCase();
}

/**
 * Validate a VIN using the standard check-digit algorithm (position 9).
 * Returns true if the check digit is correct.
 */
function validateVinCheckDigit(vin: string): boolean {
  if (vin.length !== 17) return false;

  const transliteration: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = vin[i];
    const val = /\d/.test(ch) ? parseInt(ch) : (transliteration[ch] ?? 0);
    sum += val * weights[i];
  }
  const remainder = sum % 11;
  const checkChar = remainder === 10 ? "X" : String(remainder);
  return vin[8] === checkChar;
}

/**
 * Extract candidate VINs from raw OCR text.
 * Looks for 17-character sequences that look like VINs.
 */
function extractVinCandidates(rawText: string): string[] {
  const candidates: string[] = [];

  // Normalize: uppercase, remove common noise
  const text = rawText.toUpperCase().replace(/[^A-Z0-9\n\s]/g, " ");

  // Strategy 1: Look for 17-char alphanumeric sequences
  const words = text.split(/\s+/);
  for (const word of words) {
    const cleaned = word.replace(/[^A-HJ-NPR-Z0-9]/g, "");
    if (cleaned.length === VIN_LENGTH) {
      candidates.push(cleaned);
    }
  }

  // Strategy 2: Sliding window over the full text (no spaces)
  const noSpaces = text.replace(/\s+/g, "");
  for (let i = 0; i <= noSpaces.length - VIN_LENGTH; i++) {
    const chunk = noSpaces.slice(i, i + VIN_LENGTH);
    const valid = chunk.replace(/[^A-HJ-NPR-Z0-9]/g, "");
    if (valid.length === VIN_LENGTH) {
      candidates.push(valid);
    }
  }

  // Strategy 3: Apply OCR corrections to the raw text and try again
  const corrected = rawText
    .split("")
    .map(correctOcrChar)
    .join("")
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9\s]/g, "");

  const correctedWords = corrected.split(/\s+/);
  for (const word of correctedWords) {
    if (word.length === VIN_LENGTH) {
      candidates.push(word);
    }
  }

  const correctedNoSpaces = corrected.replace(/\s+/g, "");
  for (let i = 0; i <= correctedNoSpaces.length - VIN_LENGTH; i++) {
    const chunk = correctedNoSpaces.slice(i, i + VIN_LENGTH);
    if (/^[A-HJ-NPR-Z0-9]{17}$/.test(chunk)) {
      candidates.push(chunk);
    }
  }

  // Deduplicate
  return [...new Set(candidates)];
}

/**
 * Score a VIN candidate. Higher = more likely correct.
 */
function scoreCandidate(vin: string): number {
  let score = 0;

  // Must be exactly 17 chars of valid VIN characters
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return 0;

  // Check digit validation is the gold standard
  if (validateVinCheckDigit(vin)) score += 100;

  // Position 1: World Manufacturer Identifier — should start with a known country code
  const countryPrefixes = ["1", "2", "3", "4", "5", "J", "K", "L", "S", "W", "V", "Z", "9"];
  if (countryPrefixes.includes(vin[0])) score += 10;

  // Position 10: Model year — should be a valid year code
  const yearCodes = "123456789ABCDEFGHJKLMNPRSTVWXY";
  if (yearCodes.includes(vin[9])) score += 5;

  // Positions 4-8 are typically the vehicle descriptor section (mix of letters/digits)
  // A VIN that's all digits or all letters in this range is suspicious
  const vds = vin.slice(3, 8);
  const hasLetters = /[A-Z]/.test(vds);
  const hasDigits = /[0-9]/.test(vds);
  if (hasLetters && hasDigits) score += 5;

  return score;
}

export interface VinOcrResult {
  vin: string | null;
  confidence: number; // 0-1
  allCandidates: string[];
  rawText: string;
}

/**
 * Run Tesseract.js OCR on an image URL and extract the VIN.
 *
 * @param imageUrl - URL of the door jamb sticker / VIN plate photo
 * @returns The best VIN candidate found, or null
 */
export async function detectVinFromImage(imageUrl: string): Promise<VinOcrResult> {
  console.log("[VIN-OCR] Starting Tesseract.js OCR...");

  try {
    // Run Tesseract with English language model
    // PSM 6 = assume uniform block of text (good for stickers/labels)
    const result = await Tesseract.recognize(imageUrl, "eng", {
      logger: (info) => {
        if (info.status === "recognizing text") {
          console.log(`[VIN-OCR] Progress: ${Math.round((info.progress || 0) * 100)}%`);
        }
      },
    });

    const rawText = result.data.text;
    console.log("[VIN-OCR] Raw OCR text:", rawText);

    // Extract candidates
    const candidates = extractVinCandidates(rawText);
    console.log("[VIN-OCR] Candidates:", candidates);

    if (candidates.length === 0) {
      return { vin: null, confidence: 0, allCandidates: [], rawText };
    }

    // Score and sort candidates
    const scored = candidates
      .map((vin) => ({ vin, score: scoreCandidate(vin) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log("[VIN-OCR] Scored candidates:", scored);

    if (scored.length === 0) {
      return { vin: null, confidence: 0, allCandidates: candidates, rawText };
    }

    const best = scored[0];
    // Confidence: check-digit valid = 0.95, otherwise based on score
    const confidence = best.score >= 100 ? 0.95 : best.score >= 15 ? 0.6 : 0.3;

    console.log(`[VIN-OCR] Best: ${best.vin} (score: ${best.score}, confidence: ${confidence})`);

    return {
      vin: best.vin,
      confidence,
      allCandidates: scored.map((s) => s.vin),
      rawText,
    };
  } catch (error) {
    console.error("[VIN-OCR] Tesseract error:", error);
    return { vin: null, confidence: 0, allCandidates: [], rawText: "" };
  }
}
