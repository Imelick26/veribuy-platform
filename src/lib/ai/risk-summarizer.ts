import { getOpenAI } from "@/lib/openai";
import type { AggregatedRisk, NHTSAComplaint } from "@/types/risk";

interface EnrichedRiskOutput {
  riskId: string;
  aiTitle: string;
  aiSummary: string;
  aiSymptoms: string[];
  aiCapturePrompts: string[];
}

/**
 * Sends aggregated risks + raw complaint data to GPT-4o-mini.
 * Returns AI-enriched risk summaries with specific, actionable details
 * and targeted capture prompts for each risk.
 *
 * Cost: ~$0.01-0.02 per call (GPT-4o-mini).
 */
export async function summarizeRisks(
  vehicle: { year: number; make: string; model: string; engine?: string | null; trim?: string | null },
  risks: AggregatedRisk[],
  complaints: NHTSAComplaint[]
): Promise<EnrichedRiskOutput[]> {
  if (risks.length === 0) return [];

  const openai = getOpenAI();

  // Build complaint context — take top summaries per category for the AI
  const complaintContext = buildComplaintContext(complaints, risks);

  const systemPrompt = `You are a master automotive technician and vehicle inspection expert with 20+ years of experience. You have deep knowledge of specific failure modes, TSBs, and common problems for every make/model.

Your job: Given NHTSA complaint data and risk items for a specific vehicle, rewrite each risk with SPECIFIC, ACTIONABLE details that a field inspector can use. Replace generic descriptions with exact failure modes, part numbers when known, mileage ranges, and precise inspection instructions.

RULES:
- Be extremely specific. Instead of "Engine complaints", say "3.5L EcoBoost: known oil pan gasket leak at 40-80k miles. Check for oil residue on engine underside."
- Reference specific model years, engines, transmissions when applicable
- Include mileage ranges where failures typically occur
- Mention any known TSBs (Technical Service Bulletins) you know about
- Each capture prompt should describe exactly what photo to take and what to look for
- Symptoms should be specific observable signs, not generic terms
- Keep summaries concise but packed with actionable detail (2-4 sentences max)`;

  const userPrompt = `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}${vehicle.engine ? ` (${vehicle.engine})` : ""}

RISK ITEMS TO ENRICH:
${risks.map((r, i) => `
[${i}] id: "${r.id}"
    title: "${r.title}"
    category: ${r.category}
    severity: ${r.severity}
    description: "${r.description}"
    complaint_count: ${r.complaintCount || 0}
    has_recall: ${r.hasActiveRecall || false}
    current_symptoms: ${JSON.stringify(r.symptoms)}
`).join("")}

NHTSA COMPLAINT SUMMARIES (sample):
${complaintContext}

Respond with a JSON array. Each element must have:
{
  "riskId": "the exact id from above",
  "aiTitle": "specific rewritten title",
  "aiSummary": "2-4 sentence specific description with failure modes, mileage ranges, part details",
  "aiSymptoms": ["specific observable symptom 1", "symptom 2", ...],
  "aiCapturePrompts": ["Photograph the [specific area] looking for [specific sign]", ...]
}

Return ONLY the JSON array, no markdown or explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[risk-summarizer] Empty response from OpenAI");
      return [];
    }

    const parsed = JSON.parse(content);
    // Handle both { risks: [...] } and direct array formats
    const results: EnrichedRiskOutput[] = Array.isArray(parsed) ? parsed : (parsed.risks || parsed.items || []);

    // Validate structure
    return results.filter(
      (r) =>
        r.riskId &&
        r.aiTitle &&
        r.aiSummary &&
        Array.isArray(r.aiSymptoms) &&
        Array.isArray(r.aiCapturePrompts)
    );
  } catch (err) {
    console.error("[risk-summarizer] AI summarization failed:", err);
    return [];
  }
}

/**
 * Builds a compact complaint context string for the AI prompt.
 * Takes the most informative complaint summaries grouped by risk category.
 */
function buildComplaintContext(
  complaints: NHTSAComplaint[],
  risks: AggregatedRisk[]
): string {
  if (complaints.length === 0) return "(No NHTSA complaints available)";

  const riskCategories = new Set(risks.map((r) => r.category));
  const parts: string[] = [];

  // Group complaints by their mapped component
  const byComponent: Record<string, NHTSAComplaint[]> = {};
  for (const c of complaints) {
    const comp = c.component || "UNKNOWN";
    if (!byComponent[comp]) byComponent[comp] = [];
    byComponent[comp].push(c);
  }

  // For each component group, take the 3 most recent + most detailed summaries
  for (const [component, comps] of Object.entries(byComponent)) {
    // Sort by date (most recent first), then by summary length (most detail first)
    const sorted = [...comps].sort((a, b) => {
      const dateComp = (b.dateComplaintFiled || "").localeCompare(a.dateComplaintFiled || "");
      if (dateComp !== 0) return dateComp;
      return (b.summary?.length || 0) - (a.summary?.length || 0);
    });

    const top = sorted.slice(0, 3);
    for (const c of top) {
      if (c.summary) {
        // Truncate very long summaries
        const summary = c.summary.length > 300 ? c.summary.slice(0, 300) + "..." : c.summary;
        parts.push(`[${component}] ${summary}`);
      }
    }
  }

  // Limit total context to avoid token waste
  return parts.slice(0, 20).join("\n\n");
}
