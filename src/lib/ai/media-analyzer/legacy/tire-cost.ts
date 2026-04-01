/**
 * Tire replacement cost estimation using GPT-4o.
 * Moved from original media-analyzer.ts without changes.
 */

import { getOpenAI } from "@/lib/openai";
import type { VehicleInfo } from "../types";

/**
 * Estimates tire replacement cost for a specific vehicle using GPT-4o.
 * Returns cost in cents for the number of tires that need replacing.
 *
 * Cost: ~$0.005 per call.
 */
export async function estimateTireReplacementCost(
  vehicle: VehicleInfo,
  tiresNeeded: number,
): Promise<{ costCents: number; perTireCents: number; reasoning: string } | null> {
  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You estimate tire replacement costs for used car dealers. Include mid-range replacement tires (not cheapest, not premium) plus mounting, balancing, and disposal fees. Account for vehicle type: trucks/SUVs use larger, more expensive tires than sedans. Be specific to the exact vehicle — look up the OEM tire size for this year/make/model and price accordingly.`,
        },
        {
          role: "user",
          content: `How much would it cost to replace ${tiresNeeded} tire${tiresNeeded > 1 ? "s" : ""} on a ${vehicle.year} ${vehicle.make} ${vehicle.model}? Include mounting, balancing, and disposal. Use mid-range tire pricing (what a dealer would use for reconditioning, not budget or premium).

Return JSON: { "perTireCents": <cost per tire in cents including install>, "totalCents": <total for ${tiresNeeded} tires in cents>, "reasoning": "<1 sentence explaining the estimate>" }`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    let perTire = Number(parsed.perTireCents) || 0;
    let total = Number(parsed.totalCents) || 0;

    // Detect dollars vs cents (if total < 500 for multiple tires, likely in dollars)
    if (total > 0 && total < 500 * tiresNeeded) {
      perTire = perTire * 100;
      total = total * 100;
    }

    // Sanity bounds: $80-$400 per tire
    perTire = Math.max(8000, Math.min(40000, perTire));
    total = perTire * tiresNeeded;

    return {
      costCents: total,
      perTireCents: perTire,
      reasoning: String(
        parsed.reasoning ||
          `${tiresNeeded} tire replacement for ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      ),
    };
  } catch (err) {
    console.error("[estimateTireReplacementCost] Failed:", err);
    return null;
  }
}
