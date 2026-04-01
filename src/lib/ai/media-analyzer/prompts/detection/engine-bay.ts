/**
 * Angle-specific prompt: Engine Bay
 * Phase 1 checklist for the engine bay photo.
 */

import type { VehicleInfo } from "../../types";

export function buildEngineBayChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `ENGINE BAY — Inspect the engine bay of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. A dusty engine bay is NOT a defect. Only flag actual damage, leaks, corrosion, or component issues.

FLUIDS & RESIDUE:
1. Oil residue or staining on engine surfaces (valve cover, block, oil pan area) — dark brown/black deposits
2. Coolant residue (green, orange, or pink dried deposits near hoses, radiator, water pump, overflow tank)
3. Other fluid leaks (power steering fluid around pump/reservoir, brake fluid near master cylinder, washer fluid around reservoir/lines)
4. Sludge buildup — thick oily deposits on engine surfaces indicating poor maintenance history

BATTERY:
5. Battery terminal corrosion (white or green crusty buildup on positive/negative terminals or cable ends)

BELTS & HOSES:
6. Belt condition — visible cracking, glazing (shiny surface), or fraying on serpentine/accessory belts
7. Hose condition — swelling, cracking, or soft/mushy appearance on coolant hoses, vacuum lines

COMPONENTS:
8. Missing engine covers or caps (oil fill cap, coolant cap, brake fluid cap, fuse box cover)
9. Loose or disconnected components (hoses, wiring harness connectors, brackets, vacuum lines)

AFTERMARKET:
10. Aftermarket engine modifications (cold air intake, turbo kit, intercooler, blow-off valve, tune components)
11. Quality of aftermarket installation — clean professional routing vs sloppy wiring, excessive zip ties, unsecured components`;
}
