/**
 * Angle-specific prompt: Dashboard
 * Phase 1 checklist for the dashboard / driver cockpit photo.
 */

import type { VehicleInfo } from "../../types";

export function buildDashboardChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `DASHBOARD & COCKPIT — Inspect the dashboard area of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. Score wear relative to the mileage — age-appropriate wear is not a defect.

DASHBOARD SURFACE:
1. Dashboard cracks — especially sun-damaged areas on the top surface or defroster vents
2. Dashboard warping or sticky/melting surfaces (common on certain makes due to heat exposure)

STEERING WHEEL:
3. Steering wheel wear — leather peeling, shiny spots from hand oils, worn wrap or stitching, cracking

INFOTAINMENT & CONTROLS:
4. Infotainment screen — cracks, dead pixels, black spots, delamination, or touch-screen dead zones
5. Control buttons and knobs — broken, missing, discolored, or sticky buttons; loose knobs

CENTER CONSOLE:
6. Center console — scratches, broken latches, cupholder damage, worn armrest padding or leather

HVAC & INSTRUMENTS:
7. HVAC vents — broken fins, missing vent covers, cracked bezels, stuck direction adjusters
8. Gauge cluster condition — scratched lens, dead indicator lights, condensation behind the cluster

OVERALL:
9. Overall dash cleanliness and condition
10. Wear level appropriate for ${mileageStr}? Flag if wear appears significantly worse or better than expected for the mileage`;
}
