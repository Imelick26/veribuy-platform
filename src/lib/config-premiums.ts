/**
 * Configuration Premium Engine
 *
 * Detects desirable vehicle configurations (diesel, manual, 4x4, performance trims)
 * and calculates premium multipliers that are applied on top of the base market value.
 *
 * Uses existing NHTSA-decoded fields stored on the Vehicle model:
 *   - engine, transmission, drivetrain, bodyStyle, nhtsaData
 *
 * Premiums are multiplicative and capped at MAX_COMBINED_PREMIUM to prevent runaway pricing.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ConfigPremium {
  factor: string;       // e.g., "Diesel Truck"
  multiplier: number;   // e.g., 1.30
  explanation: string;  // e.g., "Diesel trucks command 30% premium over gas equivalents"
}

export interface VehicleConfig {
  year: number;
  make: string;
  model: string;
  bodyStyle?: string | null;
  drivetrain?: string | null;
  engine?: string | null;
  transmission?: string | null;
  trim?: string | null;
  nhtsaData?: Record<string, unknown> | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Maximum combined premium multiplier to prevent runaway pricing */
const MAX_COMBINED_PREMIUM = 2.5;

/** Diesel engine keywords (case-insensitive matching) */
const DIESEL_KEYWORDS = [
  "diesel", "powerstroke", "power stroke", "cummins", "duramax",
  "turbo diesel", "td", "tdi", "bluetec",
];

/** Manual transmission keywords */
const MANUAL_KEYWORDS = ["manual", "stick", "mt", "zf5", "zf6", "nv4500", "nv5600", "g56"];

/** 4WD / AWD keywords */
const FOURWD_KEYWORDS = ["4wd", "4x4", "4-wheel", "four wheel", "awd", "all wheel", "all-wheel"];

/** Body types classified as trucks */
const TRUCK_BODIES = [
  "pickup", "truck", "crew cab", "extended cab", "regular cab",
  "super cab", "supercrew", "double cab", "king cab", "mega cab",
];

/** Body types classified as SUVs */
const SUV_BODIES = ["suv", "sport utility", "utility"];

/** Body types classified as sports/performance cars */
const SPORTS_BODIES = ["coupe", "convertible", "roadster", "sports car", "hatchback"];

/** Known performance trims and their premium multipliers */
const PERFORMANCE_TRIMS: Record<string, { multiplier: number; explanation: string }> = {
  // Ford
  raptor:      { multiplier: 1.25, explanation: "Raptor is a premium off-road performance trim" },
  "lightning": { multiplier: 1.20, explanation: "Lightning is a performance/electric truck trim" },
  shelby:      { multiplier: 1.30, explanation: "Shelby is a high-performance variant" },
  gt350:       { multiplier: 1.25, explanation: "GT350 is a track-focused Mustang variant" },
  gt500:       { multiplier: 1.35, explanation: "GT500 is the top-tier Mustang performance variant" },
  // Chevy/GMC
  zr2:         { multiplier: 1.20, explanation: "ZR2 is a premium off-road performance trim" },
  "trail boss": { multiplier: 1.10, explanation: "Trail Boss is an off-road oriented trim" },
  ss:          { multiplier: 1.15, explanation: "SS is a performance-oriented trim" },
  zl1:         { multiplier: 1.25, explanation: "ZL1 is the top-tier Camaro performance variant" },
  denali:      { multiplier: 1.15, explanation: "Denali is a premium luxury trim" },
  "at4":       { multiplier: 1.10, explanation: "AT4 is an off-road premium trim" },
  // Ram
  "trx":       { multiplier: 1.30, explanation: "TRX is a high-performance off-road truck" },
  "power wagon": { multiplier: 1.20, explanation: "Power Wagon is a premium off-road truck trim" },
  // Toyota
  "trd pro":   { multiplier: 1.20, explanation: "TRD Pro is Toyota's premium off-road trim" },
  "trd off-road": { multiplier: 1.10, explanation: "TRD Off-Road is a rugged capability trim" },
  // Jeep
  rubicon:     { multiplier: 1.20, explanation: "Rubicon is the top off-road Wrangler trim" },
  "392":       { multiplier: 1.25, explanation: "392 is the V8 performance Wrangler variant" },
  trackhawk:   { multiplier: 1.25, explanation: "Trackhawk is a supercharged performance SUV" },
  // BMW
  "m3":        { multiplier: 1.20, explanation: "M3 is BMW's performance sedan" },
  "m4":        { multiplier: 1.20, explanation: "M4 is BMW's performance coupe" },
  "m5":        { multiplier: 1.20, explanation: "M5 is BMW's high-performance sedan" },
  // Mercedes
  amg:         { multiplier: 1.20, explanation: "AMG is Mercedes' performance division" },
  // Subaru
  sti:         { multiplier: 1.15, explanation: "STI is Subaru's top performance variant" },
};

/* ------------------------------------------------------------------ */
/*  Helper Functions                                                   */
/* ------------------------------------------------------------------ */

function containsAny(text: string | null | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function classifyBody(vehicle: VehicleConfig): "truck" | "suv" | "sports" | "sedan" | "other" {
  const bodyStyle = vehicle.bodyStyle?.toLowerCase() || "";
  const nhtsaBody = String(
    (vehicle.nhtsaData as Record<string, unknown>)?.BodyClass || ""
  ).toLowerCase();
  const model = vehicle.model.toLowerCase();

  // Check body style fields
  if (containsAny(bodyStyle, TRUCK_BODIES) || containsAny(nhtsaBody, TRUCK_BODIES)) return "truck";
  if (containsAny(bodyStyle, SUV_BODIES) || containsAny(nhtsaBody, SUV_BODIES)) return "suv";
  if (containsAny(bodyStyle, SPORTS_BODIES) || containsAny(nhtsaBody, SPORTS_BODIES)) return "sports";

  // Fallback: infer from well-known model names
  const knownTrucks = [
    "f-150", "f150", "f-250", "f250", "f-350", "f350", "f-450",
    "silverado", "sierra", "ram", "tundra", "tacoma", "titan",
    "colorado", "canyon", "ranger", "frontier", "gladiator",
    "ridgeline", "maverick",
  ];
  const knownSuvs = [
    "tahoe", "suburban", "expedition", "4runner", "wrangler",
    "bronco", "blazer", "durango", "explorer", "highlander",
    "sequoia", "land cruiser", "defender", "discovery",
  ];
  const knownSports = [
    "mustang", "camaro", "corvette", "challenger", "charger",
    "supra", "miata", "mx-5", "86", "brz", "wrx",
    "911", "cayman", "boxster", "z4", "m2",
  ];

  if (knownTrucks.some((t) => model.includes(t))) return "truck";
  if (knownSuvs.some((t) => model.includes(t))) return "suv";
  if (knownSports.some((t) => model.includes(t))) return "sports";

  return "sedan"; // default
}

function isDiesel(vehicle: VehicleConfig): boolean {
  const nhtsaFuel = String(
    (vehicle.nhtsaData as Record<string, unknown>)?.FuelTypePrimary || ""
  ).toLowerCase();
  return (
    containsAny(vehicle.engine, DIESEL_KEYWORDS) ||
    nhtsaFuel.includes("diesel") ||
    containsAny(vehicle.model, ["powerstroke", "cummins", "duramax"])
  );
}

function isManual(vehicle: VehicleConfig): boolean {
  const nhtsaTrans = String(
    (vehicle.nhtsaData as Record<string, unknown>)?.TransmissionStyle || ""
  ).toLowerCase();
  return (
    containsAny(vehicle.transmission, MANUAL_KEYWORDS) ||
    nhtsaTrans.includes("manual")
  );
}

function is4wd(vehicle: VehicleConfig): boolean {
  const nhtsaDrive = String(
    (vehicle.nhtsaData as Record<string, unknown>)?.DriveType || ""
  ).toLowerCase();
  return (
    containsAny(vehicle.drivetrain, FOURWD_KEYWORDS) ||
    containsAny(nhtsaDrive, FOURWD_KEYWORDS)
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Calculate configuration premiums for a vehicle based on its specs.
 *
 * Returns an array of applicable premiums and the combined multiplier.
 * Premiums are multiplicative (stacked) but capped at MAX_COMBINED_PREMIUM.
 */
export function calculateConfigPremiums(vehicle: VehicleConfig): {
  premiums: ConfigPremium[];
  combinedMultiplier: number;
} {
  const premiums: ConfigPremium[] = [];
  const bodyType = classifyBody(vehicle);
  const vehicleAge = new Date().getFullYear() - vehicle.year;
  const diesel = isDiesel(vehicle);
  const manual = isManual(vehicle);
  const fourWd = is4wd(vehicle);

  // 1. Diesel truck/SUV premium
  if (diesel && (bodyType === "truck" || bodyType === "suv")) {
    premiums.push({
      factor: "Diesel Truck/SUV",
      multiplier: 1.30,
      explanation: "Diesel trucks and SUVs command a 30% premium over gas equivalents due to towing capability, longevity, and enthusiast demand",
    });
  }

  // 2. Manual transmission premium (trucks and sports cars)
  if (manual) {
    if (bodyType === "truck") {
      premiums.push({
        factor: "Manual Transmission (Truck)",
        multiplier: 1.25,
        explanation: "Manual transmission trucks are rare and highly sought after by enthusiasts, commanding a 25% premium",
      });
    } else if (bodyType === "sports") {
      premiums.push({
        factor: "Manual Transmission (Sports Car)",
        multiplier: 1.10,
        explanation: "Manual sports cars retain a 10% premium over automatic equivalents",
      });
    }
  }

  // 3. 4WD/AWD premium (trucks)
  if (fourWd && bodyType === "truck") {
    premiums.push({
      factor: "4WD / 4x4",
      multiplier: 1.15,
      explanation: "4-wheel drive trucks command a 15% premium over 2WD equivalents",
    });
  }

  // 4. Performance trim premium (lookup table)
  const trimLower = (vehicle.trim || "").toLowerCase();
  const modelLower = vehicle.model.toLowerCase();
  const combinedText = `${trimLower} ${modelLower}`;

  for (const [trimKey, { multiplier, explanation }] of Object.entries(PERFORMANCE_TRIMS)) {
    if (combinedText.includes(trimKey)) {
      premiums.push({
        factor: `Performance Trim: ${trimKey.toUpperCase()}`,
        multiplier,
        explanation,
      });
      break; // Only apply one performance trim premium
    }
  }

  // 5. Classic desirable — prevent age penalty on enthusiast vehicles
  //    If the vehicle is 25+ years old AND has desirable config, ensure the
  //    combined multiplier is at least 1.0 (no depreciation penalty).
  //    This is enforced via the floor below, not as an explicit premium.

  // Calculate combined multiplier (multiplicative)
  let combinedMultiplier = 1.0;
  for (const p of premiums) {
    combinedMultiplier *= p.multiplier;
  }

  // Cap at maximum
  if (combinedMultiplier > MAX_COMBINED_PREMIUM) {
    combinedMultiplier = MAX_COMBINED_PREMIUM;
  }

  // Floor: for 25+ year old vehicles with desirable configs, never go below 1.0
  if (vehicleAge > 25 && premiums.length > 0) {
    combinedMultiplier = Math.max(combinedMultiplier, 1.0);
  }

  return { premiums, combinedMultiplier };
}

/**
 * Classify a vehicle's body type for fallback pricing curves.
 * Exported for use by the market-data orchestrator.
 */
export { classifyBody };
