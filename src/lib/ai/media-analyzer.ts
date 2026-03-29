import { getOpenAI } from "@/lib/openai";
import type {
  AggregatedRisk,
  AIAnalysisResult,
  OverallConditionResult,
  QuestionAnswer,
  ConditionAssessment,
  AreaConditionDetail,
} from "@/types/risk";

interface MediaForAnalysis {
  id: string;
  url: string;
  captureType: string;
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function processWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  maxConcurrent: number
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
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Risk-specific analysis (per risk item, parallelized)
// ---------------------------------------------------------------------------

/**
 * Sends captured photos to GPT-4o Vision to analyze each risk item.
 * Processes up to 4 risks concurrently for ~4x speed improvement.
 *
 * Cost: ~$0.10-0.20 per inspection (risk-specific analysis).
 */
export async function analyzeRiskMedia(
  vehicle: { year: number; make: string; model: string },
  risks: AggregatedRisk[],
  media: MediaForAnalysis[],
  questionAnswers?: Record<string, QuestionAnswer[]>
): Promise<AIAnalysisResult[]> {
  if (risks.length === 0 || media.length === 0) return [];

  const openai = getOpenAI();

  return processWithConcurrency(
    risks,
    async (risk) => {
      try {
        return await analyzeOneRisk(openai, vehicle, risk, media, questionAnswers?.[risk.id]);
      } catch (err) {
        console.error(`[media-analyzer] Failed to analyze risk ${risk.id}:`, err);
        return {
          riskId: risk.id,
          verdict: "INCONCLUSIVE" as const,
          confidence: 0,
          explanation: "AI analysis failed for this risk item. Manual inspection recommended.",
          evidenceMediaIds: [],
        };
      }
    },
    4 // max concurrent GPT-4o requests
  );
}

async function analyzeOneRisk(
  openai: ReturnType<typeof getOpenAI>,
  vehicle: { year: number; make: string; model: string },
  risk: AggregatedRisk,
  media: MediaForAnalysis[],
  riskAnswers?: QuestionAnswer[]
): Promise<AIAnalysisResult> {
  const relevantMedia = selectRelevantMedia(risk, media);

  // Max 5 photos per risk to control costs
  const selectedMedia = relevantMedia.slice(0, 5);
  const imageBlocks = selectedMedia.map((m) => ({
    type: "image_url" as const,
    image_url: { url: m.url, detail: "high" as const },
  }));

  if (imageBlocks.length === 0) {
    return {
      riskId: risk.id,
      verdict: "INCONCLUSIVE",
      confidence: 0.1,
      explanation: "No relevant photos available for this risk area. Manual inspection needed.",
      evidenceMediaIds: [],
    };
  }

  // Build signs of failure list from structured data, fallback to symptoms
  const signs = risk.signsOfFailure?.length ? risk.signsOfFailure : risk.symptoms;
  const signsOfFailureList =
    signs.length > 0
      ? signs.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "None specified";

  // Label each photo so the AI knows what angle it's seeing
  const photoDescriptions = selectedMedia
    .map((m, i) => `Photo ${i}: ${m.captureType.replace(/_/g, " ")}`)
    .join("\n");

  const systemPrompt = `You are analyzing inspection photos of a ${vehicle.year} ${vehicle.make} ${vehicle.model} to assess the condition of a KNOWN issue that was identified through NHTSA complaint data, recall records, and platform-specific failure databases.

The issue has already been identified by real data — your job is to ASSESS ITS CURRENT CONDITION on this specific vehicle based on the photos and any hands-on observations the inspector reported.

You are a ${vehicle.make} ${vehicle.model} specialist. You know exactly what healthy vs. failing components look like on this platform because you've seen hundreds of these vehicles.

YOUR DIAGNOSTIC APPROACH:
1. Examine ALL provided photos — multiple angles of the same area give you a complete picture. Close-ups reveal depth/severity, wide shots reveal extent/spread.
2. Look for the specific signs of failure listed below — you know exactly what they look like on this platform.
3. Make a CONFIDENT call. If you can see the component clearly, commit to a definitive assessment. The inspector took specific photos at your direction — use them.
4. If the inspector also performed hands-on checks (questions answered), weight their firsthand observations heavily — they can feel, hear, and smell things photos cannot show.
5. Match what you see to the COST TIER DESCRIPTIONS provided — each tier describes exactly what this issue looks like at MINOR, MODERATE, and SEVERE stages.

Only mark INCONCLUSIVE if the relevant area is genuinely not visible or obstructed. If you can see the component, commit to a verdict.

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown, no explanation outside JSON):
{
  "verdict": "CONFIRMED" | "CLEARED" | "INCONCLUSIVE",
  "confidence": 0.0 to 1.0,
  "explanation": "2-3 sentence expert diagnosis. Reference specific components by their ${vehicle.make} ${vehicle.model} platform names. State what you see and what it means for this known issue.",
  "relevantPhotoIndices": [0, 1, ...],
  "observedCondition": "GOOD" | "FAIR" | "WORN" | "DAMAGED" | "FAILED",
  "visualObservations": ["specific observation 1", "specific observation 2"],
  "suggestedAction": "brief recommendation if CONFIRMED or INCONCLUSIVE, null if CLEARED"
}

Verdict guidelines:
- CONFIRMED: Photos and/or inspector observations show evidence of this known issue on this vehicle.
- CLEARED: The component/area is clearly visible and shows no signs of this known failure.
- INCONCLUSIVE: Photos don't show the relevant area clearly enough — not enough evidence to make a call.
- Confidence 0.8+ = definitive assessment, 0.5-0.8 = probable but limited view, below 0.5 = poor visibility

observedCondition — THIS DIRECTLY DETERMINES THE REPAIR COST ESTIMATE:
- GOOD: No signs of this known failure, component looks well-maintained → MINOR repair tier
- FAIR: Minor age-appropriate wear, no active failure indicators → MINOR repair tier
- WORN: Early/mid stages of this known failure developing → MODERATE repair tier
- DAMAGED: Active failure in progress, component needs repair → SEVERE repair tier
- FAILED: Component has clearly failed or is unsafe → SEVERE repair tier

When cost tier descriptions are provided below, match what you see to the specific tier description that fits. The tier labels describe exactly what each stage looks like for THIS specific issue on THIS platform.`;

  const riskContext = `RISK TO EVALUATE:
Title: ${risk.title}
Category: ${risk.category}
Severity: ${risk.severity}
Likelihood: ${risk.likelihood || "UNKNOWN"}

WHAT TO CHECK: ${risk.whatToCheck || risk.title}
WHERE TO LOOK: ${risk.whereToLook || "See category area"}
HOW TO INSPECT: ${risk.howToInspect || "Visual inspection of the relevant area"}

SIGNS OF FAILURE TO LOOK FOR:
${signsOfFailureList}

BACKGROUND: ${risk.aiSummary || risk.description}
WHY IT MATTERS: ${risk.whyItMatters || "Potential safety or reliability concern"}
${buildCostTierContext(risk)}
PHOTOS PROVIDED (${imageBlocks.length} images):
${photoDescriptions}

Analyze these photos for visual evidence of this specific risk. Pay special attention to the exact location described in WHERE TO LOOK and the observable indicators listed in SIGNS OF FAILURE.${risk.costTiers?.length ? " Use the COST TIER DESCRIPTIONS above to calibrate your observedCondition — match what you see to the tier that best fits." : ""}${buildInspectorObservationsContext(risk, riskAnswers)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: riskContext },
          ...imageBlocks,
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 600,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      riskId: risk.id,
      verdict: "INCONCLUSIVE",
      confidence: 0,
      explanation: "AI returned empty response.",
      evidenceMediaIds: [],
    };
  }

  const parsed = JSON.parse(content);

  // Map photo indices back to media IDs
  const evidenceIds = (parsed.relevantPhotoIndices || [])
    .filter((i: number) => i >= 0 && i < selectedMedia.length)
    .map((i: number) => selectedMedia[i].id);

  // Map observedCondition → cost tier for refined cost estimate
  const refinedCost = selectCostTier(risk, parsed.observedCondition);

  return {
    riskId: risk.id,
    verdict: parsed.verdict || "INCONCLUSIVE",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    explanation: parsed.explanation || "No explanation provided.",
    evidenceMediaIds: evidenceIds,
    observedCondition: parsed.observedCondition || undefined,
    visualObservations: Array.isArray(parsed.visualObservations) ? parsed.visualObservations : undefined,
    suggestedAction: parsed.suggestedAction || undefined,
    refinedCost,
  };
}

// ---------------------------------------------------------------------------
// Scan for unexpected issues (renamed from analyzeOverallCondition)
// ---------------------------------------------------------------------------

/** All standard photos used for the unexpected-issues sweep. */
const UNEXPECTED_SCAN_TYPES = [
  "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER",
  "DRIVER_SIDE", "PASSENGER_SIDE", "REAR_34_DRIVER",
  "REAR_34_PASSENGER", "REAR_CENTER", "ENGINE_BAY", "ROOF",
  "UNDERCARRIAGE", "DASHBOARD_DRIVER", "FRONT_SEATS", "REAR_SEATS",
  "CARGO_AREA",
];

/**
 * Scans all standard photos for UNEXPECTED damage/issues not covered by
 * the known-risk checklist. Grade fields removed — condition scoring is
 * now handled by `analyzeVehicleCondition()`.
 *
 * Cost: ~$0.15-0.25 per call.
 */
export async function scanForUnexpectedIssues(
  vehicle: { year: number; make: string; model: string },
  media: MediaForAnalysis[]
): Promise<OverallConditionResult> {
  const openai = getOpenAI();

  const scanMedia = UNEXPECTED_SCAN_TYPES
    .map((type) => media.find((m) => m.captureType === type))
    .filter((m): m is MediaForAnalysis => !!m);

  if (scanMedia.length === 0) {
    return {
      unexpectedFindings: [],
      summary: "No standard photos available for unexpected-issue scan.",
    };
  }

  const imageBlocks = scanMedia.map((m) => ({
    type: "image_url" as const,
    image_url: { url: m.url, detail: "high" as const },
  }));

  const photoDescriptions = scanMedia
    .map((m, i) => `Photo ${i}: ${m.captureType.replace(/_/g, " ")}`)
    .join("\n");

  const systemPrompt = `You are an expert automotive inspector scanning photos of a ${vehicle.year} ${vehicle.make} ${vehicle.model} for UNEXPECTED issues.

You are NOT scoring condition (that's done separately) and NOT checking known mechanical risks (also separate). Your sole job: find issues a standard risk checklist would MISS.

Scan ALL photos for:
- Body damage (dents, scratches, rust, paint chips, panel gaps, mismatched paint, respray evidence)
- Glass damage (chips, cracks)
- Aftermarket modifications (good or bad)
- Interior damage (tears, stains, burns, missing trim, water damage signs)
- Engine bay anomalies (aftermarket parts, missing components, wrong fluid colors)
- Undercarriage concerns (frame damage, major leaks, exhaust damage)
- Anything else unusual

Be thorough but conservative. Only flag issues you can CLEARLY see with confidence > 0.5.

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown):
{
  "unexpectedFindings": [
    {
      "title": "Short descriptive title",
      "description": "What you see and why it matters",
      "severity": "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR",
      "category": "COSMETIC_EXTERIOR" | "COSMETIC_INTERIOR" | "STRUCTURAL" | "ENGINE" | "ELECTRICAL" | "SAFETY" | "OTHER",
      "photoIndex": 0,
      "confidence": 0.0 to 1.0
    }
  ],
  "summary": "1-2 sentence summary of unexpected issues found (or 'No unexpected issues found')"
}

Do NOT flag normal age-appropriate wear as findings.`;

  const userContent = `Scan these ${imageBlocks.length} photos for unexpected issues.

PHOTOS PROVIDED:
${photoDescriptions}

Flag anything unusual for a ${vehicle.year} ${vehicle.make} ${vehicle.model}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userContent },
            ...imageBlocks,
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        unexpectedFindings: [],
        summary: "AI returned empty response for unexpected-issue scan.",
      };
    }

    const parsed = JSON.parse(content);

    const unexpectedFindings = Array.isArray(parsed.unexpectedFindings)
      ? parsed.unexpectedFindings
          .filter(
            (f: Record<string, unknown>) =>
              f.title && f.description &&
              typeof f.confidence === "number" && f.confidence > 0.5
          )
          .map((f: Record<string, unknown>) => ({
            title: String(f.title),
            description: String(f.description),
            severity: (["CRITICAL", "MAJOR", "MODERATE", "MINOR"].includes(String(f.severity))
              ? f.severity
              : "MINOR") as "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR",
            category: String(f.category || "OTHER"),
            photoIndex: typeof f.photoIndex === "number" ? f.photoIndex : -1,
            confidence: f.confidence as number,
          }))
      : [];

    return {
      unexpectedFindings,
      summary: parsed.summary || "Unexpected-issue scan completed.",
    };
  } catch (err) {
    console.error("[media-analyzer] Unexpected-issue scan failed:", err);
    return {
      unexpectedFindings: [],
      summary: "Unexpected-issue scan failed. Manual inspection recommended.",
    };
  }
}

// ---------------------------------------------------------------------------
// AI-Driven Vehicle Condition Assessment (4-area photo scoring)
// ---------------------------------------------------------------------------

/** Photo-to-area mapping for the 4 condition assessment areas */
const AREA_PHOTO_MAP = {
  exteriorBody: [
    "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER",
    "DRIVER_SIDE", "PASSENGER_SIDE", "REAR_34_DRIVER",
    "REAR_34_PASSENGER", "REAR_CENTER", "ROOF",
  ],
  interior: [
    "DASHBOARD_DRIVER", "FRONT_SEATS", "REAR_SEATS",
    "CARGO_AREA", "ODOMETER",
  ],
  mechanicalVisual: [
    "ENGINE_BAY", "TIRE_FRONT_DRIVER", "TIRE_REAR_DRIVER",
    "TIRE_FRONT_PASSENGER", "TIRE_REAR_PASSENGER",
  ],
  underbodyFrame: ["UNDERCARRIAGE"],
} as const;

/** Weighted contribution of each area to the 0-100 overall score */
const AREA_WEIGHTS = {
  exteriorBody: 0.30,
  interior: 0.15,
  mechanicalVisual: 0.35,
  underbodyFrame: 0.20,
};

interface VehicleInfo {
  year: number;
  make: string;
  model: string;
  mileage?: number | null;
}

// ---------------------------------------------------------------------------
// VIN OCR from hood label photo
// ---------------------------------------------------------------------------

/**
 * Extracts VIN from a hood label / VIN plate photo using GPT-4o Vision.
 * Returns the detected VIN and confidence. Cost: ~$0.05 per call.
 */
export async function extractVinFromPhoto(
  photoUrl: string
): Promise<{ vin: string | null; confidence: number }> {
  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a vehicle identification expert. Extract the 17-character VIN (Vehicle Identification Number) from the provided photo.

The VIN may appear on:
- A metal plate on the dashboard (viewed through the windshield)
- An embossed/stamped metal tag
- A hood label or emissions sticker
- A door jamb sticker
- Any label or plate on the vehicle

VIN format rules:
- Exactly 17 characters
- Only uses characters: A-H, J-N, P, R-Z, 0-9 (never uses I, O, or Q)
- First character is country of origin (1=USA, 2=Canada, 3=Mexico, J=Japan, etc.)
- Characters 4-8 describe vehicle attributes
- Character 9 is a check digit
- Character 10 is model year (T=1996, V=1997, W=1998, etc.)
- Characters 12-17 are sequential production number

IMPORTANT: Even if the image is slightly blurry, shot through glass, or has glare, try your best to read each character. Use context clues — for example, if the vehicle is a Ford F-250, the VIN likely starts with "1FTH" or "1FTN". Return your best reading even if uncertain about 1-2 characters.

Return JSON: { "vin": "<17 char VIN or null if truly unreadable>", "confidence": <0.0 to 1.0> }
- confidence 0.9+: clearly readable, high certainty on all characters
- confidence 0.6-0.9: readable but some characters uncertain (glare, blur, angle)
- confidence 0.3-0.6: partial read, several characters guessed
- Only return null if the image contains no VIN at all`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the VIN from this vehicle identification label photo." },
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
    const vin = typeof parsed.vin === "string" && parsed.vin.length === 17
      ? parsed.vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "")
      : null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;

    // Final length check after cleaning
    if (vin && vin.length !== 17) return { vin: null, confidence: 0 };

    return { vin, confidence };
  } catch (err) {
    console.error("[extractVinFromPhoto] Failed:", err);
    return { vin: null, confidence: 0 };
  }
}

// ---------------------------------------------------------------------------
// Odometer reading extraction from photo
// ---------------------------------------------------------------------------

/**
 * Extract the odometer reading from an instrument cluster photo using GPT-4o Vision.
 * Returns the mileage as a number and confidence level.
 *
 * Cost: ~$0.03-0.05 per call (GPT-4o Vision, single image)
 */
export async function extractOdometerFromPhoto(
  photoUrl: string,
): Promise<{ mileage: number | null; confidence: number }> {
  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a vehicle odometer reading specialist. Extract the current mileage/odometer reading from the provided photo of a vehicle's instrument cluster or digital display.

Reading tips:
- Look for the largest number display, typically 5-6 digits
- Distinguish between ODOMETER (total miles) and TRIP meter (short distance)
- Digital displays: read the number directly
- Analog/mechanical: read the white number wheels, ignore partial digit
- If display shows both miles and kilometers, return MILES
- Ignore tenths digit if present (e.g., 123456.7 → return 123456)

Return JSON: { "mileage": <integer miles or null if unreadable>, "confidence": <0.0 to 1.0> }
- confidence 0.9+: clearly readable display
- confidence 0.6-0.9: readable but some digits uncertain
- confidence 0.3-0.6: partial read, some digits guessed
- Only return null if the odometer is not visible at all`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Read the odometer/mileage from this instrument cluster photo." },
            { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return { mileage: null, confidence: 0 };

    const parsed = JSON.parse(raw);
    const mileage = typeof parsed.mileage === "number" && parsed.mileage > 0
      ? Math.round(parsed.mileage)
      : null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;

    if (mileage) {
      console.log(`[OdometerOCR] Read ${mileage.toLocaleString()} miles (${(confidence * 100).toFixed(0)}% confidence)`);
    }

    return { mileage, confidence };
  } catch (err) {
    console.error("[OdometerOCR] Failed:", err);
    return { mileage: null, confidence: 0 };
  }
}

// ---------------------------------------------------------------------------
// 4-area AI condition assessment
// ---------------------------------------------------------------------------

/**
 * Runs 4 parallel GPT-4o Vision calls to produce an independent,
 * photo-based condition assessment. Each area gets a 1-10 score.
 *
 * Cost: ~$0.40-0.60 per inspection (4 parallel GPT-4o Vision calls).
 */
export async function analyzeVehicleCondition(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[]
): Promise<ConditionAssessment> {
  const openai = getOpenAI();
  const mileageStr = vehicle.mileage
    ? `${vehicle.mileage.toLocaleString()} miles`
    : "unknown mileage";

  // Collect photos per area
  const areaMedia: Record<string, MediaForAnalysis[]> = {};
  const photoCoverage: Record<string, number> = {};
  for (const [area, types] of Object.entries(AREA_PHOTO_MAP)) {
    const photos = types
      .map((t) => media.find((m) => m.captureType === t))
      .filter((m): m is MediaForAnalysis => !!m);
    areaMedia[area] = photos;
    photoCoverage[area] = photos.length;
  }

  // Run 4 area assessments in parallel
  const [exteriorBody, interior, mechanicalVisual, underbodyFrame] =
    await Promise.all([
      assessArea(openai, vehicle, mileageStr, "Exterior Body", areaMedia.exteriorBody, EXTERIOR_CHECKLIST),
      assessArea(openai, vehicle, mileageStr, "Interior", areaMedia.interior, INTERIOR_CHECKLIST),
      assessArea(openai, vehicle, mileageStr, "Mechanical / Visual", areaMedia.mechanicalVisual, MECHANICAL_CHECKLIST),
      assessArea(openai, vehicle, mileageStr, "Underbody / Frame", areaMedia.underbodyFrame, UNDERBODY_CHECKLIST),
    ]);

  // Calculate weighted overall score (0-100)
  const overallScore = Math.round(
    (exteriorBody.score / 10) * AREA_WEIGHTS.exteriorBody * 100 +
    (interior.score / 10) * AREA_WEIGHTS.interior * 100 +
    (mechanicalVisual.score / 10) * AREA_WEIGHTS.mechanicalVisual * 100 +
    (underbodyFrame.score / 10) * AREA_WEIGHTS.underbodyFrame * 100
  );

  const summary = [
    `Overall condition score: ${overallScore}/100.`,
    exteriorBody.summary,
    interior.summary,
    mechanicalVisual.summary,
    underbodyFrame.summary,
  ].join(" ");

  return {
    overallScore,
    exteriorBodyScore: exteriorBody.score,
    interiorScore: interior.score,
    mechanicalVisualScore: mechanicalVisual.score,
    underbodyFrameScore: underbodyFrame.score,
    exteriorBody,
    interior,
    mechanicalVisual,
    underbodyFrame,
    summary,
    photoCoverage: {
      exteriorBody: photoCoverage.exteriorBody,
      interior: photoCoverage.interior,
      mechanicalVisual: photoCoverage.mechanicalVisual,
      underbodyFrame: photoCoverage.underbodyFrame,
    },
  };
}

// ── Area-specific checklists for the AI ──

const EXTERIOR_CHECKLIST = `EVALUATE:
- Paint condition (swirls, oxidation, clear coat failure, respray evidence, color mismatch between panels)
- Body panel alignment and gaps (even/uneven, signs of prior collision repair)
- Dents, dings, scratches, and their severity
- Rust or corrosion (surface, bubbling, perforation)
- Trim, moldings, badges (missing, faded, damaged)
- Glass condition (windshield chips/cracks, window tint condition)
- Headlight/taillight lens condition (hazing, yellowing, cracks, moisture)
- Wheel condition (curb rash, corrosion, finish peeling)`;

const INTERIOR_CHECKLIST = `EVALUATE:
- Seat condition (leather cracks/peeling, fabric tears/stains, bolster wear, cushion support)
- Dashboard (cracks, warping, fading, sticky surfaces)
- Steering wheel wear (leather/wrap condition, controls)
- Carpet and floor mats (stains, wear patterns, dampness)
- Headliner (sagging, stains, tears)
- Door panels and trim (scuffs, loose pieces, broken clips)
- Controls and buttons (missing, broken, discolored)
- Odor indicators from visual clues (smoke staining on headliner, water marks, mold evidence)
- CRITICAL: Does the interior wear level MATCH the claimed mileage shown on the odometer? A 120k-mile vehicle should show proportionate wear. Pristine interior at high mileage may indicate replacement; heavy wear at low mileage is a concern.`;

const MECHANICAL_CHECKLIST = `EVALUATE:
- Engine bay cleanliness and presentation
- Visible fluid leaks or staining (oil, coolant, power steering, transmission)
- Belt and hose condition (cracking, glazing, swelling)
- Battery condition (corrosion on terminals, age)
- Aftermarket modifications (quality of install)
- Tire tread depth across all 4 tires — CROSS-COMPARE: uneven wear between tires signals alignment or suspension issues
- Tire sidewall condition (cracking, bulges, damage, age/DOT date if visible)
- Tire brand/model consistency (mismatched tires = concern)
- Visible brake rotor condition through wheels (grooves, rust, thickness)`;

const UNDERBODY_CHECKLIST = `EVALUATE:
- Frame/unibody condition (rust severity, bends, kinks, repair evidence, welding)
- Underside fluid leaks (active drips, wet spots, dried staining)
- Exhaust system condition (rust, holes, hangers, aftermarket modifications)
- CV boots and axle condition (torn boots, grease spray)
- Suspension components visible condition (bushings, links, mounts)
- Protective coatings (undercoating presence, spray patterns)`;

/**
 * Assesses a single area using GPT-4o Vision. Returns a 1-10 score with
 * detailed observations.
 */
async function assessArea(
  openai: ReturnType<typeof getOpenAI>,
  vehicle: VehicleInfo,
  mileageStr: string,
  areaName: string,
  photos: MediaForAnalysis[],
  checklist: string
): Promise<AreaConditionDetail> {
  if (photos.length === 0) {
    return {
      score: 5,
      confidence: 0.1,
      keyObservations: ["No photos available for this area"],
      concerns: [],
      summary: `No ${areaName.toLowerCase()} photos provided — defaulting to neutral score.`,
    };
  }

  // Use all photos on primary attempt — reduce only on retry if it fails
  const cappedPhotos = photos;

  const imageBlocks = cappedPhotos.map((m) => ({
    type: "image_url" as const,
    image_url: { url: m.url, detail: "high" as const },
  }));

  const photoLabels = cappedPhotos
    .map((m, i) => `Photo ${i}: ${m.captureType.replace(/_/g, " ")}`)
    .join("\n");

  const systemPrompt = `You are an expert automotive condition assessor specializing in ${vehicle.make} ${vehicle.model} vehicles. You are evaluating the ${areaName.toUpperCase()} of a ${vehicle.year} ${vehicle.make} ${vehicle.model} with ${mileageStr}.

MILEAGE CALIBRATION: This vehicle has ${mileageStr}. Score what is NORMAL wear for this mileage. A 120k-mile truck with moderate tire wear is normal (score 7-8); the same wear at 20k miles is a concern (score 4-5). A well-maintained high-mileage vehicle should score 7-8 if it shows only age-appropriate wear.

CRITICAL — COSMETIC vs CONDITION:
- DIRTY/DUSTY is NOT a condition issue. A dusty engine bay, road grime, dirty wheels, or a car that needs a wash should NOT lower the score. Score the UNDERLYING condition, not cleanliness.
- Minor cosmetic wear (light scratches, small chips, door dings) that is NORMAL for the age/mileage should not drop below 7.
- Only score below 7 for ACTUAL damage, mechanical issues, structural problems, or wear that is EXCESSIVE for the vehicle's age and mileage.

SCORING RUBRIC (1-10):
- 9-10: Showroom / like-new condition, virtually no wear
- 7-8: Good to very good — well-maintained, normal age-appropriate wear only
- 5-6: Below average — noticeable damage, excessive wear, or deferred maintenance
- 3-4: Poor — significant damage, multiple mechanical concerns, or heavy wear
- 1-2: Very poor — severe damage, major structural issues, or extreme neglect

Most well-maintained vehicles should score 7-8. Reserve 5-6 for vehicles with REAL problems, not cosmetic dirt.

${checklist}

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown):
{
  "score": <number 1-10>,
  "confidence": <number 0.0-1.0>,
  "keyObservations": ["observation 1", "observation 2", ...],
  "concerns": ["concern 1", ...],
  "summary": "1-2 sentence ${areaName.toLowerCase()} condition summary",
  "scoreJustification": "2-3 sentences explaining WHY you chose this specific score. Reference the rubric. Explain what would need to be different for a higher or lower score."
}

- keyObservations: 3-6 factual observations about what you see (neutral or positive)
- concerns: 0-4 specific issues or concerns (only things that ACTUALLY impact condition — not dirt or cosmetic dust)
- scoreJustification: Explain your reasoning. If you scored 7, explain what's keeping it from an 8 and what would drop it to a 6.
- confidence: how confident you are in your score (1.0 = clear photos, full coverage; 0.5 = partial visibility; <0.3 = mostly guessing)
- Be precise and specific. Reference actual components by name.`;

  const userContent = `Assess the ${areaName} condition of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

PHOTOS PROVIDED (${imageBlocks.length}):
${photoLabels}`;

  // Retry up to 3 times with ALL photos — a failed assessment is unacceptable
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userContent },
              ...imageBlocks,
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[media-analyzer] ${areaName} attempt ${attempt}/3: empty response`);
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.warn(`[media-analyzer] ${areaName} attempt ${attempt}/3: malformed JSON`);
        continue;
      }

      const score = Number(parsed.score);
      if (!score || score < 1 || score > 10) {
        console.warn(`[media-analyzer] ${areaName} attempt ${attempt}/3: invalid score ${score}`);
        continue;
      }

      return {
        score: Math.max(1, Math.min(10, Math.round(score))),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        keyObservations: Array.isArray(parsed.keyObservations)
          ? parsed.keyObservations.map(String)
          : [],
        concerns: Array.isArray(parsed.concerns)
          ? parsed.concerns.map(String)
          : [],
        summary: String(parsed.summary || `${areaName} assessment completed.`),
        scoreJustification: parsed.scoreJustification ? String(parsed.scoreJustification) : undefined,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[media-analyzer] ${areaName} attempt ${attempt}/3 failed: ${errMsg}`);
    }
  }

  // All 3 attempts failed — surface the error so the user knows to retry
  throw new Error(`${areaName} condition assessment failed after 3 attempts with ${photos.length} photos. Please try again.`);
}

// ---------------------------------------------------------------------------
// Cost tier selection
// ---------------------------------------------------------------------------

const CONDITION_TO_TIER: Record<string, "MINOR" | "MODERATE" | "SEVERE"> = {
  GOOD: "MINOR",
  FAIR: "MINOR",
  WORN: "MODERATE",
  DAMAGED: "SEVERE",
  FAILED: "SEVERE",
};

/**
 * Maps an observed condition (from AI vision) to the matching cost tier.
 * Returns the refined cost range in cents, or undefined if no tiers available.
 */
function selectCostTier(
  risk: AggregatedRisk,
  observedCondition?: string
): AIAnalysisResult["refinedCost"] {
  if (!risk.costTiers?.length || !observedCondition) return undefined;

  const tierCondition = CONDITION_TO_TIER[observedCondition] || "MODERATE";
  const tier = risk.costTiers.find((t) => t.condition === tierCondition);
  if (!tier) return undefined;

  return {
    low: tier.costLow,
    high: tier.costHigh,
    tierCondition: tier.condition,
    tierLabel: tier.label,
  };
}

/**
 * Maps manual inspection question failure count to a cost tier.
 * Exported for use in inspection procedures for manual-only checks.
 */
export function selectCostTierFromFailures(
  risk: AggregatedRisk,
  failureCount: number
): AIAnalysisResult["refinedCost"] {
  if (!risk.costTiers?.length) return undefined;

  const tierCondition: "MINOR" | "MODERATE" | "SEVERE" =
    failureCount === 0 ? "MINOR" : failureCount === 1 ? "MODERATE" : "SEVERE";
  const tier = risk.costTiers.find((t) => t.condition === tierCondition);
  if (!tier) return undefined;

  return {
    low: tier.costLow,
    high: tier.costHigh,
    tierCondition: tier.condition,
    tierLabel: tier.label,
  };
}

// ---------------------------------------------------------------------------
// Photo relevance selection
// ---------------------------------------------------------------------------

/**
 * Selects the most relevant photos for a given risk based on capture type matching.
 */
function selectRelevantMedia(risk: AggregatedRisk, media: MediaForAnalysis[]): MediaForAnalysis[] {
  // First, add any photos specifically captured for this risk (evidence + question media)
  const riskEvidence = media.filter((m) =>
    m.captureType.startsWith(`FINDING_EVIDENCE_${risk.id}`) ||
    m.captureType.startsWith(`RISK_Q_${risk.id}_`)
  );

  // Then add area-relevant standard photos based on risk category
  const categoryMediaMap: Record<string, string[]> = {
    ENGINE: ["ENGINE_BAY", "UNDER_HOOD_LABEL", "FRONT_CENTER", "UNDERCARRIAGE"],
    TRANSMISSION: ["UNDERCARRIAGE", "ENGINE_BAY", "DRIVER_SIDE"],
    DRIVETRAIN: ["UNDERCARRIAGE", "DRIVER_SIDE", "PASSENGER_SIDE"],
    STRUCTURAL: ["UNDERCARRIAGE", "FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE", "FRONT_34_DRIVER", "REAR_34_DRIVER"],
    SUSPENSION: ["UNDERCARRIAGE", "FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER", "TIRES_DETAIL"],
    BRAKES: ["FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER", "TIRES_DETAIL"],
    TIRES_WHEELS: ["TIRES_DETAIL", "FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER", "DRIVER_SIDE", "PASSENGER_SIDE"],
    ELECTRICAL: ["ENGINE_BAY", "FRONT_CENTER", "REAR_CENTER", "DASHBOARD", "INSTRUMENT_CLUSTER"],
    ELECTRONICS: ["DASHBOARD", "INFOTAINMENT", "INSTRUMENT_CLUSTER", "FRONT_CENTER"],
    SAFETY: ["FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE", "DASHBOARD"],
    COSMETIC_EXTERIOR: ["FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE", "ROOF", "FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER"],
    COSMETIC_INTERIOR: ["DASHBOARD", "FRONT_SEATS", "REAR_SEATS", "CENTER_CONSOLE", "INFOTAINMENT"],
    HVAC: ["ENGINE_BAY", "DASHBOARD", "CENTER_CONSOLE"],
    INTERIOR: ["DASHBOARD", "FRONT_SEATS", "REAR_SEATS", "CENTER_CONSOLE", "INFOTAINMENT", "INSTRUMENT_CLUSTER"],
    CARGO: ["TRUCK_BED", "REAR_CENTER", "REAR_34_DRIVER", "REAR_34_PASSENGER"],
  };

  const relevantTypes = categoryMediaMap[risk.category] || [];
  const areaPhotos = media.filter(
    (m) => relevantTypes.includes(m.captureType) && !riskEvidence.some((re) => re.id === m.id)
  );

  // Risk-specific evidence first, then area photos
  return [...riskEvidence, ...areaPhotos];
}

/**
 * Builds a context string describing the cost tiers for a risk,
 * so the vision AI can calibrate observedCondition to match tier descriptions.
 */
function buildCostTierContext(risk: AggregatedRisk): string {
  if (!risk.costTiers?.length) return "";

  const lines: string[] = [];
  lines.push("\nCOST TIER DESCRIPTIONS (use these to calibrate your observedCondition):");
  for (const tier of risk.costTiers) {
    const low = (tier.costLow / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    const high = (tier.costHigh / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    const conditionMap: Record<string, string> = {
      MINOR: "GOOD/FAIR",
      MODERATE: "WORN",
      SEVERE: "DAMAGED/FAILED",
    };
    lines.push(`- ${tier.condition} (${low}–${high}): "${tier.label}" → observedCondition = ${conditionMap[tier.condition] || tier.condition}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Builds a context string describing inspector's hands-on observations
 * from guided inspection question answers.
 */
function buildInspectorObservationsContext(
  risk: AggregatedRisk,
  riskAnswers?: QuestionAnswer[]
): string {
  if (!riskAnswers || riskAnswers.length === 0 || !risk.inspectionQuestions?.length) {
    return "";
  }

  const lines: string[] = [];
  lines.push("\n\nINSPECTOR HANDS-ON OBSERVATIONS:");
  lines.push("The inspector performed physical checks and reported the following:");

  for (const qa of riskAnswers) {
    if (qa.answer == null) continue;
    const qDef = risk.inspectionQuestions.find((q) => q.id === qa.questionId);
    if (!qDef) continue;

    const isFailure = qa.answer === qDef.failureAnswer;
    const indicator = isFailure ? "(⚠ indicates failure)" : "(✓ no issue)";
    lines.push(`- Q: "${qDef.question}" → ${qa.answer.toUpperCase()} ${indicator}`);
    if (qa.mediaIds && qa.mediaIds.length > 0) {
      lines.push(`  [Inspector attached ${qa.mediaIds.length} photo(s) as evidence]`);
    }
  }

  lines.push("");
  lines.push("Weight these firsthand observations heavily — inspectors can feel, hear, and smell things that photos cannot capture. If the inspector confirmed a failure through hands-on testing, treat that as strong evidence even if photos are inconclusive.");

  return lines.join("\n");
}
