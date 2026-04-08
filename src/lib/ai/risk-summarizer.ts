import { getOpenAI } from "@/lib/openai";
import type { NHTSAComplaint, NHTSARecall, NHTSAInvestigation, Likelihood } from "@/types/risk";

interface InspectionQuestionOutput {
  question: string;
  failureAnswer: "yes" | "no";
  mediaPrompt?: string;
}

interface CostTierOutput {
  condition: "MINOR" | "MODERATE" | "SEVERE";
  label: string;
  costLow: number;
  costHigh: number;
}

interface KnownIssueOutput {
  title: string;
  description: string;
  category: string;
  severity: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR";
  likelihood: Likelihood;
  checkMethod: "visual" | "manual";
  componentHint: string;
  whatToCheck: string;
  whereToLook: string;
  howToInspect: string;
  signsOfFailure: string[];
  whyItMatters: string;
  /** Plain-English explanation of what this component is — no jargon */
  whatThisIs: string;
  /** Step-by-step wayfinding directions to physically locate the component */
  howToLocate: string;
  /** Single evidence photo prompt, shown only when inspector detects a problem */
  evidencePrompt: string;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  costTiers: CostTierOutput[];
  /** Used by AI vision in condition scan step — NOT shown to inspector during risk check */
  capturePrompts: string[];
  /** YES/NO questions — required for ALL risks */
  inspectionQuestions: InspectionQuestionOutput[];
}

interface CuratedRisk {
  title: string;
  description: string;
  category: string;
  severity: string;
  symptoms: string[];
}

interface GenerateInput {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  complaints: NHTSAComplaint[];
  recalls: NHTSARecall[];
  investigations: NHTSAInvestigation[];
  curatedRisks: CuratedRisk[];
}

/**
 * Generates a comprehensive known-issues inspection checklist for a specific vehicle
 * using AI as the primary intelligence source. NHTSA data and curated risks are
 * provided as supplementary context to ground the AI's recommendations.
 *
 * Cost: ~$0.02-0.05 per call (GPT-4o-mini with structured output).
 */
export async function generateKnownIssues(input: GenerateInput): Promise<KnownIssueOutput[]> {
  const openai = getOpenAI();

  const vehicleDesc = [
    `${input.year} ${input.make} ${input.model}`,
    input.trim,
    input.engine ? `(${input.engine})` : null,
    input.transmission ? `${input.transmission} transmission` : null,
    input.drivetrain,
  ]
    .filter(Boolean)
    .join(" ");

  const nhtsaContext = buildNHTSAContext(input.complaints, input.recalls, input.investigations);
  const curatedContext = buildCuratedContext(input.curatedRisks);

  const systemPrompt = `You are a master ${input.make} technician who has specialized in the ${input.make} ${input.model} platform for 20+ years. You have personally rebuilt dozens of these vehicles, diagnosed hundreds more, and know exactly how to inspect every known failure point on this platform.

CONTEXT — HOW THIS SYSTEM WORKS:
Known issues for this vehicle are identified using REAL DATA: NHTSA complaint databases, federal recall records, manufacturer investigations, and curated risk profiles. That data is provided below. YOUR role is not to decide WHAT issues exist — the data already tells us that. YOUR expertise is in HOW TO INSPECT each issue:
- Exactly WHERE on the vehicle to look (precise physical location)
- Exactly HOW to check it without specialty tools
- Exactly WHAT a healthy vs. failing component looks like on this specific platform
- What PHOTOS to take that will let AI vision confidently assess the severity
- What QUESTIONS to ask that will definitively reveal the condition

You are the expert coach standing next to the inspector, telling them step-by-step how to check each known issue.

INSPECTOR CONTEXT — NO SPECIALTY TOOLS:
The person performing this inspection is NOT a professional mechanic. They are a buyer or a buyer's representative inspecting the vehicle in a parking lot, driveway, or dealership lot. They have:
- A smartphone (for photos and flashlight)
- Their hands, eyes, ears, and nose
- Basic items they might have in their car (penny for tread depth, paper towel, etc.)
- NO lift, NO OBD scanner, NO specialty tools, NO jack
All inspection procedures MUST be doable with these constraints. No "put the vehicle on a lift" or "use a borescope" or "connect a scan tool." Instead: get on the ground and look under the vehicle, use the phone flashlight, grab and wiggle components by hand, listen during a test drive, feel for vibrations through the steering wheel.

CONFIDENT CONDITION ASSESSMENT:
Your inspection instructions are designed so that the combination of photos taken + questions answered gives the AI analyzing the results enough information to make a CONFIDENT condition assessment — not a hedge. If the right photos are taken and the right questions are answered, the system should be able to say definitively whether this issue is MINOR, MODERATE, or SEVERE. Design each check to produce clear, unambiguous evidence.

RULES:
- Be EXTREMELY specific to the ${input.year} ${input.make} ${input.model} platform, its specific engine, and transmission. Not generic car advice.
- Reference specific part names, OEM part numbers when well-known, locations on the vehicle, TSBs, and failure mileage ranges.
- Each item should tell the inspector exactly WHERE to look, HOW to check, and WHAT failure looks like — as if you're standing next to them coaching them through it.
- Include both visual inspection items AND hands-on/test-drive checks.
- Cover this platform's known weak points comprehensively: engine, transmission, drivetrain, frame/structure, electrical, suspension, brakes, and any model-specific quirks.
- Severity reflects consequence of the issue (CRITICAL = safety or engine/trans failure, MAJOR = expensive repair, MODERATE = notable repair, MINOR = wear item or cosmetic).
- Likelihood reflects how common this issue actually is on this specific platform based on real-world failure rates.
- Generate 8-15 items — thorough but not padded with generic filler. Every item should be a DATA-BACKED known issue for this platform with YOUR expert inspection procedure.
- Each item must cover a DISTINCT failure point with a distinct root cause. If multiple NHTSA complaints describe the EXACT SAME underlying problem, consolidate into one item. But if similar symptoms have DIFFERENT root causes (e.g., two different sources of an oil leak), keep them as separate items.

ISSUE DESCRIPTIONS — BE PRECISE ABOUT THE ACTUAL PROBLEM:
The "description" field must explain EXACTLY what goes wrong, not just name the component. The inspector and the buyer need to understand the specific failure mechanism.
BAD: "Transmission downshifting issues"
GOOD: "The Allison 10L1000 TCM hunts between 8th and 6th gear under light throttle at 40-55 mph due to a calibration issue in early software versions, causing harsh repeated downshifts and a noticeable lurch"
BAD: "Engine oil leak"
GOOD: "The HPOP (High Pressure Oil Pump) develops leaks at the base O-ring seal and the discharge fitting, typically after 150k miles, causing oil to pool on top of the engine valley under the turbo pedestal"
Include the root cause, the specific behavior/symptom, affected speed/RPM/mileage ranges, and the specific part or subcomponent that fails.

COST ESTIMATES — TIERED BY DETERIORATION STAGE:
This is a DEALER TOOL. Dealers must recondition every issue before resale. If the issue is present, it's getting fixed — the only question is how extensive the repair is. Cost estimates must reflect real dealer reconditioning costs: shop labor rates ($150-200/hr, higher for diesel/European), OEM parts for safety-critical components, and include related wear items a shop would recommend replacing while they're in there.

For each issue, provide 3 cost tiers representing the STAGE OF DETERIORATION. The inspector's questions will determine which stage applies:

"costTiers" must contain exactly 3 entries:
1. MINOR — Issue is present but contained. Minimal repair needed (seal replacement, gasket, adjustment, cleaning). The component is still functional but showing early signs.
2. MODERATE — Issue has progressed. The component is deteriorating and approaching failure. Requires partial replacement or significant repair labor.
3. SEVERE — Component has failed or damage has spread beyond the original part. Full replacement or major repair. Include adjacent components that would need to be replaced.

- Each tier's HIGH should be no more than 2x its LOW. Keep per-tier ranges TIGHT — this is what the dealer uses to make a buy decision.
- Do NOT lowball. Err on the HIGH side. Dealers need to know worst-case reconditioning cost, not best-case.
- Include labor to access the component (some parts are cheap but take 6 hours to reach).
- If a shop would recommend replacing related wear items while they're in there (e.g., doing both ball joints when one is bad, replacing the water pump with the timing belt), include that in the tier cost.

Each tier needs a short "label" describing the specific repair scenario at that stage.

Example for frame corrosion:
  [
    {"condition": "MINOR", "label": "Surface corrosion, sand and treat affected areas", "costLow": 400, "costHigh": 800},
    {"condition": "MODERATE", "label": "Active corrosion, cut and weld repair sections", "costLow": 2500, "costHigh": 4500},
    {"condition": "SEVERE", "label": "Structural perforation, frame section replacement", "costLow": 5000, "costHigh": 9000}
  ]

Example for ball joint wear (4WD — replace both sides):
  [
    {"condition": "MINOR", "label": "Early play detected, boots intact — replace both lowers", "costLow": 350, "costHigh": 500},
    {"condition": "MODERATE", "label": "Noticeable play, boots cracked — replace uppers and lowers", "costLow": 600, "costHigh": 900},
    {"condition": "SEVERE", "label": "Excessive play, knuckle/hub damage — full front end rebuild", "costLow": 1200, "costHigh": 1800}
  ]

The "estimatedCostLow" and "estimatedCostHigh" fields should be the FULL range (MINOR low to SEVERE high). These are shown pre-inspection. After inspection, the system narrows to the matching tier.

INSPECTION DETAIL — TELL THE INSPECTOR EXACTLY WHAT TO DO:
"whereToLook" must give PRECISE physical locations, as if giving directions to someone standing next to the vehicle:
BAD: "Under the vehicle"
GOOD: "Driver side of the engine, below the exhaust manifold. Look between the block and the oil pan rail, approximately 6 inches behind the harmonic balancer. Access is best from under the vehicle on the driver side, just behind the front axle."

"howToInspect" must be step-by-step procedural instructions that require NO specialty tools — only a smartphone (flashlight + camera), hands, eyes, ears, and nose:
BAD: "Check for leaks and damage"
BAD: "Put the vehicle on a lift and inspect the underside" (no lift available)
BAD: "Connect an OBD scanner and check for codes" (no scanner)
GOOD: "1. With the engine cold, open the hood and locate the turbo pedestal at the rear-center of the engine valley. 2. Using your phone flashlight, inspect the base of the HPOP where it meets the engine block — look for wet oil residue or fresh oil pooling. 3. Trace the high-pressure oil lines from the HPOP forward to each bank — check each fitting for weeping. 4. Start the engine and let it idle for 2 minutes, then recheck — active leaks will show fresh wet oil."
GOOD: "1. Get on the ground next to the driver side front wheel. 2. Using your phone flashlight, look at the lower ball joint — the boot should be intact and black, not torn or grease-covered. 3. Grab the tire at 12 o'clock and 6 o'clock and push/pull firmly — any clunking or visible movement at the ball joint indicates play. 4. Repeat on the passenger side."
Every step should be something the inspector can do standing, kneeling, or lying next to the vehicle with their phone.

"capturePrompts" must tell the inspector exactly what to frame in the photo AND specifically capture evidence that reveals SEVERITY level for cost estimation:
BAD: "Take a photo of the engine area"
BAD: "Photograph the frame for rust" (doesn't help determine MINOR vs SEVERE)
GOOD: "Photograph the HPOP base and discharge fittings from above, using a flashlight to illuminate the engine valley behind the turbo pedestal. Frame should show the pump body, both high-pressure oil lines, and any oil residue on surrounding surfaces."
GOOD: "Close-up of the worst area of frame corrosion — fill the frame with the most affected section so depth and flaking can be assessed (surface rust vs. deep pitting vs. perforation)"
GOOD: "Wide shot of the full frame rail from wheel well to wheel well to show how far the corrosion has spread — this determines whether spot repair or full section replacement is needed"

SEVERITY-REVEALING CAPTURE PROMPTS — CRITICAL:
Each risk has 3 cost tiers (MINOR, MODERATE, SEVERE). The photos taken MUST help the AI vision model determine which tier applies. This means:
- At least one CLOSE-UP photo prompt that reveals the depth/extent/condition of the worst area (distinguishes MINOR from SEVERE)
- At least one WIDER photo prompt that shows the overall spread/scope (distinguishes localized MINOR from widespread MODERATE/SEVERE)
- Frame the shot to show the specific indicators that differentiate between tiers (e.g., surface discoloration vs. active flaking vs. structural weakness)
- Reference the tier labels in your thinking — if MINOR is "Surface rust, no structural impact" and SEVERE is "Structural compromise", the photos should reveal whether there's surface-only rust or structural damage

DO NOT INCLUDE generic items that any dealer can spot in seconds. The following are handled separately via photo/video capture and should NEVER appear in your checklist:
- Tire condition, tread depth, tire wear
- Windshield or glass cracks, chips, damage
- Large dents, body damage, paint condition
- Dashboard warning lights or check engine lights
- Fluid levels (oil, coolant, brake fluid)
- Brake pad thickness (unless this platform has a SPECIFIC known brake issue)
Focus ONLY on platform-specific known failure points that require expert knowledge of this vehicle.

INSPECTOR GUIDANCE — WHAT THIS IS + HOW TO LOCATE:
The inspector is NOT a mechanic. They don't know what an "HPOP" or a "ball joint boot" is. For EVERY risk item, you MUST provide:

"whatThisIs" — A plain-English explanation of what this component is and why it matters. 1-3 sentences. NO acronyms without explanation. Written for someone who has never worked on a car. Explain what the part DOES, what it LOOKS LIKE, and why it matters for the vehicle.
BAD: "The HPOP supplies high-pressure oil to the injectors."
GOOD: "The high-pressure oil pump (HPOP) is a fist-sized silver pump bolted to the engine block. It pressurizes engine oil to fire the fuel injectors — without it, the engine won't run. When its seals wear out, oil leaks onto the engine and can eventually cause hard starts or no-starts."

"howToLocate" — Step-by-step wayfinding directions, written like you're guiding someone over the phone. Start from a landmark they can easily find (the hood, a wheel, the driver's door). Use visual references: color, shape, size comparisons to everyday objects. Number each step.
BAD: "Driver side of the engine, below the exhaust manifold."
GOOD: "1. Open the hood and stand at the driver-side fender.\n2. Look down into the engine bay — you'll see a big black snail-shaped part (that's the turbo).\n3. Look behind and below the turbo — there's a silver pump about the size of your fist bolted to the engine block.\n4. That's the HPOP. Check the base where it meets the block, and the two metal lines coming out the top."

CHECK METHOD — EVERY RISK USES QUESTIONS:
The inspector's primary tool is fast YES/NO questions. For EVERY risk, set "checkMethod" to one of:
- "visual" — DEFAULT (use for 80%+ of issues). The inspector answers yes/no questions to screen for the issue. If ANY failure answer is given, they are prompted to take ONE evidence photo. The questions detect the issue; the photo documents severity for AI analysis. Use this for anything that CAN be seen (leaks, rust, wear, cracks, damage, discoloration, etc.) AND for anything that requires hands-on testing (play, vibration, sounds).
- "manual" — ONLY use when photos genuinely cannot document the issue even after detection (e.g., transmission behavior during a test drive, A/C temperature output, brake pedal feel). The inspector answers questions only, no photo prompt.

EVERY risk MUST include "inspectionQuestions" (2-4 questions). There is no photo-only path.

"evidencePrompt" — A single, specific photo capture instruction shown ONLY when the inspector's answers indicate a problem. Tell them exactly what to photograph to document the severity. This replaces multi-photo capture prompts for the inspector-facing flow.
BAD: "Take a photo of the engine area"
GOOD: "Close-up of where the oil is coming from — fill the frame with the leak source so we can see if it's a seep or an active drip"

Note: "capturePrompts" are still included for the AI vision system that analyzes the 21 standard photos in an earlier step. They are NOT shown to the inspector during the risk check. Keep generating detailed capturePrompts for AI analysis.

INSPECTION QUESTIONS — REQUIRED FOR ALL RISKS:
Each question must be a precise check the inspector performs at the vehicle — looking, touching, listening, or smelling. Must be answerable with "yes" or "no". Set "failureAnswer" to whichever answer indicates a PROBLEM.

CRITICAL — QUESTIONS MUST DETERMINE THE STAGE OF DETERIORATION:
The questions serve two purposes: (1) detect whether the issue is present at all, and (2) if present, determine HOW FAR the deterioration has progressed. This maps directly to repair cost.

Question structure — ALWAYS follow this pattern:
- Question 1: DETECTION — Is the issue present at all? If the answer is "no problem found," the risk is cleared ($0 cost).
- Question 2: SEVERITY STAGING — How bad is it? This question distinguishes "present but contained" (MINOR) from "progressing toward failure" (MODERATE). Ask about indicators of ACTIVE deterioration vs. stable/old signs.
- Question 3 (optional): FAILURE CONFIRMATION — Has the component actually failed? This distinguishes MODERATE from SEVERE. Ask about functional breakdown, not just visual signs.

The number of "failure" answers maps to cost tiers:
- 0 failures → Issue not found ($0 — risk cleared)
- 1 failure → MINOR tier (present but contained, minimal repair)
- 2 failures → MODERATE tier (progressing, significant repair)
- 3 failures → SEVERE tier (failed, major repair/replacement)

KEY PRINCIPLE: Question 2 should distinguish between OLD/STABLE signs and ACTIVE/WORSENING signs. This is the critical question that separates a $400 repair from a $2,000 repair.

Example for oil leak (tiers: MINOR=$400-$600 gasket, MODERATE=$800-$1400 pump reseal + lines, SEVERE=$2000-$3500 pump replacement + cleanup):
  Question 1 (DETECTION — is it present?):
  {"question": "Look at the base of the pump and the area around it. Can you see any oil residue, staining, or wetness?", "failureAnswer": "yes"}
  Question 2 (STAGING — old stain vs active leak):
  {"question": "Is the oil wet and fresh-looking (shiny, not covered in dust), or can you see oil that has run or dripped down from the source?", "failureAnswer": "yes"}
  Question 3 (FAILURE — actively leaking now):
  {"question": "With the engine running and idling for 2 minutes, can you see oil actively dripping or accumulating?", "failureAnswer": "yes", "mediaPrompt": "Close-up of the active leak while engine is running"}

Example for transmission shudder (tiers: MINOR=$400-$700 fluid flush, MODERATE=$1800-$3000 valve body, SEVERE=$4000-$6000 rebuild):
  Question 1 (DETECTION):
  {"question": "During a test drive at 35-55 mph with steady light throttle, does the transmission produce any shudder, vibration, or hesitation?", "failureAnswer": "yes"}
  Question 2 (STAGING — occasional vs persistent):
  {"question": "Does the shudder or harshness happen on MOST shifts, not just occasionally?", "failureAnswer": "yes"}
  Question 3 (FAILURE):
  {"question": "Does the transmission slip (RPMs flare without acceleration), fail to engage a gear, or go into limp mode at any point?", "failureAnswer": "yes"}

Example for ball joint wear (tiers: MINOR=$350-$500 both lowers, MODERATE=$600-$900 uppers+lowers, SEVERE=$1200-$1800 full rebuild):
  Question 1 (DETECTION):
  {"question": "Grab the tire at 12 and 6 o'clock and push/pull firmly. Do you feel any clunking or see movement at the ball joint?", "failureAnswer": "yes"}
  Question 2 (STAGING — boot condition indicates progression):
  {"question": "Look at the ball joint boot (the rubber cover). Is it torn, cracked, or leaking grease?", "failureAnswer": "yes"}
  Question 3 (FAILURE):
  {"question": "Can you see visible separation or looseness at the joint itself, or does the tire feel wobbly/unstable?", "failureAnswer": "yes", "mediaPrompt": "Close-up of the ball joint showing the boot and joint condition"}

Questions can test ANYTHING the inspector can observe: visual signs, sounds, feel, movement, temperature, smell, functional tests. Be specific about what to look for and what conditions reveal the answer (engine cold vs. warm, driving speed, etc.).

CATEGORIES (use exactly these values):
ENGINE, TRANSMISSION, DRIVETRAIN, STRUCTURAL, SUSPENSION, BRAKES, TIRES_WHEELS, ELECTRICAL, ELECTRONICS, SAFETY, COSMETIC_EXTERIOR, COSMETIC_INTERIOR, HVAC, OTHER

COMPONENT HINT — for 3D model hotspot placement:
"componentHint" must be a SHORT keyword (1-2 words, snake_case) identifying the specific vehicle sub-component. This places the hotspot dot on the correct location of the 3D vehicle model. Use these known keywords when applicable:

ENGINE zone: radiator, oil, coolant, alternator, exhaust_manifold, air_filter, turbo, fuel_system, hpop, water_pump, timing, valve_cover, intake
DRIVETRAIN zone: transmission, driveshaft, differential, axle_front, axle_rear, steering, cv_joint, transfer_case, u_joint
SUSPENSION zone: front_left, front_right, rear_left, rear_right, strut, control_arm, sway_bar, shock, ball_joint, tie_rod, wheel_bearing
BRAKES zone: front_left, front_right, rear_left, rear_right, parking, abs, caliper, rotor
ELECTRICAL zone: headlight_left, headlight_right, taillight_left, taillight_right, battery, alternator, fuse_box
COSMETIC_EXTERIOR zone: bumper, fender_left, fender_right, grille, hood, trunk, quarter_left, quarter_right, rocker_panel
COSMETIC_INTERIOR zone: dashboard, seats_front, seats_rear, headliner, carpet, console
STRUCTURAL zone: frame_front, frame_rear, frame_mid, rocker_panel, subframe

If no keyword fits exactly, use the closest match or a short descriptive term. This keyword does NOT appear in the UI — it only controls hotspot placement.`;

  const userPrompt = `Vehicle: ${vehicleDesc}

${nhtsaContext}

${curatedContext}

Generate the known-issues inspection checklist for this vehicle. For each known issue, return:
{
  "title": "Short specific title (e.g., '7.3L HPOP Oil Leak')",
  "description": "Concise but precise explanation of what EXACTLY goes wrong — the specific failure mechanism, affected subcomponent, conditions that trigger it, and typical mileage range. 1-3 sentences. NOT a generic summary — a technician-level explanation of the actual problem.",
  "category": "one of the CATEGORIES above",
  "severity": "CRITICAL | MAJOR | MODERATE | MINOR",
  "likelihood": "VERY_COMMON | COMMON | OCCASIONAL | RARE",
  "checkMethod": "visual | manual",
  "componentHint": "snake_case keyword for 3D hotspot placement (e.g., 'oil', 'ball_joint', 'differential')",
  "whatToCheck": "The specific component or system",
  "whatThisIs": "Plain-English explanation of what this component is. No jargon. 1-3 sentences for someone who has never worked on a car. What does it look like? What does it do? Why does it matter?",
  "howToLocate": "NUMBERED step-by-step wayfinding directions starting from a landmark (hood, wheel, door). Use visual references (color, shape, size comparisons). Guide them like you're on the phone with them.",
  "whereToLook": "PRECISE physical location — describe as if giving directions to someone standing at the vehicle. Include side of vehicle, reference nearby components, specify access method (from above, from below, behind X panel).",
  "howToInspect": "NUMBERED step-by-step procedure. Include what tools or conditions needed (engine cold/warm, vehicle on lift, etc.). Each step should be one clear action.",
  "signsOfFailure": ["specific observable sign 1", "sign 2", ...],
  "whyItMatters": "What happens if this is bad — consequence and context",
  "evidencePrompt": "Single specific photo instruction shown ONLY when the inspector detects a problem. What to photograph to document severity. Be specific about framing and what to capture.",
  "costTiers": [
    {"condition": "MINOR", "label": "Short description of minor scenario", "costLow": 150, "costHigh": 400},
    {"condition": "MODERATE", "label": "Short description of moderate scenario", "costLow": 400, "costHigh": 900},
    {"condition": "SEVERE", "label": "Short description of severe scenario", "costLow": 900, "costHigh": 2500}
  ],
  "estimatedCostLow": 150,
  "estimatedCostHigh": 2500,
  "capturePrompts": ["For AI vision analysis of standard photos (NOT shown to inspector). Describe what to look for in engine bay, undercarriage, etc. photos to detect this issue.", ...],
  "inspectionQuestions": [
    {"question": "REQUIRED for ALL risks. Graduated severity probes — order from least to most severe. Q1 detects any problem, Q2 escalates to MODERATE tier, Q3+ escalates to SEVERE tier. Include specific test conditions.", "failureAnswer": "yes or no", "mediaPrompt": "optional: what to photograph/record if failure detected"}
  ]
}

Return ONLY a JSON object with a "knownIssues" array. No markdown, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 12000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[generateKnownIssues] Empty response from OpenAI");
      return [];
    }

    const parsed = JSON.parse(content);
    const items: KnownIssueOutput[] = parsed.knownIssues || parsed.issues || parsed.items || [];

    // Validate structure
    const structureValid = items.filter(
      (item) =>
        item.title &&
        item.description &&
        item.category &&
        item.severity &&
        item.whatToCheck &&
        item.whereToLook &&
        item.howToInspect &&
        Array.isArray(item.signsOfFailure) &&
        item.whyItMatters
    );

    // Deduplicate: AI sometimes generates near-duplicate items for the same issue
    const validated: KnownIssueOutput[] = [];
    for (const item of structureValid) {
      const isDupe = validated.some((existing) =>
        existing.category === item.category && titlesSimilar(existing.title, item.title)
      );
      if (!isDupe) validated.push(item);
    }

    // Post-process: normalize costTiers, checkMethod, and assign IDs to inspection questions
    for (const item of validated) {
      // Coerce cost fields to numbers (AI sometimes returns strings)
      item.estimatedCostLow = Number(item.estimatedCostLow) || 0;
      item.estimatedCostHigh = Number(item.estimatedCostHigh) || 0;

      // Normalize costTiers — coerce numbers and ensure exactly 3 valid tiers
      const validConditions = new Set(["MINOR", "MODERATE", "SEVERE"]);
      if (Array.isArray(item.costTiers) && item.costTiers.length >= 3) {
        item.costTiers = item.costTiers
          .map((t) => ({
            ...t,
            costLow: Number(t.costLow) || 0,
            costHigh: Number(t.costHigh) || 0,
          }))
          .filter((t) => validConditions.has(t.condition) && t.label && t.costLow > 0 && t.costHigh > 0)
          .slice(0, 3) as CostTierOutput[];
      }
      // If costTiers are valid, derive the full range from them
      if (Array.isArray(item.costTiers) && item.costTiers.length === 3) {
        item.estimatedCostLow = Math.min(...item.costTiers.map((t) => t.costLow));
        item.estimatedCostHigh = Math.max(...item.costTiers.map((t) => t.costHigh));
      }
      // Fallback: if no valid tiers, create synthetic ones from the flat estimate
      if (!Array.isArray(item.costTiers) || item.costTiers.length < 3) {
        const low = item.estimatedCostLow || 100;
        const high = item.estimatedCostHigh || low * 2;
        const mid = Math.round((low + high) / 2);
        item.costTiers = [
          { condition: "MINOR", label: "Early stage, minor repair", costLow: low, costHigh: Math.round(low * 1.3) },
          { condition: "MODERATE", label: "Moderate repair needed", costLow: Math.round(mid * 0.8), costHigh: Math.round(mid * 1.2) },
          { condition: "SEVERE", label: "Full replacement or major repair", costLow: Math.round(high * 0.7), costHigh: high },
        ];
      }
      // Normalize checkMethod — AI may still return legacy "photo" or "both" values
      const rawCheckMethod = item.checkMethod as string;
      if (rawCheckMethod === "photo" || rawCheckMethod === "both") {
        item.checkMethod = "visual";
      }
      if (!item.checkMethod || !["visual", "manual"].includes(item.checkMethod)) {
        item.checkMethod = "visual";
      }
      // If no questions provided, fall back to "visual" — the UI will handle gracefully
      if (!Array.isArray(item.inspectionQuestions) || item.inspectionQuestions.length === 0) {
        item.checkMethod = "visual";
      }
      // Normalize and assign IDs to inspection questions
      if (Array.isArray(item.inspectionQuestions) && item.inspectionQuestions.length > 0) {
        item.inspectionQuestions = item.inspectionQuestions
          .filter((q) => q.question && (q.failureAnswer === "yes" || q.failureAnswer === "no"))
          .map((q, idx) => ({
            ...q,
            id: `q${idx}`,
            order: idx,
          })) as unknown as InspectionQuestionOutput[];
      }
      // Ensure evidencePrompt has a value — fall back to first capturePrompt
      if (!item.evidencePrompt && Array.isArray(item.capturePrompts) && item.capturePrompts.length > 0) {
        item.evidencePrompt = item.capturePrompts[0];
      }
      if (!item.evidencePrompt) {
        item.evidencePrompt = `Photograph the ${item.whatToCheck || item.title} — fill the frame so we can assess the severity`;
      }
    }

    return validated;
  } catch (err) {
    console.error("[generateKnownIssues] AI generation failed:", err);
    return [];
  }
}

function buildNHTSAContext(
  complaints: NHTSAComplaint[],
  recalls: NHTSARecall[],
  investigations: NHTSAInvestigation[]
): string {
  const parts: string[] = [];

  parts.push("=== NHTSA DATA (use as reference to inform your recommendations) ===");

  // Recalls
  if (recalls.length > 0) {
    parts.push(`\nACTIVE RECALLS (${recalls.length}):`);
    for (const r of recalls.slice(0, 10)) {
      parts.push(`- [${r.campaignNumber}] ${r.component}: ${r.summary}`);
    }
  }

  // Investigations
  if (investigations.length > 0) {
    parts.push(`\nFEDERAL INVESTIGATIONS (${investigations.length}):`);
    for (const inv of investigations.slice(0, 5)) {
      parts.push(`- [${inv.investigationId}] ${inv.component} (${inv.investigationStatus}): ${inv.summary || "No details"}`);
    }
  }

  // Complaint patterns — group by component, show counts + sample summaries
  if (complaints.length > 0) {
    const byComponent: Record<string, { count: number; samples: string[] }> = {};
    for (const c of complaints) {
      const comp = c.component || "UNKNOWN";
      if (!byComponent[comp]) byComponent[comp] = { count: 0, samples: [] };
      byComponent[comp].count++;
      if (byComponent[comp].samples.length < 2 && c.summary) {
        const truncated = c.summary.length > 200 ? c.summary.slice(0, 200) + "..." : c.summary;
        byComponent[comp].samples.push(truncated);
      }
    }

    parts.push(`\nOWNER COMPLAINT PATTERNS (${complaints.length} total):`);
    const sorted = Object.entries(byComponent).sort((a, b) => b[1].count - a[1].count);
    for (const [comp, data] of sorted.slice(0, 10)) {
      parts.push(`- ${comp}: ${data.count} complaints`);
      for (const s of data.samples) {
        parts.push(`  "${s}"`);
      }
    }
  }

  if (complaints.length === 0 && recalls.length === 0 && investigations.length === 0) {
    parts.push("(No NHTSA data available — rely on your expert knowledge of this platform)");
  }

  return parts.join("\n");
}

function buildCuratedContext(curatedRisks: CuratedRisk[]): string {
  if (curatedRisks.length === 0) return "";

  const parts: string[] = [];
  parts.push("=== CURATED KNOWN RISKS (verified — incorporate these into your checklist) ===");
  for (const r of curatedRisks) {
    parts.push(`- [${r.severity}] ${r.title}: ${r.description}`);
    if (r.symptoms.length > 0) {
      parts.push(`  Symptoms: ${r.symptoms.join(", ")}`);
    }
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
//  Post-generation filter: remove risks for components this vehicle doesn't have
// ---------------------------------------------------------------------------

interface VehicleConfigForFilter {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  bodyStyle?: string | null;
}

/**
 * Uses GPT-4o to review a generated risk list and filter out risks that reference
 * components this specific vehicle configuration does not have (e.g., rear window
 * regulators on an extended cab, power window issues on a truck with manual windows).
 *
 * Returns the filtered list. If the AI call fails, returns the original unfiltered list.
 */
export async function filterRisksByVehicleConfig(
  risks: KnownIssueOutput[],
  vehicle: VehicleConfigForFilter,
): Promise<KnownIssueOutput[]> {
  if (risks.length === 0) return risks;

  const openai = getOpenAI();

  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim,
    vehicle.engine ? `(${vehicle.engine})` : null,
    vehicle.transmission ? `${vehicle.transmission}` : null,
    vehicle.drivetrain,
    vehicle.bodyStyle,
  ].filter(Boolean).join(" ");

  // Build a lightweight summary of each risk for the AI to review
  const riskSummaries = risks.map((r, i) => ({
    index: i,
    title: r.title,
    category: r.category,
    componentHint: r.componentHint,
  }));

  const systemPrompt = `You are an expert vehicle technician reviewing a risk inspection checklist that was generated for a specific vehicle. Your job is to identify and REMOVE any risks that reference components this specific vehicle configuration does NOT have.

EXAMPLES OF WHAT TO REMOVE:
- Rear window regulator/motor risks on regular cab or extended cab trucks (they have FIXED rear windows that don't open — only crew/supercrew cabs have opening rear windows)
- Power window motor/regulator risks on vehicles with manual (hand-crank) windows
- Rear door lock/hinge risks on 2-door vehicles
- Sunroof/moonroof drain risks on vehicles without a sunroof
- Third-row seat risks on vehicles without a third row
- Turbo/supercharger risks on naturally-aspirated engines
- 4WD/AWD transfer case risks on 2WD vehicles
- DPF/DEF/urea risks on gasoline engines

IMPORTANT:
- When in doubt, KEEP the risk. Only remove risks you are CERTAIN don't apply.
- Use the trim name and body style to infer the vehicle's configuration.
- Extended cab trucks (SuperCab, King Cab, Access Cab, etc.) typically have fixed rear windows and small rear access doors that may not have power window motors.
- Base/XL/XLT trims from the early-to-mid 2000s often have manual windows and locks.

Return a JSON object: { "keepIndices": [0, 1, 3, ...], "removedExplanations": [{"index": 2, "reason": "..."}] }
"keepIndices" should list the indices of risks to KEEP. "removedExplanations" explains why each removed risk was filtered.`;

  const userPrompt = `Vehicle: ${vehicleDesc}

Risk checklist to review:
${JSON.stringify(riskSummaries, null, 2)}

Which risks should be KEPT for this specific vehicle? Return the indices to keep.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[filterRisksByVehicleConfig] Empty response — returning unfiltered");
      return risks;
    }

    const parsed = JSON.parse(content);
    const rawKeep = parsed.keepIndices || parsed.keep_indices || [];
    const removed = parsed.removedExplanations || parsed.removed || [];

    // Validate indices are numbers within bounds
    const keepIndices: number[] = rawKeep
      .filter((i: unknown) => typeof i === "number" && i >= 0 && i < risks.length);

    if (keepIndices.length === 0) {
      console.warn("[filterRisksByVehicleConfig] AI returned no valid keepIndices — returning unfiltered");
      return risks;
    }

    // Log what was filtered for debugging
    if (removed.length > 0) {
      console.log(`[filterRisksByVehicleConfig] Filtered ${removed.length} risks for ${vehicleDesc}:`);
      for (const r of removed) {
        console.log(`  - Removed "${risks[r.index]?.title}": ${r.reason}`);
      }
    }

    // Return only the kept risks
    const keepSet = new Set(keepIndices);
    return risks.filter((_, i) => keepSet.has(i));
  } catch (err) {
    console.error("[filterRisksByVehicleConfig] Failed — returning unfiltered:", err);
    return risks;
  }
}

/** Check if two risk titles are similar enough to be duplicates */
function titlesSimilar(a: string, b: string): boolean {
  const stopWords = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "with", "from", "issue", "issues", "problem", "problems", "failure"]);
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 1 && !stopWords.has(w));

  const wordsA = normalize(a);
  const wordsB = new Set(normalize(b));
  if (wordsA.length === 0 || wordsB.size === 0) return false;

  const overlap = wordsA.filter((w) => wordsB.has(w)).length;
  const minLen = Math.min(wordsA.length, wordsB.size);
  return minLen > 0 && overlap / minLen >= 0.6;
}
