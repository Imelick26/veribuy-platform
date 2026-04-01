/**
 * Angle-specific prompt: Rear Center
 * Phase 1 checklist for the straight-on rear photo.
 */

import type { VehicleInfo } from "../../types";

export function buildRearCenterChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  const isTruck =
    vehicle.bodyStyle &&
    /truck|pickup|cab/i.test(vehicle.bodyStyle);
  const make = vehicle.make.toLowerCase();
  const model = vehicle.model.toLowerCase();
  const likelyTruck =
    isTruck ||
    /f-?150|f-?250|f-?350|silverado|sierra|ram|tundra|titan|tacoma|ranger|colorado|canyon|frontier|gladiator|ridgeline|maverick/i.test(
      model,
    );

  const hitchItem = likelyTruck
    ? `11. Hitch receiver — rust or corrosion on the receiver tube, bent or deformed opening, ball mount wear marks, wiring harness plug condition, signs of heavy towing use (gouges, scrapes on the hitch step area)`
    : `11. Hitch receiver — if equipped, check for rust, damage, and signs of heavy towing use; if none present, note absence`;

  return `REAR CENTER VIEW — Inspect the rear of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Be specific about location (e.g., "rear bumper center below the license plate" not just "bumper"). Dirty or dusty surfaces are NOT defects — only flag actual damage, wear, or component issues. Dents show as light/shadow distortions on reflective surfaces; examine panel highlights carefully.

1. Rear bumper — scratches, scuffs, cracks, or sagging brackets; note any paint color or texture mismatch versus the adjacent body panels
2. Taillights — cracked or chipped lenses, moisture or condensation inside the housing, faded or discolored lens, aftermarket replacement that does not match the other side
3. Tailgate or trunk lid — dents, scratches, creases, or rust; check alignment with the body (even gaps on both sides)
4. Tailgate/trunk handle and latch — cracked, loose, or damaged; check for key cylinder damage
5. Exhaust tips — heavy rust, corrosion, dents or bends, black soot buildup suggesting running rich, aftermarket tips misaligned
6. Rear license plate — present and readable, mounting bracket damage, light housing cracked or non-functional
7. Rear badges and emblems — missing, damaged, crooked, aftermarket, or evidence of debadging (adhesive residue, filled holes)
8. Rear bumper-to-body fitment — uneven gaps or panel misalignment on either side indicating prior impact or repair
9. Rear wiper (if equipped) — torn blade, bent arm, motor housing damage
10. Rear window — chips, cracks, defroster line damage, third brake light condition
${hitchItem}`;
}
