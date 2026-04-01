/**
 * Angle-specific prompt: Roof
 * Phase 1 checklist for the overhead/roof photo.
 */

import type { VehicleInfo } from "../../types";

export function buildRoofChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `ROOF VIEW — Inspect the roof of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Be specific about location (e.g., "roof center-left near the sunroof" not just "roof"). Dirty or dusty surfaces are NOT defects — only flag actual damage, wear, or component issues. Dents show as light/shadow distortions on reflective surfaces; examine the roof highlights and reflections very carefully.

1. Hail damage — look for a pattern of small, repeating dents across the roof surface; these appear as irregular distortions in the panel reflections and are best spotted by examining how light plays across the surface
2. Individual dents — single impact dents from objects (branches, cargo, hail); note the size and position on the roof
3. Paint fade or oxidation — horizontal surfaces like the roof degrade faster from UV exposure; check for chalky, dull, or whitened areas
4. Clear coat failure — flaking, peeling, or milky patches where the clear coat has separated from the base paint
5. Sunroof glass (if equipped) — chips, cracks, star breaks, or scratches in the glass panel
6. Sunroof seal condition (if equipped) — dried, cracked, shrunken, or displaced rubber seal around the sunroof opening; water leak risk indicator
7. Roof rack — bent, broken, or corroded rack rails or crossbars; loose mounting feet
8. Roof rack mounting points — rust, corrosion, or stripped fasteners at the mounting locations; staining around the mounts
9. Antenna — bent, broken, missing, or corroded antenna mast or shark-fin housing
10. Wiper blades (if visible from this angle) — torn rubber, bent arms, or deteriorated condition
11. Roof panel seams — rust or corrosion along the drip rails or where the roof panel meets the pillars`;
}

/** @deprecated Use buildRoofChecklist. Kept for backward compatibility with the category-based index. */
export function buildRoofDetectionPrompt(vehicle: VehicleInfo): string {
  const mileageStr = vehicle.mileage
    ? `${vehicle.mileage.toLocaleString()} miles`
    : "unknown mileage";
  return buildRoofChecklist(vehicle, mileageStr);
}
