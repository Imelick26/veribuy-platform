/**
 * Angle-specific prompt: Undercarriage
 * Phase 1 checklist for the undercarriage photo.
 */

import type { VehicleInfo } from "../../types";

export function buildUndercarriageChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `UNDERCARRIAGE — Inspect the underside of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. Undercarriage photos have limited visibility, so flag what you can clearly see.

FLUID LEAKS:
1. Oil leaks — dark wet areas or drip trails on engine oil pan, transmission pan, differential, or transfer case
2. Coolant leaks — green, orange, or pink wet areas near hoses, water pump, or radiator
3. Transmission fluid leaks — red or dark red wet areas around transmission pan, lines, or cooler
4. Wet vs dry leaks — active dripping is worse than dried staining; note which type you see

FRAME & STRUCTURE:
5. Frame rail rust — distinguish between surface scale (cosmetic) and structural rust (deep, flaking, compromising metal integrity)
6. Rust scaling — flaking rust indicates advanced corrosion that is actively deteriorating the metal
7. Frame damage — bends, kinks, or repair welds on frame rails or crossmembers (collision evidence)

EXHAUST:
8. Exhaust pipe rust or deterioration along the full visible length
9. Exhaust rust-through — actual holes in exhaust pipes, muffler, or catalytic converter heat shield
10. Hanging or loose exhaust components — failed hangers, sagging sections, zip-tie repairs
11. Exhaust tip condition — heavy rust, dents, or missing tips

IMPACT & PANELS:
12. Impact damage — scrapes, bends, or gouges from bottoming out or road debris strikes
13. Missing splash shields or undertray panels — exposed components that should be protected`;
}
