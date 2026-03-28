/**
 * Re-run market analysis for a specific inspection using the new AI pipeline.
 * Usage: npx tsx scripts/rerun-market.ts [inspectionId]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchMarketData } from "../src/lib/market-data.js";
import { calculateFairPrice, getConditionGrade, type HistoryData } from "../src/lib/market-valuation.js";
import { classifyBody, type VehicleConfig } from "../src/lib/config-premiums.js";
import { analyzeHistoryImpact } from "../src/lib/ai/history-adjuster.js";
import { analyzeConditionValue } from "../src/lib/ai/condition-adjuster.js";
import { estimateReconCosts } from "../src/lib/ai/recon-estimator.js";
import { rateDeal } from "../src/lib/ai/deal-rater.js";
import { auditPrice } from "../src/lib/ai/price-auditor.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const inspectionId = process.argv[2] || "cmn83h2wk000004lbym6wpi0g";

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: { vehicle: true, findings: true, vehicleHistory: true },
  });
  if (!inspection?.vehicle) {
    console.error("Inspection not found:", inspectionId);
    return;
  }

  const vehicle = inspection.vehicle;
  const conditionScore = inspection.overallScore || 70;
  const locStr = (inspection.location || "").trim();
  const zip = /^\d{5}$/.test(locStr) ? locStr : (locStr.match(/\b(\d{5})\b/)?.[1] || "97201");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Re-running AI market analysis: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  console.log(`VIN: ${vehicle.vin} | Mileage: ${inspection.odometer?.toLocaleString() || "?"} | Score: ${conditionScore}/100 | ZIP: ${zip}`);
  console.log(`${"=".repeat(60)}\n`);

  // ── Step 1: Market data (5 APIs + AI consensus/config/geo) ──
  console.log("[1/5] Fetching market data...");
  const t1 = Date.now();
  const marketData = await fetchMarketData(
    {
      vin: vehicle.vin, year: vehicle.year, make: vehicle.make, model: vehicle.model,
      bodyStyle: vehicle.bodyStyle, drivetrain: vehicle.drivetrain, engine: vehicle.engine,
      transmission: vehicle.transmission, trim: vehicle.trim,
      nhtsaData: vehicle.nhtsaData as Record<string, unknown> | null,
    },
    zip, inspection.odometer || undefined, conditionScore,
  );
  console.log(`  Done in ${Date.now() - t1}ms`);
  console.log(`  Consensus: $${marketData.estimatedValue.toLocaleString()} (${marketData.sourceCount} sources, ${(marketData.confidence * 100).toFixed(0)}% conf)`);
  console.log(`  Config: ${marketData.configMultiplier.toFixed(2)}x | Premiums: ${marketData.configPremiums.map(p => p.factor).join(", ") || "none"}`);
  console.log(`  AI tiers: consensus=${marketData.aiMetadata?.consensusTier}, config=${marketData.aiMetadata?.configPremiumTier}, geo=${marketData.aiMetadata?.geoPricingTier}`);

  // ── Build history ──
  const historyData: HistoryData = inspection.vehicleHistory
    ? {
        titleStatus: inspection.vehicleHistory.titleStatus,
        accidentCount: inspection.vehicleHistory.accidentCount,
        ownerCount: inspection.vehicleHistory.ownerCount ?? 1,
        structuralDamage: inspection.vehicleHistory.structuralDamage,
        floodDamage: inspection.vehicleHistory.floodDamage,
        openRecallCount: inspection.vehicleHistory.openRecallCount,
      }
    : { titleStatus: "CLEAN", accidentCount: 0, ownerCount: 1, structuralDamage: false, floodDamage: false, openRecallCount: 0 };

  const basePriceCents = Math.round(marketData.estimatedValue * 100);
  const bodyCategory = classifyBody(vehicle as VehicleConfig);

  // ── Step 2: AI History + Condition + Recon (parallel) ──
  console.log("\n[2/5] AI history + condition + recon (parallel)...");
  const t2 = Date.now();
  const [aiHistory, aiCondition, aiRecon] = await Promise.all([
    analyzeHistoryImpact({
      vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
      bodyCategory, baseMarketValue: marketData.estimatedValue, history: historyData,
      conditionScore, mileage: inspection.odometer || undefined,
    }),
    analyzeConditionValue({
      vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model },
      mileage: inspection.odometer || undefined, baseMarketValue: marketData.estimatedValue,
      bodyCategory, conditionScore,
      areaScores: {
        exteriorBody: inspection.exteriorBodyScore ?? undefined,
        interior: inspection.interiorScore ?? undefined,
        mechanicalVisual: inspection.mechanicalVisualScore ?? undefined,
        underbodyFrame: inspection.underbodyFrameScore ?? undefined,
      },
      keyObservations: inspection.conditionSummary ? [inspection.conditionSummary] : undefined,
      conditionAttenuation: marketData.conditionAttenuation,
    }),
    estimateReconCosts({
      vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
      zip, mileage: inspection.odometer || undefined,
      findings: inspection.findings
        .filter((f) => f.repairCostLow || f.repairCostHigh)
        .map((f) => ({ title: f.title, costLow: f.repairCostLow || undefined, costHigh: f.repairCostHigh || undefined, category: f.category || undefined, severity: f.severity || undefined })),
      baseMarketValue: marketData.estimatedValue,
    }),
  ]);
  console.log(`  Done in ${Date.now() - t2}ms`);
  console.log(`  History:   ${aiHistory.result.historyMultiplier.toFixed(3)}x (tier ${aiHistory.fallbackTier})`);
  console.log(`    Title: ${aiHistory.result.breakdown.titleImpact.factor.toFixed(2)}x — ${aiHistory.result.breakdown.titleImpact.reasoning}`);
  console.log(`    Accidents: ${aiHistory.result.breakdown.accidentImpact.factor.toFixed(2)}x — ${aiHistory.result.breakdown.accidentImpact.reasoning}`);
  console.log(`    Owners: ${aiHistory.result.breakdown.ownerImpact.factor.toFixed(2)}x — ${aiHistory.result.breakdown.ownerImpact.reasoning}`);
  console.log(`  Condition: ${aiCondition.result.conditionMultiplier.toFixed(3)}x (tier ${aiCondition.fallbackTier})`);
  console.log(`    ${aiCondition.result.reasoning}`);
  console.log(`  Recon:     $${(aiRecon.result.totalReconCost / 100).toLocaleString()} (tier ${aiRecon.fallbackTier})`);
  for (const item of aiRecon.result.itemizedCosts) {
    console.log(`    ${item.finding}: $${(item.estimatedCostCents / 100).toLocaleString()} — ${item.reasoning}`);
  }

  // ── Compute fair price ──
  const adjustedBeforeRecon = Math.round(basePriceCents * aiCondition.result.conditionMultiplier * aiHistory.result.historyMultiplier);
  const fairPrice = Math.max(Math.round(basePriceCents * 0.05), adjustedBeforeRecon - aiRecon.result.totalReconCost);

  // ── Step 3: Deal rating ──
  console.log("\n[3/5] AI deal rating...");
  const t3 = Date.now();
  const historySummary = [`Title: ${historyData.titleStatus}`, historyData.accidentCount > 0 ? `${historyData.accidentCount} accident(s)` : null, `${historyData.ownerCount} owner(s)`].filter(Boolean).join(", ");
  const retailPriceCents = Math.round((marketData.valueHigh || marketData.estimatedValue * 1.1) * 100);

  const aiDeal = await rateDeal({
    vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
    fairPurchasePrice: fairPrice, baseMarketValue: basePriceCents, retailValue: retailPriceCents,
    conditionScore, historyMultiplier: aiHistory.result.historyMultiplier, historySummary,
    reconCostCents: aiRecon.result.totalReconCost, mileage: inspection.odometer || undefined,
  });
  console.log(`  Done in ${Date.now() - t3}ms`);
  console.log(`  Rating: ${aiDeal.result.rating} (tier ${aiDeal.fallbackTier})`);
  console.log(`  ${aiDeal.result.reasoning}`);
  console.log(`  Bands: Strong ≤$${(aiDeal.result.priceBands.strongBuyMax / 100).toLocaleString()} | Fair ≤$${(aiDeal.result.priceBands.fairBuyMax / 100).toLocaleString()} | Over ≤$${(aiDeal.result.priceBands.overpayingMax / 100).toLocaleString()}`);

  // ── Step 4: Price auditor ──
  console.log("\n[4/5] AI price auditor...");
  const t4 = Date.now();
  const aiAudit = await auditPrice({
    vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
    mileage: inspection.odometer || undefined,
    sourcePrices: marketData.sourceResults.filter((s) => s.estimatedValue > 0).map((s) => ({ source: s.source, value: s.estimatedValue })),
    consensusValue: marketData.baseValuePreConfig,
    consensusReasoning: marketData.aiMetadata?.consensusReasoning || "",
    configMultiplier: marketData.configMultiplier,
    configReasoning: marketData.aiMetadata?.configReasoning || "",
    regionalMultiplier: marketData.configMultiplier > 0 ? marketData.estimatedValue / (marketData.baseValuePreConfig * marketData.configMultiplier) : 1.0,
    regionalReasoning: marketData.aiMetadata?.geoReasoning || "",
    adjustedBaseValueCents: basePriceCents,
    conditionMultiplier: aiCondition.result.conditionMultiplier,
    conditionScore,
    conditionReasoning: aiCondition.result.reasoning,
    historyMultiplier: aiHistory.result.historyMultiplier,
    historyReasoning: aiHistory.result.combinedReasoning,
    historySummary,
    reconCostCents: aiRecon.result.totalReconCost,
    reconReasoning: aiRecon.result.totalReasoning,
    fairPurchasePrice: fairPrice,
    dealRating: aiDeal.result.rating,
    dealReasoning: aiDeal.result.reasoning,
  });
  console.log(`  Done in ${Date.now() - t4}ms`);

  const finalPrice = !aiAudit.result.approved && aiAudit.result.adjustedFairPrice ? aiAudit.result.adjustedFairPrice : fairPrice;
  console.log(`  ${aiAudit.result.approved ? "APPROVED" : "ADJUSTED"} (coherence: ${(aiAudit.result.coherenceScore * 100).toFixed(0)}%)`);
  if (aiAudit.result.flags.length > 0) console.log(`  Flags: ${aiAudit.result.flags.join("; ")}`);
  console.log(`  ${aiAudit.result.reasoning}`);

  // ── Final Summary ──
  console.log(`\n${"=".repeat(60)}`);
  console.log(`FINAL RESULTS — ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Market Consensus:      $${marketData.estimatedValue.toLocaleString()}`);
  console.log(`Config Premium:        ${marketData.configMultiplier.toFixed(2)}x`);
  console.log(`Condition:             ${aiCondition.result.conditionMultiplier.toFixed(3)}x (score ${conditionScore}/100, ${getConditionGrade(conditionScore)})`);
  console.log(`History:               ${aiHistory.result.historyMultiplier.toFixed(3)}x`);
  console.log(`Adjusted Before Recon: $${(adjustedBeforeRecon / 100).toLocaleString()}`);
  console.log(`Recon Cost:            -$${(aiRecon.result.totalReconCost / 100).toLocaleString()}`);
  console.log(`Fair Purchase Price:   $${(finalPrice / 100).toLocaleString()}`);
  console.log(`Deal Rating:           ${aiDeal.result.rating}`);
  console.log(`Auditor:               ${aiAudit.result.approved ? "VERIFIED" : "ADJUSTED"} (${(aiAudit.result.coherenceScore * 100).toFixed(0)}% coherence)`);
  console.log(`${"=".repeat(60)}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
