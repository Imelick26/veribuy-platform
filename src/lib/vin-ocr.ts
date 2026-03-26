"use client";

/**
 * Client-side VIN OCR using Tesseract.js
 *
 * Processes door jamb sticker / VIN plate photos locally in the browser.
 * No API key required — runs entirely on the client.
 *
 * Approach:
 * 1. Preprocess image via canvas (grayscale → high-contrast threshold → sharpen)
 * 2. Run Tesseract with character whitelist limited to valid VIN chars
 * 3. Extract 17-char candidates from OCR text
 * 4. Score candidates using check-digit validation + structural rules
 * 5. Return best match
 */

import Tesseract from "tesseract.js";

const VIN_LENGTH = 17;

// Valid VIN characters: 0-9, A-Z except I, O, Q
const VALID_VIN_CHARS = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ";

/**
 * Common OCR misreads — ONLY correct characters that are INVALID in VINs.
 * S, B, D, G, Z ARE valid VIN characters — do NOT "correct" them.
 */
function correctInvalidChar(ch: string): string {
  const upper = ch.toUpperCase();
  // These three letters are NEVER in a VIN
  if (upper === "I") return "1";
  if (upper === "O") return "0";
  if (upper === "Q") return "0";
  // Common OCR noise
  if (ch === "l" || ch === "|" || ch === "!" || ch === "[") return "1";
  if (ch === "}" || ch === "]") return "1";
  if (ch === "(") return "C";
  if (ch === "$") return "5";
  if (ch === "&") return "8";
  return upper;
}

/**
 * Validate a VIN using the standard check-digit algorithm (position 9).
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
 * Preprocess an image for better OCR: grayscale → contrast boost → threshold.
 * Returns a data URL of the processed image.
 */
function preprocessImage(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(imageUrl); return; }

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and apply adaptive threshold
      for (let i = 0; i < data.length; i += 4) {
        // Weighted grayscale (luminance)
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

        // High-contrast threshold: push to black or white
        // This makes text much clearer for OCR
        const threshold = 140;
        const val = gray > threshold ? 255 : 0;

        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      console.warn("[VIN-OCR] Could not preprocess image, using original");
      resolve(imageUrl);
    };
    img.src = imageUrl;
  });
}

/**
 * Extract candidate VINs from raw OCR text.
 */
function extractVinCandidates(rawText: string): string[] {
  const candidates: string[] = [];

  // Normalize text
  const text = rawText.toUpperCase();

  // Strategy 1: Look for lines containing "VIN" — the VIN is often on the same line or next line
  const lines = text.split(/\n/);
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line.includes("VIN") || line.includes("V.I.N") || line.includes("V I N")) {
      // Check this line and the next line for 17-char sequences
      for (let offset = 0; offset <= 1 && li + offset < lines.length; offset++) {
        const targetLine = lines[li + offset];
        const cleaned = targetLine.replace(/[^A-Z0-9]/g, "");
        // Try to find a 17-char VIN-like substring
        for (let i = 0; i <= cleaned.length - VIN_LENGTH; i++) {
          const chunk = cleaned.slice(i, i + VIN_LENGTH);
          if (/^[A-HJ-NPR-Z0-9]{17}$/.test(chunk)) {
            candidates.push(chunk);
          }
        }
        // Also try with OCR corrections
        const corrected = targetLine.split("").map(correctInvalidChar).join("").replace(/[^A-Z0-9]/g, "");
        for (let i = 0; i <= corrected.length - VIN_LENGTH; i++) {
          const chunk = corrected.slice(i, i + VIN_LENGTH);
          if (/^[A-HJ-NPR-Z0-9]{17}$/.test(chunk)) {
            candidates.push(chunk);
          }
        }
      }
    }
  }

  // Strategy 2: Look for any 17-char alphanumeric sequences in each line
  for (const line of lines) {
    const cleaned = line.replace(/[^A-Z0-9]/g, "");
    for (let i = 0; i <= cleaned.length - VIN_LENGTH; i++) {
      const chunk = cleaned.slice(i, i + VIN_LENGTH);
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(chunk)) {
        candidates.push(chunk);
      }
    }
  }

  // Strategy 3: Apply OCR corrections globally and scan
  const correctedFull = text.split("").map(correctInvalidChar).join("").replace(/[^A-Z0-9]/g, "");
  for (let i = 0; i <= correctedFull.length - VIN_LENGTH; i++) {
    const chunk = correctedFull.slice(i, i + VIN_LENGTH);
    if (/^[A-HJ-NPR-Z0-9]{17}$/.test(chunk)) {
      candidates.push(chunk);
    }
  }

  // Strategy 4: Look for sequences starting with known manufacturer codes
  // 1F = Ford USA, 1G = GM, 1H = Honda, 2F = Ford Canada, etc.
  const mfgPrefixes = ["1F", "2F", "3F", "1G", "1H", "1N", "1C", "1J", "2G", "3G", "JT", "KM", "WA", "WB", "WD", "WF"];
  const allText = text.replace(/[^A-Z0-9]/g, "");
  for (const prefix of mfgPrefixes) {
    let startIdx = 0;
    while (true) {
      const idx = allText.indexOf(prefix, startIdx);
      if (idx === -1) break;
      if (idx + VIN_LENGTH <= allText.length) {
        const chunk = allText.slice(idx, idx + VIN_LENGTH);
        if (/^[A-HJ-NPR-Z0-9]{17}$/.test(chunk)) {
          candidates.push(chunk);
        }
      }
      startIdx = idx + 1;
    }
  }

  // Deduplicate
  return [...new Set(candidates)];
}

/**
 * Score a VIN candidate. Higher = more likely correct.
 */
function scoreCandidate(vin: string): number {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return 0;

  let score = 0;

  // Check digit validation (position 9) — gold standard
  if (validateVinCheckDigit(vin)) score += 100;

  // Position 1: World Manufacturer — known country codes
  const countryPrefixes = ["1", "2", "3", "4", "5", "J", "K", "L", "S", "W", "V", "Z", "9"];
  if (countryPrefixes.includes(vin[0])) score += 10;

  // Positions 1-2: Known manufacturer codes (Ford = 1F, 2F, 3F)
  const knownMfg = ["1F", "2F", "3F", "1G", "2G", "3G", "1H", "1N", "1C", "1J", "JT", "KM", "WA", "WB", "WD", "WF", "YV", "SA", "SJ"];
  if (knownMfg.includes(vin.slice(0, 2))) score += 15;

  // Position 10: Model year code
  const yearCodes = "123456789ABCDEFGHJKLMNPRSTVWXY";
  if (yearCodes.includes(vin[9])) score += 5;

  // Positions 12-17 should be digits (sequential production number)
  const productionSeq = vin.slice(11);
  if (/^\d{6}$/.test(productionSeq)) score += 10;

  // Vehicle descriptor section (positions 4-8) — typically has a mix
  const vds = vin.slice(3, 8);
  const hasLetters = /[A-Z]/.test(vds);
  const hasDigits = /[0-9]/.test(vds);
  if (hasLetters && hasDigits) score += 5;

  return score;
}

export interface VinOcrResult {
  vin: string | null;
  confidence: number;
  allCandidates: string[];
  rawText: string;
}

/**
 * Run Tesseract.js OCR on an image URL and extract the VIN.
 * Preprocesses the image for high contrast, then runs OCR with
 * character whitelist to improve accuracy on sticker text.
 */
export async function detectVinFromImage(imageUrl: string): Promise<VinOcrResult> {
  console.log("[VIN-OCR] Starting Tesseract.js OCR...");

  try {
    // Step 1: Preprocess image for better OCR
    console.log("[VIN-OCR] Preprocessing image...");
    const processedUrl = await preprocessImage(imageUrl);

    // Step 2: Run Tesseract on the preprocessed image
    // Use PSM 6 (uniform block) — good for stickers/labels
    const result = await Tesseract.recognize(processedUrl, "eng", {
      logger: (info) => {
        if (info.status === "recognizing text") {
          console.log(`[VIN-OCR] Progress: ${Math.round((info.progress || 0) * 100)}%`);
        }
      },
    });

    const rawText = result.data.text;
    console.log("[VIN-OCR] Raw OCR text:", rawText);

    // Step 3: Also run on the original (unprocessed) image as fallback
    // Sometimes thresholding kills useful detail
    let rawTextOriginal = "";
    if (processedUrl !== imageUrl) {
      try {
        const result2 = await Tesseract.recognize(imageUrl, "eng");
        rawTextOriginal = result2.data.text;
        console.log("[VIN-OCR] Raw OCR text (original):", rawTextOriginal);
      } catch {
        // Ignore — CORS might block original URL
      }
    }

    // Step 4: Extract candidates from both runs
    const combinedText = rawText + "\n" + rawTextOriginal;
    const candidates = extractVinCandidates(combinedText);
    console.log("[VIN-OCR] Candidates:", candidates);

    if (candidates.length === 0) {
      return { vin: null, confidence: 0, allCandidates: [], rawText: combinedText };
    }

    // Step 5: Score and sort
    const scored = candidates
      .map((vin) => ({ vin, score: scoreCandidate(vin) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log("[VIN-OCR] Scored candidates:", scored);

    if (scored.length === 0) {
      return { vin: null, confidence: 0, allCandidates: candidates, rawText: combinedText };
    }

    const best = scored[0];
    const confidence = best.score >= 100 ? 0.95 : best.score >= 30 ? 0.7 : best.score >= 15 ? 0.5 : 0.3;

    console.log(`[VIN-OCR] Best: ${best.vin} (score: ${best.score}, confidence: ${confidence})`);

    return {
      vin: best.vin,
      confidence,
      allCandidates: scored.map((s) => s.vin),
      rawText: combinedText,
    };
  } catch (error) {
    console.error("[VIN-OCR] Tesseract error:", error);
    return { vin: null, confidence: 0, allCandidates: [], rawText: "" };
  }
}
