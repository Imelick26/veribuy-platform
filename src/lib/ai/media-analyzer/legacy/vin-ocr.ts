/**
 * VIN extraction from photo — production-grade pipeline.
 *
 * Runs Google Cloud Vision AND GPT-4o in parallel, then picks the
 * best candidate using layered validation:
 *   1. Check digit (mathematical — definitive)
 *   2. NHTSA decode (does this VIN map to a real vehicle?)
 *   3. WMI prefix (positions 1-3 match a known manufacturer?)
 *   4. Structural rules (position 10 = valid year code, 12-17 = digits)
 *   5. Confusion-pair auto-correction as last resort
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

function computeCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    if (i === 8) continue;
    const value = VIN_TRANSLITERATION[vin[i]];
    if (value === undefined) return "?";
    sum += value * VIN_WEIGHTS[i];
  }
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}

function isValidCheckDigit(vin: string): boolean {
  if (vin.length !== 17) return false;
  const expected = computeCheckDigit(vin);
  return expected !== "?" && vin[8] === expected;
}

// ---------------------------------------------------------------------------
//  Structural validation (beyond check digit)
// ---------------------------------------------------------------------------

/** Valid model year codes (position 10). Covers 1980-2039. */
const VALID_YEAR_CODES = new Set(
  "ABCDEFGHJKLMNPRSTVWXY123456789".split(""),
);

/** Common WMI prefixes (positions 1-3). Not exhaustive but covers major US-market makes. */
const KNOWN_WMI_PREFIXES = new Set([
  // Ford
  "1FA", "1FB", "1FC", "1FD", "1FM", "1FT", "1FV", "1ZV", "3FA", "3FM",
  // GM (Chevrolet, GMC, Buick, Cadillac)
  "1G1", "1G2", "1GC", "1GD", "1GK", "1GT", "1GY", "2G1", "3G1", "3GN",
  // Chrysler / Ram / Dodge / Jeep
  "1C3", "1C4", "1C6", "1D7", "2C3", "2C4", "3C4", "3C6", "3D7",
  // Toyota
  "1TM", "2T1", "2T2", "2T3", "4T1", "4T3", "4T4", "5TD", "5TF", "JTE", "JTD", "JTN",
  // Honda
  "1HG", "2HG", "2HK", "5FN", "5J6", "JHM",
  // Nissan
  "1N4", "1N6", "3N1", "5N1", "JN1", "JN8",
  // BMW
  "WBA", "WBS", "WBY", "5UX", "5YM",
  // Mercedes
  "WDB", "WDC", "WDD", "4JG", "55S",
  // VW / Audi
  "WVW", "WVG", "WAU", "WA1",
  // Subaru
  "4S3", "4S4", "JF1", "JF2",
  // Hyundai / Kia
  "5NP", "5NM", "5XY", "KNA", "KND",
  // Tesla
  "5YJ", "7SA",
]);

/** Validates VIN structure beyond check digit */
function validateStructure(vin: string): { valid: boolean; score: number } {
  if (vin.length !== 17) return { valid: false, score: 0 };

  let score = 0;

  // Check all characters are valid VIN chars
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) score += 10;
  else return { valid: false, score: 0 };

  // Position 10: valid year code
  if (VALID_YEAR_CODES.has(vin[9])) score += 10;

  // Positions 12-17: should be digits (sequential production number)
  if (/^\d{6}$/.test(vin.slice(11))) score += 15;
  else if (/^\d{5}[A-Z]/.test(vin.slice(11))) score += 5; // Some exceptions

  // WMI prefix (positions 1-3)
  if (KNOWN_WMI_PREFIXES.has(vin.slice(0, 3))) score += 20;

  // Check digit passes
  if (isValidCheckDigit(vin)) score += 50;

  return { valid: score >= 10, score };
}

// ---------------------------------------------------------------------------
//  Confusion-pair auto-correction
// ---------------------------------------------------------------------------

const CONFUSION_PAIRS: Record<string, string[]> = {
  W: ["H", "M"], H: ["W", "N"], B: ["8", "3"], "8": ["B", "3"],
  D: ["0"], "0": ["D"], S: ["5"], "5": ["S"], G: ["6"], "6": ["G"],
  Z: ["2"], "2": ["Z"], "1": ["7"], "7": ["1"], N: ["H", "M"],
  M: ["W", "N"], V: ["U", "Y"], U: ["V"], C: ["G"],
  E: ["F"], F: ["E", "P"], P: ["R", "F"], R: ["P"],
};

function tryConfusionCorrections(vin: string): string | null {
  // Single character correction
  for (let pos = 0; pos < 17; pos++) {
    if (pos === 8) continue;
    const alternatives = CONFUSION_PAIRS[vin[pos]];
    if (!alternatives) continue;
    for (const alt of alternatives) {
      const candidate = vin.slice(0, pos) + alt + vin.slice(pos + 1);
      if (isValidCheckDigit(candidate)) {
        console.log(`[VIN-OCR] Correction: pos ${pos} ${vin[pos]}→${alt} (${vin} → ${candidate})`);
        return candidate;
      }
    }
  }

  // Double character correction
  for (let p1 = 0; p1 < 17; p1++) {
    if (p1 === 8) continue;
    const alts1 = CONFUSION_PAIRS[vin[p1]];
    if (!alts1) continue;
    for (const a1 of alts1) {
      const partial = vin.slice(0, p1) + a1 + vin.slice(p1 + 1);
      for (let p2 = p1 + 1; p2 < 17; p2++) {
        if (p2 === 8) continue;
        const alts2 = CONFUSION_PAIRS[partial[p2]];
        if (!alts2) continue;
        for (const a2 of alts2) {
          const candidate = partial.slice(0, p2) + a2 + partial.slice(p2 + 1);
          if (isValidCheckDigit(candidate)) {
            console.log(`[VIN-OCR] Double correction: pos${p1} ${vin[p1]}→${a1}, pos${p2} ${partial[p2]}→${a2}`);
            return candidate;
          }
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
//  NHTSA decode validation
// ---------------------------------------------------------------------------

async function nhtsaValidate(vin: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return false;
    const data = await response.json() as {
      Results?: Array<{ Make?: string; ModelYear?: string; ErrorCode?: string }>;
    };
    const result = data.Results?.[0];
    if (!result) return false;
    // ErrorCode "0" = decoded successfully with no errors
    // ErrorCode containing "0" somewhere = at least partially valid
    const hasVehicle = !!(result.Make && result.ModelYear && result.ModelYear !== "0");
    return hasVehicle;
  } catch {
    return false; // Network failure — don't block on this
  }
}

// ---------------------------------------------------------------------------
//  Google Cloud Vision OCR
// ---------------------------------------------------------------------------

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY;

async function googleVisionOCR(photoUrl: string): Promise<string[]> {
  if (!GOOGLE_VISION_API_KEY) return [];

  try {
    const imageResponse = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
    if (!imageResponse.ok) return [];
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Use DOCUMENT_TEXT_DETECTION — better for structured labels like door jamb stickers
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [
                { type: "DOCUMENT_TEXT_DETECTION" },
                { type: "TEXT_DETECTION", maxResults: 50 },
              ],
              imageContext: {
                languageHints: ["en"],
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      console.warn(`[VIN-OCR:Google] API error ${response.status}`);
      return [];
    }

    const data = await response.json() as {
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        textAnnotations?: Array<{ description?: string }>;
      }>;
    };

    const result = data.responses?.[0];
    const candidates: string[] = [];

    // Strategy 1: Extract from full document text (best for structured stickers)
    const fullText = result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";
    extractVinCandidates(fullText, candidates);

    // Strategy 2: Look for text near "VIN" label
    extractVinNearLabel(fullText, candidates);

    // Strategy 3: Check individual text annotations
    const annotations = result?.textAnnotations || [];
    for (const annotation of annotations.slice(1)) {
      const text = (annotation.description || "").replace(/\s/g, "").toUpperCase();
      if (text.length >= 17 && text.length <= 20) {
        const cleaned = text.replace(/[^A-HJ-NPR-Z0-9]/g, "");
        if (cleaned.length === 17 && !candidates.includes(cleaned)) {
          candidates.push(cleaned);
        }
      }
    }

    // Strategy 4: Join adjacent short annotations that could be a split VIN
    const shortTexts = annotations.slice(1).map((a) => (a.description || "").replace(/\s/g, "").toUpperCase());
    for (let i = 0; i < shortTexts.length - 1; i++) {
      const joined = (shortTexts[i] + shortTexts[i + 1]).replace(/[^A-HJ-NPR-Z0-9]/g, "");
      if (joined.length === 17 && !candidates.includes(joined)) {
        candidates.push(joined);
      }
      // Try joining 3 adjacent
      if (i < shortTexts.length - 2) {
        const joined3 = (shortTexts[i] + shortTexts[i + 1] + shortTexts[i + 2]).replace(/[^A-HJ-NPR-Z0-9]/g, "");
        if (joined3.length === 17 && !candidates.includes(joined3)) {
          candidates.push(joined3);
        }
      }
    }

    console.log(`[VIN-OCR:Google] ${candidates.length} candidate(s) from ${annotations.length} text blocks`);
    return candidates;
  } catch (err) {
    console.warn(`[VIN-OCR:Google] Failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

/** Extract 17-char VIN candidates from a text blob */
function extractVinCandidates(text: string, out: string[]): void {
  // Remove common separators but preserve enough to find VINs
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9\n\s]/g, " ");

  // Try with all whitespace stripped (handles "1FTH W26F 7TEA 10490" formatting)
  const noSpace = cleaned.replace(/[\s\n\r]/g, "");
  const pattern = /[A-HJ-NPR-Z0-9]{17}/g;
  let match;
  while ((match = pattern.exec(noSpace)) !== null) {
    const candidate = match[0];
    if (!/[IOQ]/.test(candidate) && !out.includes(candidate)) {
      out.push(candidate);
    }
  }

  // Also try line-by-line (VIN often on its own line)
  for (const line of cleaned.split("\n")) {
    const lineClean = line.replace(/\s/g, "");
    if (lineClean.length >= 17 && lineClean.length <= 20) {
      const vinChars = lineClean.replace(/[^A-HJ-NPR-Z0-9]/g, "");
      if (vinChars.length === 17 && !out.includes(vinChars)) {
        out.push(vinChars);
      }
    }
  }
}

/** Look for VIN near a "VIN" label in the text */
function extractVinNearLabel(text: string, out: string[]): void {
  const upper = text.toUpperCase();
  const vinLabelPatterns = [
    /VIN[:\s#.\-]*([A-HJ-NPR-Z0-9\s]{17,25})/g,
    /VEHICLE\s*IDENTIFICATION\s*(?:NUMBER|NO\.?)[:\s#.\-]*([A-HJ-NPR-Z0-9\s]{17,25})/g,
    /V\.?I\.?N\.?\s*[:\s#.\-]*([A-HJ-NPR-Z0-9\s]{17,25})/g,
  ];

  for (const pattern of vinLabelPatterns) {
    let match;
    while ((match = pattern.exec(upper)) !== null) {
      const raw = match[1].replace(/[\s\-]/g, "");
      if (raw.length >= 17) {
        const candidate = raw.slice(0, 17);
        if (/^[A-HJ-NPR-Z0-9]{17}$/.test(candidate) && !out.includes(candidate)) {
          out.push(candidate);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
//  GPT-4o Vision read
// ---------------------------------------------------------------------------

async function readVinFromPhoto(
  openai: ReturnType<typeof import("@/lib/openai").getOpenAI>,
  photoUrl: string,
  previousAttempt?: string,
): Promise<{ vin: string | null; confidence: number }> {
  const retryContext = previousAttempt
    ? `\n\nPREVIOUS ATTEMPT: "${previousAttempt}" — FAILED check digit validation. One or more characters are wrong. Common confusions on stamped metal:
- W↔H (V-shaped dip vs horizontal bar)
- B↔8 (flat left vs fully rounded)
- D↔0 (flat left vs oval)
- S↔5 (curved vs angular top)
- N↔H (diagonal vs horizontal bar)
Re-examine EVERY character. Look at the exact stroke shapes.`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a VIN reading specialist. Extract the 17-character VIN from the photo.

VIN rules:
- 17 characters: A-H, J-N, P, R-Z, 0-9 (NEVER I, O, or Q)
- Position 9 is a check digit (0-9 or X)
- Position 10 is model year (T=1996, V=1997, W=1998, X=1999, Y=2000, 1=2001...)
- Positions 12-17 are always digits

CRITICAL — read each character individually. On stamped/embossed plates:
- W has a V-shaped center dip. H has a flat horizontal bar.
- B has a flat left side. 8 is fully rounded on both sides.
- D has a flat left side. 0 is fully oval.
- N has a diagonal middle stroke. H has a horizontal middle stroke.
- S is curved everywhere. 5 has a flat top bar.${retryContext}

Return JSON: { "vin": "<17 chars or null>", "confidence": <0.0-1.0> }`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: previousAttempt
              ? `Previous read "${previousAttempt}" failed check digit. Re-read carefully.`
              : "Read the VIN from this photo.",
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
  if (vin && vin.length !== 17) return { vin: null, confidence: 0 };

  return { vin, confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0 };
}

// ---------------------------------------------------------------------------
//  Candidate scoring and selection
// ---------------------------------------------------------------------------

interface ScoredCandidate {
  vin: string;
  source: "google" | "gpt4o" | "corrected";
  checkDigitValid: boolean;
  structureScore: number;
  nhtsaValid?: boolean;
  confidence: number;
}

async function scoreAndSelectBest(candidates: ScoredCandidate[]): Promise<{ vin: string; confidence: number } | null> {
  if (candidates.length === 0) return null;

  // Sort: check digit valid first, then structure score, then confidence
  candidates.sort((a, b) => {
    if (a.checkDigitValid !== b.checkDigitValid) return a.checkDigitValid ? -1 : 1;
    if (a.structureScore !== b.structureScore) return b.structureScore - a.structureScore;
    return b.confidence - a.confidence;
  });

  const best = candidates[0];

  // If best passes check digit, validate with NHTSA for extra certainty
  if (best.checkDigitValid && best.nhtsaValid === undefined) {
    best.nhtsaValid = await nhtsaValidate(best.vin);
    if (best.nhtsaValid) {
      console.log(`[VIN-OCR] NHTSA validated: ${best.vin}`);
      return { vin: best.vin, confidence: 0.99 };
    }
  }

  if (best.checkDigitValid) {
    return { vin: best.vin, confidence: Math.max(best.confidence, 0.95) };
  }

  // No check digit valid — try NHTSA on top candidates as tiebreaker
  for (const c of candidates.slice(0, 3)) {
    if (c.nhtsaValid === undefined) {
      c.nhtsaValid = await nhtsaValidate(c.vin);
      if (c.nhtsaValid) {
        console.log(`[VIN-OCR] NHTSA validated (no check digit): ${c.vin}`);
        return { vin: c.vin, confidence: 0.8 };
      }
    }
  }

  // Nothing validated — return best guess with low confidence
  return { vin: best.vin, confidence: Math.min(best.confidence, 0.5) };
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

/**
 * Extracts VIN from a vehicle photo. Runs Google Vision and GPT-4o in
 * parallel, then selects the best candidate using layered validation.
 */
export async function extractVinFromPhoto(
  photoUrl: string,
): Promise<{ vin: string | null; confidence: number }> {
  try {
    const openai = getOpenAI();

    // ── Run Google Vision + GPT-4o in parallel ──
    const [googleCandidates, gptResult] = await Promise.all([
      googleVisionOCR(photoUrl),
      readVinFromPhoto(openai, photoUrl),
    ]);

    console.log(`[VIN-OCR] Google: ${googleCandidates.length} candidates, GPT-4o: ${gptResult.vin || "null"}`);

    // ── Score all candidates ──
    const scored: ScoredCandidate[] = [];

    for (const vin of googleCandidates) {
      const structure = validateStructure(vin);
      if (structure.valid) {
        scored.push({
          vin,
          source: "google",
          checkDigitValid: isValidCheckDigit(vin),
          structureScore: structure.score,
          confidence: isValidCheckDigit(vin) ? 0.98 : 0.7,
        });
      }
    }

    if (gptResult.vin) {
      const structure = validateStructure(gptResult.vin);
      scored.push({
        vin: gptResult.vin,
        source: "gpt4o",
        checkDigitValid: isValidCheckDigit(gptResult.vin),
        structureScore: structure.score,
        confidence: gptResult.confidence,
      });
    }

    // ── Try confusion corrections on all failing candidates ──
    const failedCandidates = scored.filter((c) => !c.checkDigitValid);
    for (const fc of failedCandidates) {
      const corrected = tryConfusionCorrections(fc.vin);
      if (corrected) {
        const structure = validateStructure(corrected);
        scored.push({
          vin: corrected,
          source: "corrected",
          checkDigitValid: true,
          structureScore: structure.score,
          confidence: fc.confidence * 0.9,
        });
      }
    }

    // ── Pick the best ──
    const best = await scoreAndSelectBest(scored);
    if (best) return best;

    // ── Nothing worked — GPT-4o second attempt with context ──
    const allReads = [...googleCandidates, gptResult.vin].filter(Boolean) as string[];
    if (allReads.length > 0) {
      console.log(`[VIN-OCR] All candidates failed validation. Trying GPT-4o with error context.`);
      const secondRead = await readVinFromPhoto(openai, photoUrl, allReads[0]);
      if (secondRead.vin) {
        if (isValidCheckDigit(secondRead.vin)) {
          const valid = await nhtsaValidate(secondRead.vin);
          return { vin: secondRead.vin, confidence: valid ? 0.95 : 0.9 };
        }
        const corrected = tryConfusionCorrections(secondRead.vin);
        if (corrected) {
          return { vin: corrected, confidence: 0.85 };
        }
        return { vin: secondRead.vin, confidence: 0.5 };
      }
    }

    console.warn("[VIN-OCR] All extraction methods failed");
    return { vin: null, confidence: 0 };
  } catch (err) {
    console.error("[VIN-OCR] Fatal error:", err);
    return { vin: null, confidence: 0 };
  }
}
