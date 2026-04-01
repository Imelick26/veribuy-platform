/**
 * Angle-specific prompt: Truck Bed
 * Phase 1 checklist for the truck bed / cargo photo on pickup trucks.
 */

import type { VehicleInfo } from "../../types";

export function buildTruckBedChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `TRUCK BED — Inspect the truck bed of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. A beat-up truck bed with a clean exterior suggests the vehicle was a work truck.

BED LINER:
1. Bed liner condition — spray-in liner: worn through, cracked, peeling, or separating from the bed surface; drop-in liner: cracked, loose fitting, trapping moisture underneath
2. Missing bed liner — exposed bare metal on the bed floor (rust risk)

BED FLOOR:
3. Bed floor scratches and gouges — assess depth and severity; deep gouges through any coating to bare metal
4. Bed floor dents — depressions from heavy loads or dropped objects

RUST:
5. Rust in the bed — check under liner edges, around drain holes, at the tailgate hinge area, and along bed rail corners

TAILGATE & WALLS:
6. Tailgate interior surface damage — dents, scratches, scrapes from loading and unloading
7. Wheel well dents inside the bed — inward dents from shifting cargo or side impacts
8. Bed rail damage — cap dents, scratches, or crushing on the top edges of the bed sides

HARDWARE:
9. Tie-down cleats and anchor points — damaged, bent, or missing hardware

USE INDICATORS:
10. Signs of heavy commercial use — extensive scratching, deep gouging, chemical staining, or welding burns indicating the truck was a work vehicle`;
}
