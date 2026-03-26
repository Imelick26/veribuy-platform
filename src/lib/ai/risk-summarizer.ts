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
  checkMethod: "photo" | "manual" | "both";
  componentHint: string;
  whatToCheck: string;
  whereToLook: string;
  howToInspect: string;
  signsOfFailure: string[];
  whyItMatters: string;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  costTiers: CostTierOutput[];
  capturePrompts: string[];
  inspectionQuestions?: InspectionQuestionOutput[];
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

ISSUE DESCRIPTIONS — BE PRECISE ABOUT THE ACTUAL PROBLEM:
The "description" field must explain EXACTLY what goes wrong, not just name the component. The inspector and the buyer need to understand the specific failure mechanism.
BAD: "Transmission downshifting issues"
GOOD: "The Allison 10L1000 TCM hunts between 8th and 6th gear under light throttle at 40-55 mph due to a calibration issue in early software versions, causing harsh repeated downshifts and a noticeable lurch"
BAD: "Engine oil leak"
GOOD: "The HPOP (High Pressure Oil Pump) develops leaks at the base O-ring seal and the discharge fitting, typically after 150k miles, causing oil to pool on top of the engine valley under the turbo pedestal"
Include the root cause, the specific behavior/symptom, affected speed/RPM/mileage ranges, and the specific part or subcomponent that fails.

COST ESTIMATES — TIERED BY SEVERITY:
For each issue, provide 3 cost tiers representing MINOR, MODERATE, and SEVERE versions of the problem. This allows cost estimates to narrow once the actual condition is inspected.
- Labor rate: $150/hr average for independent shops. Use higher for specialty (diesel, European).
- Each tier's HIGH should be no more than 2x its LOW. Keep per-tier ranges tight.
- Do NOT lowball. Real-world independent shop prices including parts + labor.
- The 3 tiers should cover the realistic spectrum of how bad this issue could be.

"costTiers" must contain exactly 3 entries:
1. MINOR — Early stage / minimal impact. Cheapest fix (e.g., monitoring, minor repair, preventive maintenance).
2. MODERATE — Moderate damage requiring notable repair (e.g., partial replacement, section repair).
3. SEVERE — Worst case requiring major repair or full replacement.

Each tier needs a short "label" describing that specific scenario.

Example for frame corrosion:
  [
    {"condition": "MINOR", "label": "Surface rust, no structural impact", "costLow": 300, "costHigh": 600},
    {"condition": "MODERATE", "label": "Section corrosion requiring welding", "costLow": 2500, "costHigh": 4000},
    {"condition": "SEVERE", "label": "Structural compromise, frame section replacement", "costLow": 5000, "costHigh": 8000}
  ]

Example for ball joint wear (4WD):
  [
    {"condition": "MINOR", "label": "Early play, boot intact", "costLow": 150, "costHigh": 250},
    {"condition": "MODERATE", "label": "Noticeable play, boot cracked", "costLow": 400, "costHigh": 600},
    {"condition": "SEVERE", "label": "Excessive play, unsafe to drive", "costLow": 600, "costHigh": 900}
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

CHECK METHOD — CRITICAL DECISION FOR EACH ISSUE:
For each issue, you MUST decide how it should be inspected by setting "checkMethod":
- "photo" — DEFAULT. The issue CAN be detected or documented by taking a photograph of the affected area (e.g., oil leaks, rust, corrosion, worn bushings, cracked hoses, fluid residue, damaged components). The inspector takes a photo and AI vision analyzes it. For these, "capturePrompts" must describe exactly what to photograph. Do NOT include "inspectionQuestions".
- "manual" — ONLY use when photos genuinely cannot capture the issue and it requires hands-on physical testing (e.g., steering play, transmission slip under load, engine knock sound, brake pulsation feel, A/C cooling output). For these, include 2-5 YES/NO "inspectionQuestions". Do NOT include "capturePrompts".
- "both" — The issue benefits from BOTH a photo AND hands-on checks (e.g., ball joints — photograph for visual wear AND test for play by rocking the wheel). Include both "capturePrompts" and "inspectionQuestions".

IMPORTANT: Default to "photo" whenever possible. Photo capture is the core of this tool. Only use "manual" when the issue truly cannot be seen in a photograph (sounds, vibrations, temperature, feel, functional tests). Most issues (70%+) should be "photo" or "both".

INSPECTION QUESTIONS (for "manual" and "both" check methods):
Each question must be a precise, hands-on check the inspector performs at the vehicle. Must be answerable with "yes" or "no". Set "failureAnswer" to whichever answer indicates a PROBLEM. Optionally include "mediaPrompt" for what to photograph/record if failure is detected.

CRITICAL — QUESTIONS MUST BE GRADUATED TO DETERMINE COST TIER:
The questions are used to narrow the repair cost estimate. The number of "failure" answers maps to cost tiers:
- 0 failures → MINOR tier (cheapest repair)
- 1 failure → MODERATE tier (mid-range repair)
- 2+ failures → SEVERE tier (most expensive repair)

Therefore, ORDER your questions from LEAST SEVERE indicator to MOST SEVERE indicator. The first question should detect if ANY problem exists. The second should detect if it's MODERATE or worse. Additional questions should confirm SEVERE status.

Example for steering column play (tiers: MINOR=$200-$300 adjustment, MODERATE=$400-$700 intermediate shaft, SEVERE=$800-$1200 full column replacement):
  Question 1 (detects any problem):
  {"question": "Turn the steering wheel left and right with the engine off. Is there more than 1/4 inch of free play before the wheels start to turn?", "failureAnswer": "yes", "mediaPrompt": "Record the steering wheel play showing how far it moves before the wheels respond"}
  Question 2 (escalates to MODERATE — intermediate shaft worn):
  {"question": "While turning the steering wheel slowly, do you hear or feel a clunk/pop from behind the dashboard or at the firewall?", "failureAnswer": "yes"}
  Question 3 (escalates to SEVERE — full column):
  {"question": "Does the steering wheel physically wobble or shift on its shaft when pulled up/down or side to side?", "failureAnswer": "yes", "mediaPrompt": "Record the steering column wobble showing the shaft movement"}

Example for transmission shudder (tiers: MINOR=$300-$500 fluid flush, MODERATE=$1500-$2500 valve body, SEVERE=$3500-$5500 rebuild):
  Question 1 (detects any problem):
  {"question": "During a test drive, accelerate gently from 35 to 55 mph and hold steady throttle. Does the transmission produce a noticeable shudder or vibration?", "failureAnswer": "yes"}
  Question 2 (escalates to MODERATE):
  {"question": "When accelerating from a stop, does the transmission slip (RPMs rise without matching acceleration) or shift harshly with a jolt?", "failureAnswer": "yes", "mediaPrompt": "Record a video of the tachometer during 0-40 mph acceleration showing RPM behavior"}
  Question 3 (escalates to SEVERE):
  {"question": "Does the transmission fail to engage a gear, get stuck in one gear, or go into limp mode at any point during the test drive?", "failureAnswer": "yes"}

Questions should test things photos CANNOT capture: sounds, feel, movement, temperature, smell, function tests, etc. Be specific about conditions (speed, RPM, temperature, load) needed to reproduce the issue.

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
  "checkMethod": "photo | manual | both",
  "componentHint": "snake_case keyword for 3D hotspot placement (e.g., 'oil', 'ball_joint', 'differential')",
  "whatToCheck": "The specific component or system",
  "whereToLook": "PRECISE physical location — describe as if giving directions to someone standing at the vehicle. Include side of vehicle, reference nearby components, specify access method (from above, from below, behind X panel).",
  "howToInspect": "NUMBERED step-by-step procedure. Include what tools or conditions needed (engine cold/warm, vehicle on lift, etc.). Each step should be one clear action.",
  "signsOfFailure": ["specific observable sign 1", "sign 2", ...],
  "whyItMatters": "What happens if this is bad — consequence and context",
  "costTiers": [
    {"condition": "MINOR", "label": "Short description of minor scenario", "costLow": 150, "costHigh": 400},
    {"condition": "MODERATE", "label": "Short description of moderate scenario", "costLow": 400, "costHigh": 900},
    {"condition": "SEVERE", "label": "Short description of severe scenario", "costLow": 900, "costHigh": 2500}
  ],
  "estimatedCostLow": 150,
  "estimatedCostHigh": 2500,
  "capturePrompts": ["Each prompt must capture evidence that reveals severity — include at least one close-up for depth/condition and one wider shot for spread/scope. Specify camera angle, framing, and what visual indicators distinguish MINOR from SEVERE", ...],
  "inspectionQuestions": [
    {"question": "Graduated severity probes — order from least to most severe. Q1 detects any problem, Q2 escalates to MODERATE tier, Q3+ escalates to SEVERE tier. Include specific test conditions.", "failureAnswer": "yes or no", "mediaPrompt": "optional: what to photograph/record if failure detected"}
  ]
}

Return ONLY a JSON object with a "knownIssues" array. No markdown, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    const validated = items.filter(
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
      // Default checkMethod to "photo" if not specified or invalid
      if (!item.checkMethod || !["photo", "manual", "both"].includes(item.checkMethod)) {
        item.checkMethod = "photo";
      }
      // If manual/both but no questions, downgrade to photo
      if ((item.checkMethod === "manual" || item.checkMethod === "both") &&
          (!Array.isArray(item.inspectionQuestions) || item.inspectionQuestions.length === 0)) {
        item.checkMethod = "photo";
      }
      if (Array.isArray(item.inspectionQuestions) && item.inspectionQuestions.length > 0) {
        item.inspectionQuestions = item.inspectionQuestions
          .filter((q) => q.question && (q.failureAnswer === "yes" || q.failureAnswer === "no"))
          .map((q, idx) => ({
            ...q,
            id: `q${idx}`,
            order: idx,
          })) as unknown as InspectionQuestionOutput[];
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
