import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const BRONCO_SPORT_RISKS = [
  {
    severity: "CRITICAL",
    title: "Head Gasket / Coolant Intrusion",
    description: "1.5L EcoBoost prone to head gasket failure causing coolant intrusion into cylinders. Can lead to catastrophic engine damage if undetected.",
    cost: { low: 280000, high: 420000 },
    source: "NHTSA_TSB",
    position: { x: 0.8, y: 0.3, z: 0 },
    symptoms: ["White exhaust smoke", "Coolant loss without visible leak", "Overheating", "Milky oil on dipstick"],
    category: "ENGINE",
  },
  {
    severity: "CRITICAL",
    title: "Transmission Shudder / Failure",
    description: "8-speed automatic transmission exhibits shuddering during shifts, particularly 2-3 and 3-4. Can progress to complete failure.",
    cost: { low: 350000, high: 580000 },
    source: "NHTSA_TSB",
    position: { x: -0.3, y: 0.2, z: 0 },
    symptoms: ["Shuddering during acceleration", "Harsh shifting", "Delayed engagement", "Check engine light"],
    category: "TRANSMISSION",
  },
  {
    severity: "CRITICAL",
    title: "Turbocharger Oil Leak / Failure",
    description: "Turbocharger oil seals can fail causing oil consumption and potential turbo failure. Blue/white smoke on cold start.",
    cost: { low: 180000, high: 320000 },
    source: "NHTSA_TSB",
    position: { x: 0.9, y: 0.4, z: 0.2 },
    symptoms: ["Blue/white smoke on startup", "Oil consumption increase", "Reduced power", "Whining noise from turbo"],
    category: "ENGINE",
  },
  {
    severity: "CRITICAL",
    title: "Fuel Injector Leak / Misfire",
    description: "Direct injection fuel injectors can develop leaks or fail causing misfires and potential fuel system contamination.",
    cost: { low: 60000, high: 110000 },
    source: "OWNER_REPORTS",
    position: { x: 0.7, y: 0.3, z: -0.2 },
    symptoms: ["Rough idle", "Misfire codes", "Fuel smell", "Hard starting"],
    category: "ENGINE",
  },
  {
    severity: "MAJOR",
    title: "Rear Drive Unit Seal Leak",
    description: "AWD rear differential seals can leak fluid causing eventual drive unit failure if fluid level drops too low.",
    cost: { low: 120000, high: 240000 },
    source: "NHTSA_TSB",
    position: { x: -1.0, y: 0.1, z: 0 },
    symptoms: ["Fluid puddle under rear", "Whining from rear", "AWD warning light", "Clunking on turns"],
    category: "DRIVETRAIN",
  },
  {
    severity: "MAJOR",
    title: "Electric Power Steering Rack",
    description: "Electronic power steering assist can fail intermittently. Steering effort increases suddenly at low speeds.",
    cost: { low: 90000, high: 180000 },
    source: "NHTSA_TSB",
    position: { x: 0.5, y: 0.1, z: 0 },
    symptoms: ["Heavy steering at low speed", "Steering warning light", "Intermittent assist loss", "Clunking on turns"],
    category: "STRUCTURAL",
  },
  {
    severity: "MAJOR",
    title: "Water Pump / Coolant Leak",
    description: "Water pump seal failure causes coolant leak. Often occurs between 30k-60k miles. Related to coolant intrusion issue.",
    cost: { low: 40000, high: 80000 },
    source: "OWNER_REPORTS",
    position: { x: 0.6, y: 0.3, z: 0.3 },
    symptoms: ["Coolant leak visible", "Low coolant warning", "Overheating", "Sweet smell from engine bay"],
    category: "ENGINE",
  },
  {
    severity: "MAJOR",
    title: "Battery / BCM Voltage Drop",
    description: "Body Control Module can cause parasitic battery drain. Vehicle fails to start after sitting overnight or longer.",
    cost: { low: 30000, high: 90000 },
    source: "OWNER_REPORTS",
    position: { x: 0.3, y: 0.3, z: 0.4 },
    symptoms: ["Dead battery overnight", "Electrical glitches", "Random warning lights", "Slow cranking"],
    category: "ELECTRICAL",
  },
  {
    severity: "MODERATE",
    title: "Transmission Shift Calibration",
    description: "Software-related shift quality issues that may require TCM reprogramming. Not a hardware failure but affects drivability.",
    cost: { low: 15000, high: 40000 },
    source: "NHTSA_TSB",
    position: { x: -0.2, y: 0.2, z: 0 },
    symptoms: ["Rough 1-2 shift", "Hesitation on acceleration", "Gear hunting on hills"],
    category: "TRANSMISSION",
  },
  {
    severity: "MODERATE",
    title: "EVAP Purge Valve Failure",
    description: "Evaporative emission purge valve sticks open causing rough idle and check engine light. Common on EcoBoost engines.",
    cost: { low: 20000, high: 45000 },
    source: "OWNER_REPORTS",
    position: { x: 0.4, y: 0.2, z: -0.3 },
    symptoms: ["Check engine light", "Rough idle when cold", "Fuel vapor smell", "Hard starting after fill-up"],
    category: "ENGINE",
  },
  {
    severity: "MODERATE",
    title: "Front Strut / Suspension Wear",
    description: "Front struts and stabilizer links wear prematurely, especially on rough roads. Causes noise and poor handling.",
    cost: { low: 60000, high: 120000 },
    source: "OWNER_REPORTS",
    position: { x: 0.3, y: -0.1, z: 0.5 },
    symptoms: ["Clunking over bumps", "Nose dive on braking", "Uneven tire wear", "Bouncy ride"],
    category: "SUSPENSION",
  },
  {
    severity: "MODERATE",
    title: "Brake Pad / Rotor Premature Wear",
    description: "Front brake rotors warp early, especially with frequent towing or mountain driving. Causes pulsation during braking.",
    cost: { low: 30000, high: 70000 },
    source: "OWNER_REPORTS",
    position: { x: 0.2, y: -0.1, z: -0.5 },
    symptoms: ["Brake pulsation", "Squealing noise", "Longer stopping distance", "Steering wheel vibration when braking"],
    category: "BRAKES",
  },
  {
    severity: "MINOR",
    title: "SYNC Infotainment Freeze / Reboot",
    description: "SYNC 3/4 system freezes or reboots spontaneously. Usually resolved with software update but recurs.",
    cost: { low: 0, high: 15000 },
    source: "OWNER_REPORTS",
    position: { x: 0.0, y: 0.5, z: 0 },
    symptoms: ["Screen goes black", "Audio cuts out", "Navigation freezes", "Bluetooth disconnects"],
    category: "ELECTRONICS",
  },
  {
    severity: "MINOR",
    title: "Driver Assist Sensor Calibration",
    description: "Forward-facing camera and radar sensors may lose calibration after windshield replacement or alignment changes.",
    cost: { low: 10000, high: 30000 },
    source: "OWNER_REPORTS",
    position: { x: 0.9, y: 0.5, z: 0 },
    symptoms: ["Lane keep assist warning", "Adaptive cruise errors", "Pre-collision false alerts"],
    category: "ELECTRONICS",
  },
  {
    severity: "MINOR",
    title: "12V Battery Premature Drain",
    description: "12V auxiliary battery has shorter than expected lifespan due to high accessory load. Typically fails around 2-3 years.",
    cost: { low: 15000, high: 30000 },
    source: "OWNER_REPORTS",
    position: { x: 0.4, y: 0.2, z: 0.4 },
    symptoms: ["Slow cranking", "Electrical reset on start", "Clock resets", "Key fob range reduced"],
    category: "ELECTRICAL",
  },
  {
    severity: "MINOR",
    title: "Cabin / Engine Air Filter Maintenance",
    description: "OEM air filters clog faster than expected in dusty conditions. Regular inspection prevents secondary issues.",
    cost: { low: 3000, high: 8000 },
    source: "OWNER_REPORTS",
    position: { x: 0.5, y: 0.3, z: 0 },
    symptoms: ["Reduced MPG", "Sluggish acceleration", "Musty cabin smell", "Whistling from intake"],
    category: "OTHER",
  },
];

const CAMRY_RISKS = [
  {
    severity: "MAJOR",
    title: "Excessive Engine Oil Consumption",
    description: "2.5L 4-cylinder burns oil at higher than normal rate, particularly in 2018-2020 models.",
    cost: { low: 150000, high: 400000 },
    source: "NHTSA_TSB",
    position: { x: 0.7, y: 0.3, z: 0 },
    symptoms: ["Low oil warning", "Blue exhaust smoke", "Oil consumption >1qt per 1000mi"],
    category: "ENGINE",
  },
  {
    severity: "MAJOR",
    title: "Transmission Hesitation / Jerk",
    description: "8-speed automatic hesitates on downshifts and can jerk during low-speed maneuvers.",
    cost: { low: 100000, high: 350000 },
    source: "OWNER_REPORTS",
    position: { x: -0.3, y: 0.2, z: 0 },
    symptoms: ["Hesitation on acceleration", "Jerking at low speed", "Delayed downshift"],
    category: "TRANSMISSION",
  },
  {
    severity: "MODERATE",
    title: "Dashboard Rattle / Noise",
    description: "Persistent rattle from dashboard area, especially on rough roads. Caused by loose clips or HVAC duct interference.",
    cost: { low: 10000, high: 30000 },
    source: "OWNER_REPORTS",
    position: { x: 0.2, y: 0.5, z: 0 },
    symptoms: ["Rattling from dash area", "Noise on bumpy roads", "Worse in cold weather"],
    category: "COSMETIC_INTERIOR",
  },
  {
    severity: "MODERATE",
    title: "Brake Actuator Noise",
    description: "ABS brake actuator makes grinding noise during normal operation, especially at low speeds.",
    cost: { low: 80000, high: 200000 },
    source: "NHTSA_TSB",
    position: { x: 0.4, y: 0.0, z: 0.4 },
    symptoms: ["Grinding from brakes at low speed", "ABS activation on dry road", "Brake pedal pulsation"],
    category: "BRAKES",
  },
  {
    severity: "MINOR",
    title: "Entune / Audio System Lag",
    description: "Infotainment system can be slow to respond, Bluetooth connection drops occasionally.",
    cost: { low: 0, high: 15000 },
    source: "OWNER_REPORTS",
    position: { x: 0.0, y: 0.5, z: 0 },
    symptoms: ["Slow touch response", "Bluetooth drops", "CarPlay disconnects"],
    category: "ELECTRONICS",
  },
  {
    severity: "MODERATE",
    title: "Front Strut Mount Noise",
    description: "Front strut mounts wear causing clunking noise over bumps and during turns.",
    cost: { low: 40000, high: 90000 },
    source: "OWNER_REPORTS",
    position: { x: 0.5, y: 0.0, z: 0.4 },
    symptoms: ["Clunk over bumps", "Noise during turns", "Slightly looser steering feel"],
    category: "SUSPENSION",
  },
  {
    severity: "MINOR",
    title: "Paint Chipping on Hood / Bumper",
    description: "Factory paint is thin on leading edges, chips easily from road debris.",
    cost: { low: 20000, high: 80000 },
    source: "OWNER_REPORTS",
    position: { x: 1.0, y: 0.4, z: 0 },
    symptoms: ["Visible chips on hood", "Paint bubbling near chips", "Rust spots forming"],
    category: "COSMETIC_EXTERIOR",
  },
  {
    severity: "CRITICAL",
    title: "Fuel Pump Assembly Failure",
    description: "Low-pressure fuel pump impeller can deform, causing engine stall at highway speeds. Subject to recall on some VINs.",
    cost: { low: 80000, high: 150000 },
    source: "NHTSA_TSB",
    position: { x: -0.6, y: 0.2, z: 0 },
    symptoms: ["Engine stall while driving", "Rough running", "Extended cranking", "Check engine light"],
    category: "ENGINE",
  },
];

const CIVIC_RISKS = [
  {
    severity: "MAJOR",
    title: "1.5T Engine Oil Dilution",
    description: "Fuel enters crankcase through direct injection, diluting engine oil. More common in cold climates with short trips.",
    cost: { low: 50000, high: 200000 },
    source: "NHTSA_TSB",
    position: { x: 0.7, y: 0.3, z: 0 },
    symptoms: ["Oil level rising above full mark", "Gasoline smell from dipstick", "Check engine light"],
    category: "ENGINE",
  },
  {
    severity: "MODERATE",
    title: "CVT Transmission Shudder",
    description: "CVT exhibits shuddering at low speeds, especially under light throttle application.",
    cost: { low: 100000, high: 300000 },
    source: "OWNER_REPORTS",
    position: { x: -0.3, y: 0.2, z: 0 },
    symptoms: ["Shuddering at 15-30 mph", "Vibration during light acceleration", "Rough deceleration"],
    category: "TRANSMISSION",
  },
  {
    severity: "MODERATE",
    title: "Side Mirror Vibration",
    description: "Driver and passenger mirrors vibrate at highway speed, reducing visibility.",
    cost: { low: 20000, high: 60000 },
    source: "OWNER_REPORTS",
    position: { x: 0.1, y: 0.5, z: 0.5 },
    symptoms: ["Mirror shaking on highway", "Blurred reflection above 60mph"],
    category: "COSMETIC_EXTERIOR",
  },
  {
    severity: "MINOR",
    title: "Infotainment Screen Glare / Lag",
    description: "Center display has significant glare in sunlight and can lag with Android Auto/CarPlay.",
    cost: { low: 0, high: 10000 },
    source: "OWNER_REPORTS",
    position: { x: 0.0, y: 0.5, z: 0 },
    symptoms: ["Screen unreadable in sun", "Touch lag", "CarPlay connection drops"],
    category: "ELECTRONICS",
  },
  {
    severity: "MAJOR",
    title: "AC Compressor Failure",
    description: "Air conditioning compressor fails prematurely, leaving fragments in the system requiring full AC overhaul.",
    cost: { low: 100000, high: 250000 },
    source: "OWNER_REPORTS",
    position: { x: 0.5, y: 0.2, z: 0.3 },
    symptoms: ["AC blows warm", "Clicking from compressor", "Intermittent cooling"],
    category: "HVAC",
  },
  {
    severity: "MINOR",
    title: "Windshield Cracking",
    description: "Windshield is prone to stress cracks from small impacts due to aggressive rake angle.",
    cost: { low: 30000, high: 70000 },
    source: "OWNER_REPORTS",
    position: { x: 0.3, y: 0.7, z: 0 },
    symptoms: ["Small chip spreading into crack", "Crack originating from edge"],
    category: "COSMETIC_EXTERIOR",
  },
];

async function main() {
  console.log("🌱 Seeding risk profiles...");

  // Clear existing
  await prisma.riskProfile.deleteMany();
  console.log("  Cleared existing risk profiles");

  // Ford Bronco Sport
  await prisma.riskProfile.create({
    data: {
      make: "Ford",
      model: "Bronco Sport",
      yearFrom: 2021,
      yearTo: 2025,
      engine: "1.5L EcoBoost I3",
      risks: BRONCO_SPORT_RISKS,
      source: "NHTSA_TSB",
    },
  });
  console.log("  ✓ Ford Bronco Sport (2021-2025) — 16 risks");

  // Toyota Camry
  await prisma.riskProfile.create({
    data: {
      make: "Toyota",
      model: "Camry",
      yearFrom: 2018,
      yearTo: 2024,
      engine: "2.5L 4-Cylinder",
      risks: CAMRY_RISKS,
      source: "NHTSA_TSB",
    },
  });
  console.log("  ✓ Toyota Camry (2018-2024) — 8 risks");

  // Honda Civic
  await prisma.riskProfile.create({
    data: {
      make: "Honda",
      model: "Civic",
      yearFrom: 2022,
      yearTo: 2025,
      engine: "1.5L Turbo I4",
      risks: CIVIC_RISKS,
      source: "OWNER_REPORTS",
    },
  });
  console.log("  ✓ Honda Civic (2022-2025) — 6 risks");

  console.log("\n✅ Seeded 3 vehicle risk profiles (30 total risks)");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
