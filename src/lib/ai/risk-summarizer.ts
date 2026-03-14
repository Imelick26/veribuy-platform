import { getOpenAI } from "@/lib/openai";
import type { NHTSAComplaint, NHTSARecall, NHTSAInvestigation, Likelihood } from "@/types/risk";

interface KnownIssueOutput {
  title: string;
  category: string;
  severity: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR";
  likelihood: Likelihood;
  whatToCheck: string;
  whereToLook: string;
  howToInspect: string;
  signsOfFailure: string[];
  whyItMatters: string;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  capturePrompts: string[];
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

  const systemPrompt = `You are a master automotive technician and pre-purchase inspection expert with 20+ years of hands-on experience across all makes and models. You specialize in identifying known weak points, common failure modes, and platform-specific issues that separate good examples from money pits.

Your job: Given a specific vehicle, generate the definitive PRE-PURCHASE INSPECTION CHECKLIST of known issues. These are the exact things an experienced mechanic would check if a customer brought this vehicle in before buying it.

RULES:
- Be EXTREMELY specific to this exact vehicle platform, engine, and transmission. Not generic car advice.
- Reference specific part names, locations on the vehicle, TSBs, and failure mileage ranges when known.
- Each item should tell the inspector exactly WHERE to look, HOW to check, and WHAT failure looks like.
- Include both visual inspection items AND hands-on/test-drive checks.
- Cover the vehicle's known weak points comprehensively: engine, transmission, drivetrain, frame/structure, electrical, suspension, brakes, and any model-specific quirks.
- Severity reflects consequence of the issue (CRITICAL = safety or engine/trans failure, MAJOR = expensive repair, MODERATE = notable repair, MINOR = wear item or cosmetic).
- Likelihood reflects how common this issue actually is on this platform.
- Cost estimates should be realistic repair costs in US dollars.
- Generate 8-15 items — thorough but not padded with generic filler.
- capturePrompts should describe exactly what photo to take for documentation.

DO NOT INCLUDE generic items that any dealer can spot in seconds. The following are handled separately via photo/video capture and should NEVER appear in your checklist:
- Tire condition, tread depth, tire wear
- Windshield or glass cracks, chips, damage
- Large dents, body damage, paint condition
- Dashboard warning lights or check engine lights
- Fluid levels (oil, coolant, brake fluid)
- Brake pad thickness (unless this platform has a SPECIFIC known brake issue)
Focus ONLY on platform-specific known failure points that require expert knowledge of this vehicle.

CATEGORIES (use exactly these values):
ENGINE, TRANSMISSION, DRIVETRAIN, STRUCTURAL, SUSPENSION, BRAKES, TIRES_WHEELS, ELECTRICAL, ELECTRONICS, SAFETY, COSMETIC_EXTERIOR, COSMETIC_INTERIOR, HVAC, OTHER`;

  const userPrompt = `Vehicle: ${vehicleDesc}

${nhtsaContext}

${curatedContext}

Generate the known-issues inspection checklist for this vehicle. For each known issue, return:
{
  "title": "Short specific title (e.g., '7.3L HPOP Oil Leak')",
  "category": "one of the CATEGORIES above",
  "severity": "CRITICAL | MAJOR | MODERATE | MINOR",
  "likelihood": "VERY_COMMON | COMMON | OCCASIONAL | RARE",
  "whatToCheck": "The specific component or system",
  "whereToLook": "Exact location on the vehicle",
  "howToInspect": "Step-by-step instructions for checking this item",
  "signsOfFailure": ["specific observable sign 1", "sign 2", ...],
  "whyItMatters": "What happens if this is bad — consequence and context",
  "estimatedCostLow": cost_in_dollars_low,
  "estimatedCostHigh": cost_in_dollars_high,
  "capturePrompts": ["Photograph [specific area] showing [specific detail]", ...]
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
      max_tokens: 6000,
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
    return items.filter(
      (item) =>
        item.title &&
        item.category &&
        item.severity &&
        item.whatToCheck &&
        item.whereToLook &&
        item.howToInspect &&
        Array.isArray(item.signsOfFailure) &&
        item.whyItMatters
    );
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
