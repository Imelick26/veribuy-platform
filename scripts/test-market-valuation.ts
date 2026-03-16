/**
 * Market Valuation Calibration Script
 *
 * Tests the valuation engine against realistic vehicle scenarios.
 * Run: npx tsx scripts/test-market-valuation.ts
 *
 * Review the output and provide feedback on whether the fair prices
 * and recommendations make sense. Multipliers can be tuned in
 * src/lib/market-valuation.ts.
 */

import {
  calculateFairPrice,
  calculateDealEconomics,
  type HistoryData,
  CONDITION_ANCHORS,
} from "../src/lib/market-valuation";

/* ------------------------------------------------------------------ */
/*  Test Scenarios                                                     */
/* ------------------------------------------------------------------ */

interface TestScenario {
  label: string;
  vehicle: string;
  mileage: string;
  basePriceCents: number;    // VinAudit estimated value
  retailPriceCents: number;  // VinAudit valueHigh (retail)
  conditionScore: number;
  history: HistoryData;
  reconCostCents: number;    // avg of repair low/high from findings
}

const scenarios: TestScenario[] = [
  // --- 2019 Ford F-150 XLT ---
  {
    label: "F-150 — Clean, No accidents, Good condition",
    vehicle: "2019 Ford F-150 XLT",
    mileage: "135,000 mi",
    basePriceCents: 1_650_000,   // $16,500
    retailPriceCents: 2_100_000, // $21,000
    conditionScore: 78,
    history: {
      titleStatus: "CLEAN",
      accidentCount: 0,
      ownerCount: 2,
      structuralDamage: false,
      floodDamage: false,
      openRecallCount: 0,
    },
    reconCostCents: 120_000, // $1,200 minor cosmetic work
  },
  {
    label: "F-150 — Salvage, 1 accident, Fair condition",
    vehicle: "2019 Ford F-150 XLT",
    mileage: "135,000 mi",
    basePriceCents: 1_650_000,
    retailPriceCents: 2_100_000,
    conditionScore: 55,
    history: {
      titleStatus: "SALVAGE",
      accidentCount: 1,
      ownerCount: 3,
      structuralDamage: true,
      floodDamage: false,
      openRecallCount: 1,
    },
    reconCostCents: 500_000, // $5,000 significant repairs
  },

  // --- 2020 Toyota Camry SE ---
  {
    label: "Camry — Clean, No accidents, Very Good condition",
    vehicle: "2020 Toyota Camry SE",
    mileage: "60,000 mi",
    basePriceCents: 1_850_000,   // $18,500
    retailPriceCents: 2_200_000, // $22,000
    conditionScore: 88,
    history: {
      titleStatus: "CLEAN",
      accidentCount: 0,
      ownerCount: 1,
      structuralDamage: false,
      floodDamage: false,
      openRecallCount: 0,
    },
    reconCostCents: 30_000, // $300 detail/cleanup
  },
  {
    label: "Camry — Clean, 2 accidents, Fair condition",
    vehicle: "2020 Toyota Camry SE",
    mileage: "60,000 mi",
    basePriceCents: 1_850_000,
    retailPriceCents: 2_200_000,
    conditionScore: 62,
    history: {
      titleStatus: "CLEAN",
      accidentCount: 2,
      ownerCount: 3,
      structuralDamage: false,
      floodDamage: false,
      openRecallCount: 0,
    },
    reconCostCents: 250_000, // $2,500 body/paint work
  },

  // --- 2017 BMW X3 ---
  {
    label: "BMW X3 — Clean, 1 accident, Good condition",
    vehicle: "2017 BMW X3 xDrive28i",
    mileage: "90,000 mi",
    basePriceCents: 1_300_000,   // $13,000
    retailPriceCents: 1_650_000, // $16,500
    conditionScore: 72,
    history: {
      titleStatus: "CLEAN",
      accidentCount: 1,
      ownerCount: 2,
      structuralDamage: false,
      floodDamage: false,
      openRecallCount: 2,
    },
    reconCostCents: 180_000, // $1,800 BMW maintenance items
  },
  {
    label: "BMW X3 — Rebuilt, 3 accidents, Poor condition",
    vehicle: "2017 BMW X3 xDrive28i",
    mileage: "90,000 mi",
    basePriceCents: 1_300_000,
    retailPriceCents: 1_650_000,
    conditionScore: 45,
    history: {
      titleStatus: "REBUILT",
      accidentCount: 3,
      ownerCount: 5,
      structuralDamage: true,
      floodDamage: false,
      openRecallCount: 4,
    },
    reconCostCents: 800_000, // $8,000 extensive repairs needed
  },

  // --- Edge cases ---
  {
    label: "Flood damage Camry — even good condition is PASS",
    vehicle: "2020 Toyota Camry SE",
    mileage: "60,000 mi",
    basePriceCents: 1_850_000,
    retailPriceCents: 2_200_000,
    conditionScore: 80,
    history: {
      titleStatus: "CLEAN",
      accidentCount: 0,
      ownerCount: 1,
      structuralDamage: false,
      floodDamage: true,
      openRecallCount: 0,
    },
    reconCostCents: 0,
  },
  {
    label: "Pristine low-mile Camry — maximum value",
    vehicle: "2020 Toyota Camry SE",
    mileage: "25,000 mi",
    basePriceCents: 2_100_000,   // $21,000 (low miles = higher base)
    retailPriceCents: 2_500_000, // $25,000
    conditionScore: 96,
    history: {
      titleStatus: "CLEAN",
      accidentCount: 0,
      ownerCount: 1,
      structuralDamage: false,
      floodDamage: false,
      openRecallCount: 0,
    },
    reconCostCents: 0,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDollars(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const str = "$" + (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return negative ? `-${str}` : str;
}

function fmtPercent(decimal: number): string {
  return (decimal * 100).toFixed(1) + "%";
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function rpad(str: string, len: number): string {
  return str.padStart(len);
}

const DIVIDER = "═".repeat(72);
const THIN_DIVIDER = "─".repeat(72);

/* ------------------------------------------------------------------ */
/*  Run Calibration                                                    */
/* ------------------------------------------------------------------ */

console.log("\n" + DIVIDER);
console.log("  MARKET VALUATION ENGINE — CALIBRATION TEST");
console.log("  " + new Date().toISOString());
console.log(DIVIDER + "\n");

// Show the condition curve
console.log("CONDITION MULTIPLIER CURVE:");
console.log(THIN_DIVIDER);
for (const [score, mult] of CONDITION_ANCHORS) {
  const bar = "█".repeat(Math.round(mult * 40));
  console.log(`  Score ${String(score).padStart(3)}: ${mult.toFixed(2)}  ${bar}`);
}
console.log("");

// Run each scenario
for (const s of scenarios) {
  const result = calculateFairPrice(
    s.basePriceCents,
    s.conditionScore,
    s.history,
    s.reconCostCents,
  );

  const economics = calculateDealEconomics(
    result.fairPurchasePrice,
    s.retailPriceCents,
    s.conditionScore,
    s.history,
  );

  console.log(DIVIDER);
  console.log(`  ${s.vehicle} (${s.mileage})`);
  console.log(`  ${s.label}`);
  console.log(DIVIDER);

  console.log(`  ${pad("Base Market Value:", 28)} ${rpad(fmtDollars(s.basePriceCents), 10)}`);
  console.log(`  ${pad("Condition Multiplier:", 28)} ${rpad(result.conditionMultiplier.toFixed(3), 10)}  (score ${s.conditionScore} → ${result.conditionGrade})`);

  // History breakdown
  const hb = result.historyBreakdown;
  console.log(`  ${pad("History Multiplier:", 28)} ${rpad(result.historyMultiplier.toFixed(3), 10)}  = title(${hb.titleFactor}) × acc(${hb.accidentFactor}) × own(${hb.ownerFactor}) × struct(${hb.structuralDamageFactor}) × flood(${hb.floodDamageFactor}) × recall(${hb.recallFactor})`);

  console.log(`  ${pad("Adjusted (before recon):", 28)} ${rpad(fmtDollars(result.adjustedValueBeforeRecon), 10)}`);

  if (s.reconCostCents > 0) {
    console.log(`  ${pad("Est. Recon Cost:", 28)} ${rpad("-" + fmtDollars(s.reconCostCents), 10)}`);
  }

  console.log(`  ${THIN_DIVIDER}`);
  console.log(`  ${pad("FAIR MARKET VALUE:", 28)} ${rpad(fmtDollars(result.fairPurchasePrice), 10)}  ◄ what the car is worth`);
  console.log(`  ${pad("Est. Retail/Resale:", 28)} ${rpad(fmtDollars(s.retailPriceCents), 10)}`);
  console.log(`  ${THIN_DIVIDER}`);

  // Price bands
  console.log("  OFFER GUIDE (what to pay):");
  for (const band of economics.priceBands) {
    const icon =
      band.label === "STRONG_BUY" ? "✅" :
      band.label === "FAIR_BUY"   ? "🟡" :
      band.label === "OVERPAYING" ? "🟠" : "🔴";

    if (band.label === "PASS") {
      console.log(`    ${icon} PASS             > ${fmtDollars(band.maxPriceCents)}  (walk away)`);
    } else if (band.label === "STRONG_BUY") {
      console.log(`    ${icon} ${pad(band.label, 16)} ≤ ${rpad(fmtDollars(band.maxPriceCents), 8)}  (15%+ below market)`);
    } else if (band.label === "FAIR_BUY") {
      console.log(`    ${icon} ${pad(band.label, 16)} ≤ ${rpad(fmtDollars(band.maxPriceCents), 8)}  (at or below market)`);
    } else {
      console.log(`    ${icon} ${pad(band.label, 16)} ≤ ${rpad(fmtDollars(band.maxPriceCents), 8)}  (above market, thin margin)`);
    }
  }
  console.log("");
}

// Summary table
console.log(DIVIDER);
console.log("  SUMMARY TABLE");
console.log(DIVIDER);
console.log(
  `  ${pad("Scenario", 44)} ${rpad("Fair Value", 10)} ${rpad("Strong Buy ≤", 13)} ${rpad("Fair Buy ≤", 11)} ${rpad("Pass >", 9)}`,
);
console.log(`  ${THIN_DIVIDER}`);

for (const s of scenarios) {
  const result = calculateFairPrice(
    s.basePriceCents,
    s.conditionScore,
    s.history,
    s.reconCostCents,
  );
  const economics = calculateDealEconomics(
    result.fairPurchasePrice,
    s.retailPriceCents,
    s.conditionScore,
    s.history,
  );
  const bands = economics.priceBands;
  console.log(
    `  ${pad(s.label, 44)} ${rpad(fmtDollars(result.fairPurchasePrice), 10)} ${rpad(fmtDollars(bands[0].maxPriceCents), 13)} ${rpad(fmtDollars(bands[1].maxPriceCents), 11)} ${rpad(fmtDollars(bands[2].maxPriceCents), 9)}`,
  );
}

console.log("\n" + DIVIDER);
console.log("  Review the prices above. Are they reasonable?");
console.log("  If not, tell me which scenarios need adjustment and in what direction.");
console.log(DIVIDER + "\n");
