/**
 * Angle-specific prompt: Tire Detail
 * Phase 1 checklist for individual tire/wheel photos.
 *
 * Forces per-zone tread analysis (inner/center/outer) so the model
 * can't make a holistic "looks fine" judgment. Works for any tire type.
 */

import type { VehicleInfo } from "../../types";

export function buildTireDetailChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
  position: string,
): string {
  const positionLabel = position.replace("-", " ");

  return `TIRE & WHEEL DETAIL (${positionLabel.toUpperCase()}) — ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

TREAD ANALYSIS — You MUST analyze the tread in three zones and provide a separate rating for each BEFORE giving an overall classification.

Your response MUST include a "treadAnalysis" object with per-zone ratings:

"treadAnalysis": {
  "innerEdge": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "center": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "outerEdge": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "overall": "GOOD|WORN|REPLACE"
}

HOW TO EXAMINE EACH ZONE:
- INNER EDGE (ribs closest to the vehicle body): Are the innermost grooves deep or worn smooth?
- CENTER (middle ribs of the tread face): COMPARE the center groove depth to the edge groove depth. If the center grooves are shallower than the edges, the center is wearing faster.
- OUTER EDGE (ribs farthest from vehicle): Are the outermost grooves deep or worn smooth?

GROOVE DEPTH — compare groove depth to tread block height:
- "deep": Grooves are clearly visible channels with significant depth. You can see deep shadows in the grooves. Tread blocks stand well above the groove floor. This tire has LOTS of rubber remaining.
- "shallow": Grooves exist but are noticeably worn down. Tread blocks are low. The tire looks "used" but grooves are still clearly present. Less than half the original depth remains.
- "flush": Surface appears smooth or nearly flat. Grooves are barely visible or gone. The tire surface looks like it's been sanded down. You cannot easily distinguish tread blocks from grooves. Wear bars (the small raised bridges between grooves) are level with or nearly level with the tread surface.
- "bald": Flat smooth rubber. The tire contact surface is essentially a smooth band. No groove structure whatsoever.

CRITICAL — HOW TO TELL "GOOD" FROM "WORN" AND "REPLACE":
A GOOD tire has DEEP, clearly visible grooves that cast shadows. The tread pattern is prominently 3-dimensional. If the tire surface looks even SOMEWHAT flat, smooth, or the grooves look shallow — it is NOT "GOOD." A tire that is "okay" or "decent" or "still has some tread" is WORN, not GOOD.

MILEAGE CONTEXT: This vehicle has ${mileageStr}. Tires typically last 40,000-60,000 miles. If this vehicle has over 40,000 miles on the odometer and the tires appear to be original (matching the vehicle's age), they are almost certainly WORN or REPLACE, not GOOD. Factor this into your assessment.

KEY TEST — compare zones against each other:
- If ANY zone's grooves are less than HALF the depth of another zone's grooves, the shallower zone is "flush" → REPLACE.
- If ANY zone's surface appears flat or smooth while another zone still has deep channels, the flat zone is "flush" → REPLACE.
- This applies regardless of tire type — all-terrain, highway, performance, winter, or any other tread pattern.

CLASSIFICATION RULES:
- The OVERALL rating equals the WORST zone. If one zone is REPLACE but the others are GOOD, overall = REPLACE.
- GOOD: All three zones have deep, prominent grooves with clear 3D tread pattern. The tire looks nearly new. This should be RARE on a used vehicle.
- WORN: Any zone has shallow grooves (3-6/32") but none are flush/bald. Tread is visibly reduced but still present.
- REPLACE: Any zone is flush or bald (<3/32"), OR wear bars are visible/level with tread, OR any smooth/bald patches exist, OR the tire surface looks flat/smooth in any zone.

ALSO CHECK:
1. Uneven wear pattern — center wear = overinflation, inner edge = alignment, outer edge = underinflation, cupping = suspension
2. Sidewall cracks or dry rot
3. Tire bulges (SAFETY HAZARD)
4. Sidewall scuffs from curb contact
5. Wheel curb rash, scratches, corrosion
6. Bent or cracked rim
7. Missing lug nuts
8. Tire brand, model, size (read from sidewall if visible)
9. DOT date code (tires over 6 years old are a concern regardless of tread)

CRITICAL — CONSERVATIVE BIAS FOR DEALER USE:
This is a dealer acquisition tool. Dealers need worst-case tire cost, not best-case. Err on the side of flagging tires for replacement. A dealer would rather over-budget for tires and be pleasantly surprised than miss a bad tire.
- "GOOD" should be RARE on used vehicles — most used car tires are at least WORN. Only rate GOOD if the tread is clearly deep and prominent with obvious 3D pattern.
- When uncertain between GOOD and WORN → choose WORN
- When uncertain between WORN and REPLACE → choose REPLACE
- If tread looks "okay but low" or "still has some tread" → WORN or REPLACE, never GOOD
- Dry rot, any sidewall cracking, or tires over 6 years old → REPLACE regardless of tread depth
- A high-mileage vehicle (80K+) with what appear to be original tires → almost certainly WORN or REPLACE`;
}
