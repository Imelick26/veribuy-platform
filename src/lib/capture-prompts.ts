/**
 * Maps risk categories to specific media capture prompts and inspection guidance.
 * These are shown to the inspector during the physical inspection step
 * to ensure they document the relevant areas for each identified risk.
 */

interface CapturePromptConfig {
  prompts: string[];
  guidance: string;
}

const CATEGORY_CAPTURE_PROMPTS: Record<string, CapturePromptConfig> = {
  ENGINE: {
    prompts: [
      "Engine bay overhead — full view with hood open",
      "Oil dipstick close-up — check for discoloration or milky residue",
      "Coolant reservoir level and condition",
      "Engine oil cap underside — check for sludge or white residue",
      "Any visible leaks under the engine",
    ],
    guidance:
      "Start the engine cold and listen for abnormal sounds (knocking, ticking, whining). Check for white/blue exhaust smoke. Inspect all fluid levels and look for signs of leaks on the engine block, gaskets, and underneath the vehicle.",
  },
  TRANSMISSION: {
    prompts: [
      "Transmission fluid dipstick — check color and level",
      "Under-vehicle transmission area — look for leaks",
      "Shifter mechanism close-up",
    ],
    guidance:
      "With engine warm, check transmission fluid color (should be red/pink, not brown/black). Test all gears and listen for grinding, clunking, or delayed engagement. Note any shudder during acceleration or gear changes.",
  },
  DRIVETRAIN: {
    prompts: [
      "Under-vehicle drivetrain components (drive shaft, CV joints)",
      "Differential area — check for leaks",
      "CV boot condition — look for tears or grease",
    ],
    guidance:
      "Listen for clicking/clunking during turns (CV joint issues). Check for vibrations at highway speed. Inspect axle boots for tears and grease splatter.",
  },
  STRUCTURAL: {
    prompts: [
      "Frame rails — look for rust, bending, or prior repair",
      "Undercarriage overview",
      "Rocker panels and door sills",
      "Pillar joints and weld points",
    ],
    guidance:
      "Inspect frame rails for rust, bending, or signs of prior collision repair. Check rocker panels, door sills, and underbody for corrosion. Look for uneven panel gaps that may indicate structural damage.",
  },
  SUSPENSION: {
    prompts: [
      "Front strut/shock condition",
      "Rear strut/shock condition",
      "Control arm bushings — check for cracking",
      "Wheel well clearance — check both sides",
    ],
    guidance:
      "Bounce each corner of the vehicle — it should settle in 1-2 bounces. Listen for clunking over bumps. Check tire wear patterns for alignment issues. Inspect bushings for cracking or deterioration.",
  },
  BRAKES: {
    prompts: [
      "Front brake pads visible through wheel spokes",
      "Rear brake pads/drums visible through wheel",
      "Brake fluid reservoir level and color",
      "Rotor surface condition — look for grooves or hot spots",
    ],
    guidance:
      "Check pad thickness through wheel (minimum 3mm). Look for uneven rotor wear, hot spots, or grooves. Test brake pedal feel — should be firm, not spongy. Listen for squealing or grinding during braking.",
  },
  ELECTRICAL: {
    prompts: [
      "Battery terminals — check for corrosion",
      "Fuse box condition",
      "Wiring harness visible areas — check for damage",
    ],
    guidance:
      "Test all lights (headlights, brake, turn signals, hazards). Check battery terminals for corrosion. Test power windows, locks, and mirrors. Look for aftermarket wiring modifications.",
  },
  ELECTRONICS: {
    prompts: [
      "Infotainment/dashboard display — power on and check for errors",
      "Instrument cluster — all warning lights",
      "OBD-II port (for code scanning)",
    ],
    guidance:
      "Turn ignition to ON without starting — all warning lights should illuminate then turn off. Check infotainment system responsiveness, backup camera, and all electronic features. Note any error messages or warning lights that remain on.",
  },
  SAFETY: {
    prompts: [
      "Seatbelt condition and operation — all positions",
      "Airbag indicator light — should turn off after start",
      "Safety system warning lights on dashboard",
    ],
    guidance:
      "Verify all seatbelts latch and retract properly. Check that airbag warning light follows normal cycle (illuminates briefly then turns off). Test all safety systems: ABS, stability control, backup camera, parking sensors.",
  },
  COSMETIC_EXTERIOR: {
    prompts: [
      "Full walk-around photos (covered in standard captures)",
      "Close-up of any dents, scratches, or paint damage",
      "Rust spots or bubbling paint",
      "Windshield and glass condition",
    ],
    guidance:
      "Walk around the vehicle noting any dents, scratches, paint chips, rust, or mismatched paint. Check all glass for chips or cracks. Inspect weather stripping around doors and windows. Look for signs of prior body work (orange peel texture, color mismatch).",
  },
  COSMETIC_INTERIOR: {
    prompts: [
      "Dashboard and center console condition",
      "Seat wear and tear — driver side especially",
      "Carpet and floor mat condition",
      "Headliner condition",
    ],
    guidance:
      "Check all interior surfaces for wear, stains, or damage. Test all interior functions (sunroof, seat adjustments, climate controls). Check for unusual odors (mildew may indicate water intrusion). Inspect headliner for sagging.",
  },
  HVAC: {
    prompts: [
      "AC vent temperature reading (if gauge available)",
      "Climate control panel operation",
      "Cabin air filter condition",
    ],
    guidance:
      "Test AC at max cold — should blow cold within 30 seconds. Test heater at max hot. Check all fan speeds and vent positions. Listen for unusual noises from the blower motor or compressor.",
  },
  TIRES_WHEELS: {
    prompts: [
      "Tread depth — all four tires (use penny test or gauge)",
      "Tire sidewall condition — check for bulges or cracks",
      "Wheel condition — check for curb damage or bends",
    ],
    guidance:
      "Check tread depth (min 2/32\"). Look for uneven wear patterns across all four tires. Inspect sidewalls for bulges, cuts, or dry rot. Check wheels for curb rash, cracks, or bends.",
  },
  OTHER: {
    prompts: [
      "General area of concern — photograph from multiple angles",
    ],
    guidance:
      "Document the area of concern from multiple angles. Include a reference photo showing location on the vehicle.",
  },
};

/**
 * Get capture prompts and inspection guidance for a risk category.
 */
export function getCapturePrompts(category: string): CapturePromptConfig {
  return (
    CATEGORY_CAPTURE_PROMPTS[category] ||
    CATEGORY_CAPTURE_PROMPTS.OTHER
  );
}

/**
 * Get all capture prompt strings for a category.
 */
export function getCapturePromptList(category: string): string[] {
  return getCapturePrompts(category).prompts;
}

/**
 * Get inspection guidance text for a category.
 */
export function getInspectionGuidance(category: string): string {
  return getCapturePrompts(category).guidance;
}
