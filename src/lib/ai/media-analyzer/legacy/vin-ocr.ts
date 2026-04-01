/**
 * VIN extraction from photo.
 *
 * Pipeline:
 * 1. Google Cloud Vision API (best raw OCR accuracy) — if API key configured
 * 2. GPT-4o Vision (fallback, or primary if no Google key)
 * 3. Check digit validation on any read
 * 4. Common confusion-pair auto-correction (W/H, B/8, D/0, S/5)
 * 5. If check digit still fails, GPT-4o second attempt with error context
 */

import { getOpenAI } from "@/lib/openai";

// ---------------------------------------------------------------------------
//  Check digit validation (FMVSS 115, 49 CFR 565)
// ---------------------------------------------------------------------------

const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
  "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Computes the VIN check digit (position 9). Returns "X" or "0"-"9".
 */
function computeCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    if (i === 8) continue; // Skip check digit position
    const value = VIN_TRANSLITERATION[vin[i]];
    if (value === undefined) return "?"; // Invalid character
    sum += value * VIN_WEIGHTS[i];
  }
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}

/**
 * Validates VIN check digit (position 9).
 */
function isValidCheckDigit(vin: string): boolean {
  if (vin.length !== 17) return false;
  const expected = computeCheckDigit(vin);
  return expected !== "?" && vin[8] === expected;
}

// ---------------------------------------------------------------------------
//  Common OCR confusion pairs for stamped/embossed VIN plates
// ---------------------------------------------------------------------------

const CONFUSION_PAIRS: Record<string, string[]> = {
  W: ["H", "M"],     // W↔H most common on stamped plates
  H: ["W", "N"],
  B: ["8", "3"],
  "8": ["B", "3"],
  D: ["0"],
  "0": ["D"],
  S: ["5"],
  "5": ["S"],
  G: ["6"],
  "6": ["G"],
  Z: ["2"],
  "2": ["Z"],
  "1": ["7"],
  "7": ["1"],
  N: ["H", "M"],
  M: ["W", "N"],
  V: ["U", "Y"],
  U: ["V"],
  C: ["G"],
  E: ["F"],
  F: ["E", "P"],
  P: ["R", "F"],
  R: ["P"],
};

/**
 * Tries common character substitutions to find a VIN that passes check digit.
 * Returns the corrected VIN or null if no substitution works.
 */
function tryConfusionCorrections(vin: string): string | null {
  // Skip position 8 (check digit itself) and positions that are digits 0-9
  // (less likely to be misread than letters on stamped plates)
  for (let pos = 0; pos < 17; pos++) {
    if (pos === 8) continue;
    const char = vin[pos];
    const alternatives = CONFUSION_PAIRS[char];
    if (!alternatives) continue;

    for (const alt of alternatives) {
      // Make sure the alternative is valid for VIN
      if (!"ABCDEFGHJKLMNPRSTUVWXYZ0123456789".includes(alt)) continue;
      const candidate = vin.slice(0, pos) + alt + vin.slice(pos + 1);
      if (isValidCheckDigit(candidate)) {
        console.log(`[VIN-OCR] Check digit correction: position ${pos} ${char}→${alt} (${vin} → ${candidate})`);
        return candidate;
      }
    }
  }

  // Try two-character corrections (less common but handles W→H + another error)
  for (let pos1 = 0; pos1 < 17; pos1++) {
    if (pos1 === 8) continue;
    const char1 = vin[pos1];
    const alts1 = CONFUSION_PAIRS[char1];
    if (!alts1) continue;

    for (const alt1 of alts1) {
      const partial = vin.slice(0, pos1) + alt1 + vin.slice(pos1 + 1);
      for (let pos2 = pos1 + 1; pos2 < 17; pos2++) {
        if (pos2 === 8) continue;
        const char2 = partial[pos2];
        const alts2 = CONFUSION_PAIRS[char2];
        if (!alts2) continue;

        for (const alt2 of alts2) {
          const candidate = partial.slice(0, pos2) + alt2 + partial.slice(pos2 + 1);
          if (isValidCheckDigit(candidate)) {
            console.log(`[VIN-OCR] Double correction: pos${pos1} ${char1}→${alt1}, pos${pos2} ${char2}→${alt2} (${vin} → ${candidate})`);
            return candidate;
          }
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
//  Google Cloud Vision OCR
// ---------------------------------------------------------------------------

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY;

/**
 * Uses Google Cloud Vision API for high-accuracy text detection.
 * Returns all VIN-like 17-character strings found in the image.
 */
async function googleVisionOCR(photoUrl: string): Promise<string[]> {
  if (!GOOGLE_VISION_API_KEY) return [];

  try {
    // Download image and convert to base64
    const imageResponse = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
    if (!imageResponse.ok) return [];
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Call Google Cloud Vision TEXT_DETECTION
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: "TEXT_DETECTION", maxResults: 10 }],
            },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      console.warn(`[VIN-OCR:Google] API returned ${response.status}`);
      return [];
    }

    const data = await response.json() as {
      responses?: Array<{
        textAnnotations?: Array<{ description?: string }>;
      }>;
    };

    const fullText = data.responses?.[0]?.textAnnotations?.[0]?.description || "";

    // Extract all potential VIN strings (17 alphanumeric chars)
    const vinPattern = /[A-HJ-NPR-Z0-9]{17}/gi;
    const candidates: string[] = [];
    let match;
    while ((match = vinPattern.exec(fullText.replace(/[\s\n\r]/g, ""))) !== null) {
      const candidate = match[0].toUpperCase();
      // Filter out strings with I, O, Q (invalid in VIN)
      if (!/[IOQ]/.test(candidate)) {
        candidates.push(candidate);
      }
    }

    // Also try extracting from individual text annotations (sometimes more accurate)
    const annotations = data.responses?.[0]?.textAnnotations || [];
    for (const annotation of annotations.slice(1)) {
      const text = (annotation.description || "").replace(/\s/g, "").toUpperCase();
      if (text.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(text)) {
        if (!candidates.includes(text)) candidates.push(text);
      }
    }

    console.log(`[VIN-OCR:Google] Found ${candidates.length} VIN candidate(s)`);
    return candidates;
  } catch (err) {
    console.warn(`[VIN-OCR:Google] Failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

/**
 * Extracts VIN from a door jamb / VIN plate photo.
 *
 * Pipeline:
 * 1. Google Cloud Vision (if API key configured) — best raw OCR
 * 2. Check digit validation on Google candidates
 * 3. If no valid candidate from Google, fall back to GPT-4o Vision
 * 4. Check digit validation + confusion-pair auto-correction
 * 5. If still failing, GPT-4o second attempt with error context
 */
export async function extractVinFromPhoto(
  photoUrl: string,
): Promise<{ vin: string | null; confidence: number }> {
  const openai = getOpenAI();

  try {
    // ── Google Cloud Vision (primary, if configured) ──
    const googleCandidates = await googleVisionOCR(photoUrl);

    // Check each candidate against check digit
    for (const candidate of googleCandidates) {
      if (isValidCheckDigit(candidate)) {
        console.log(`[VIN-OCR] Google Vision check digit PASSED: ${candidate}`);
        return { vin: candidate, confidence: 0.98 };
      }
    }

    // Try confusion corrections on Google candidates
    for (const candidate of googleCandidates) {
      const corrected = tryConfusionCorrections(candidate);
      if (corrected) {
        console.log(`[VIN-OCR] Google Vision + correction: ${candidate} → ${corrected}`);
        return { vin: corrected, confidence: 0.93 };
      }
    }

    if (googleCandidates.length > 0) {
      console.log(`[VIN-OCR] Google Vision found candidates but none passed check digit`);
    }

    // ── GPT-4o Vision (fallback or primary if no Google key) ──
    const firstRead = await readVinFromPhoto(openai, photoUrl);
    if (!firstRead.vin) {
      // If Google had a candidate, return it with low confidence
      if (googleCandidates.length > 0) {
        return { vin: googleCandidates[0], confidence: 0.5 };
      }
      return firstRead;
    }

    // Check digit validation
    if (isValidCheckDigit(firstRead.vin)) {
      console.log(`[VIN-OCR] GPT-4o check digit PASSED: ${firstRead.vin}`);
      return { vin: firstRead.vin, confidence: Math.max(firstRead.confidence, 0.95) };
    }

    console.log(`[VIN-OCR] GPT-4o check digit FAILED: ${firstRead.vin} (expected ${computeCheckDigit(firstRead.vin)} at pos 9, got ${firstRead.vin[8]})`);

    // ── Try common confusion corrections ──
    const corrected = tryConfusionCorrections(firstRead.vin);
    if (corrected) {
      console.log(`[VIN-OCR] Auto-corrected: ${firstRead.vin} → ${corrected}`);
      return { vin: corrected, confidence: Math.max(firstRead.confidence * 0.9, 0.85) };
    }

    // ── GPT-4o second attempt with error context ──
    console.log(`[VIN-OCR] Requesting GPT-4o second read with error context`);
    const secondRead = await readVinFromPhoto(openai, photoUrl, firstRead.vin);
    if (!secondRead.vin) return firstRead;

    if (isValidCheckDigit(secondRead.vin)) {
      console.log(`[VIN-OCR] GPT-4o second read check digit PASSED: ${secondRead.vin}`);
      return { vin: secondRead.vin, confidence: Math.max(secondRead.confidence, 0.9) };
    }

    const corrected2 = tryConfusionCorrections(secondRead.vin);
    if (corrected2) {
      console.log(`[VIN-OCR] Auto-corrected second read: ${secondRead.vin} → ${corrected2}`);
      return { vin: corrected2, confidence: 0.8 };
    }

    // All attempts failed check digit — return best guess
    console.warn(`[VIN-OCR] All attempts failed check digit. Returning best guess with low confidence.`);
    // Prefer Google's read over GPT-4o if available
    const bestGuess = googleCandidates[0] || firstRead.vin;
    return { vin: bestGuess, confidence: Math.min(firstRead.confidence, 0.5) };
  } catch (err) {
    console.error("[VIN-OCR] Failed:", err);
    return { vin: null, confidence: 0 };
  }
}

// ---------------------------------------------------------------------------
//  GPT-4o Vision call
// ---------------------------------------------------------------------------

async function readVinFromPhoto(
  openai: ReturnType<typeof import("@/lib/openai").getOpenAI>,
  photoUrl: string,
  previousAttempt?: string,
): Promise<{ vin: string | null; confidence: number }> {
  const retryContext = previousAttempt
    ? `\n\nPREVIOUS ATTEMPT: "${previousAttempt}" — this FAILED check digit validation. The check digit (position 9) did not match. One or more characters are likely misread. Common confusions on stamped metal VIN plates:
- W and H look very similar (both have vertical strokes with angled connections)
- B and 8 (rounded shapes)
- D and 0 (oval shapes)
- S and 5 (curved vs angular)
- N and H (similar vertical strokes)
- 1 and 7 (thin strokes)
Please re-examine the photo VERY carefully, especially characters that could be W/H, B/8, D/0, or S/5. Look at the exact shape of each stroke.`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a vehicle identification expert specializing in reading VINs from door jamb stickers and stamped metal plates. Extract the 17-character VIN from the provided photo.

The VIN may appear on:
- A door jamb sticker/label
- An embossed/stamped metal tag
- A hood label or emissions sticker
- A dashboard plate (viewed through windshield)

VIN format rules:
- Exactly 17 characters
- ONLY uses: A-H, J-N, P, R-Z, 0-9 (NEVER uses I, O, or Q)
- Position 1: country (1=USA, 2=Canada, 3=Mexico, J=Japan, W=Germany, S=UK)
- Position 9: CHECK DIGIT (0-9 or X) — this is mathematically computed from all other characters
- Position 10: model year code (T=1996, V=1997, W=1998, X=1999, Y=2000, 1=2001, ..., A=2010, B=2011, ...)
- Positions 12-17: sequential production number (always digits)

COMMON MISREADS on stamped/embossed plates:
- W vs H: Look carefully at the center — W has a V-shaped dip, H has a horizontal bar
- B vs 8: B has flat left side, 8 is fully rounded
- D vs 0: D has flat left side, 0 is fully rounded
- S vs 5: S is curved, 5 has a horizontal top bar
- N vs H: N has a diagonal stroke, H has a horizontal bar
- 1 vs 7: 7 has a horizontal top bar

Read EVERY character individually. Be especially careful with positions where these confusions occur.${retryContext}

Return JSON: { "vin": "<17 char VIN or null if truly unreadable>", "confidence": <0.0 to 1.0> }`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: previousAttempt
              ? `Re-examine this VIN photo. Your previous read "${previousAttempt}" has an incorrect check digit. Look very carefully at each character, especially any that could be W/H, B/8, D/0, or S/5 confusions.`
              : "Extract the VIN from this vehicle identification label photo.",
          },
          { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return { vin: null, confidence: 0 };

  const parsed = JSON.parse(raw);
  const vin =
    typeof parsed.vin === "string" && parsed.vin.length === 17
      ? parsed.vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "")
      : null;
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;

  if (vin && vin.length !== 17) return { vin: null, confidence: 0 };

  return { vin, confidence };
}
