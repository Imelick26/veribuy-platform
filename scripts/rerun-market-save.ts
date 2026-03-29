/**
 * Re-run market analysis and SAVE to database (updates the MarketAnalysis record).
 * Usage: npx tsx scripts/rerun-market-save.ts [inspectionId]
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
  const inspectionId = process.argv[2] || "cmn9l7f43000004kz2yfjv6vh";

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: { vehicle: true, findings: true, vehicleHistory: true },
  });
  if (!inspection?.vehicle) { console.error("Not found:", inspectionId); return; }

  const vehicle = inspection.vehicle;
  const conditionScore = inspection.overallScore || 70;
  const locStr = (inspection.location || "").trim();
  const zip = /^\d{5}$/.test(locStr) ? locStr : (locStr.match(/\b(\d{5})\b/)?.[1] || "97201");
  const bodyCategory = classifyBody(vehicle as VehicleConfig);

  console.log(`\nRe-running market analysis: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  console.log(`Score: ${conditionScore}/100 | ZIP: ${zip} | Mileage: ${inspection.odometer?.toLocaleString() || "?"}`);

  // Step 1: Market data
  console.log("\n[1] Fetching market data...");
  const marketData = await fetchMarketData(
    { vin: vehicle.vin, year: vehicle.year, make: vehicle.make, model: vehicle.model,
      bodyStyle: vehicle.bodyStyle, drivetrain: vehicle.drivetrain, engine: vehicle.engine,
      transmission: vehicle.transmission, trim: vehicle.trim,
      nhtsaData: vehicle.nhtsaData as Record<string, unknown> | null },
    zip, inspection.odometer || undefined, conditionScore,
  );
  console.log(`  Consensus: $${marketData.estimatedValue.toLocaleString()}`);

  // Step 2: History + Condition + Recon
  console.log("[2] AI adjustments...");
  const historyData: HistoryData = inspection.vehicleHistory
    ? { titleStatus: inspection.vehicleHistory.titleStatus, accidentCount: inspection.vehicleHistory.accidentCount,
        ownerCount: inspection.vehicleHistory.ownerCount ?? 1, structuralDamage: inspection.vehicleHistory.structuralDamage,
        floodDamage: inspection.vehicleHistory.floodDamage, openRecallCount: inspection.vehicleHistory.openRecallCount }
    : { titleStatus: "CLEAN", accidentCount: 0, ownerCount: 1, structuralDamage: false, floodDamage: false, openRecallCount: 0 };

  const basePriceCents = Math.round(marketData.estimatedValue * 100);

  const [aiHistory, aiCondition, aiRecon] = await Promise.all([
    analyzeHistoryImpact({ vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
      bodyCategory, baseMarketValue: marketData.estimatedValue, history: historyData, conditionScore, mileage: inspection.odometer || undefined }),
    analyzeConditionValue({ vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model },
      mileage: inspection.odometer || undefined, baseMarketValue: marketData.estimatedValue, bodyCategory, conditionScore,
      areaScores: { exteriorBody: inspection.exteriorBodyScore ?? undefined, interior: inspection.interiorScore ?? undefined,
        mechanicalVisual: inspection.mechanicalVisualScore ?? undefined, underbodyFrame: inspection.underbodyFrameScore ?? undefined },
      conditionAttenuation: marketData.conditionAttenuation }),
    estimateReconCosts({ vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
      zip, mileage: inspection.odometer || undefined,
      findings: inspection.findings.filter((f) => f.repairCostLow || f.repairCostHigh)
        .map((f) => ({ title: f.title, costLow: f.repairCostLow || undefined, costHigh: f.repairCostHigh || undefined, category: f.category || undefined, severity: f.severity || undefined })),
      baseMarketValue: marketData.estimatedValue }),
  ]);

  // Dealer offer calculation
  const reconDollars = Math.round(aiRecon.result.totalReconCost / 100);
  const rawRetailDollars = Math.round(marketData.privatePartyValue * 1.15);
  const estRetailDollars = Math.round(rawRetailDollars * aiCondition.result.conditionMultiplier * aiHistory.result.historyMultiplier);
  const maxOfferBeforeRecon = Math.round(estRetailDollars * 0.75);
  const maxOfferDollars = Math.max(Math.round(estRetailDollars * 0.05), maxOfferBeforeRecon - reconDollars);
  const fairPurchasePrice = maxOfferDollars * 100;

  console.log(`  Retail: $${estRetailDollars.toLocaleString()} | 75%: $${maxOfferBeforeRecon.toLocaleString()} | Recon: -$${reconDollars.toLocaleString()} | Offer: $${maxOfferDollars.toLocaleString()}`);

  // Step 3: Deal rating
  console.log("[3] Deal rating...");
  const retailPriceCents = estRetailDollars * 100;
  const historySummary = [`Title: ${historyData.titleStatus}`, historyData.accidentCount > 0 ? `${historyData.accidentCount} accident(s)` : null, `${historyData.ownerCount} owner(s)`].filter(Boolean).join(", ");
  const aiDeal = await rateDeal({
    vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
    fairPurchasePrice, baseMarketValue: basePriceCents, retailValue: retailPriceCents,
    conditionScore, historyMultiplier: aiHistory.result.historyMultiplier, historySummary,
    reconCostCents: aiRecon.result.totalReconCost, mileage: inspection.odometer || undefined,
  });
  console.log(`  Rating: ${aiDeal.result.rating}`);

  // Step 4: Auditor
  console.log("[4] Auditor...");
  const fullTrace = [
    ...marketData.pricingTrace,
    { label: "Est. Dealer Retail", inputDollars: rawRetailDollars, operation: `× ${(aiCondition.result.conditionMultiplier * aiHistory.result.historyMultiplier).toFixed(3)}`, outputDollars: estRetailDollars, explanation: `Cond × Hist` },
    { label: "Max Offer (75%)", inputDollars: estRetailDollars, operation: "× 0.75", outputDollars: maxOfferBeforeRecon, explanation: "25% dealer margin" },
    { label: "Reconditioning", inputDollars: maxOfferBeforeRecon, operation: reconDollars > 0 ? `- $${reconDollars}` : "none", outputDollars: maxOfferDollars, explanation: "" },
  ];
  const aiAudit = await auditPrice({
    vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
    mileage: inspection.odometer || undefined,
    sourcePrices: marketData.sourceResults.filter((s) => s.estimatedValue > 0).map((s) => ({ source: s.source, value: s.estimatedValue })),
    consensusValue: marketData.baseValuePreConfig, consensusReasoning: marketData.aiMetadata?.consensusReasoning || "",
    configMultiplier: marketData.configMultiplier, configReasoning: marketData.aiMetadata?.configReasoning || "",
    regionalMultiplier: marketData.configMultiplier > 0 ? marketData.estimatedValue / (marketData.baseValuePreConfig * marketData.configMultiplier) : 1.0,
    regionalReasoning: marketData.aiMetadata?.geoReasoning || "",
    adjustedBaseValueCents: basePriceCents, conditionMultiplier: aiCondition.result.conditionMultiplier, conditionScore,
    conditionReasoning: aiCondition.result.reasoning, historyMultiplier: aiHistory.result.historyMultiplier,
    historyReasoning: aiHistory.result.combinedReasoning, historySummary,
    reconCostCents: aiRecon.result.totalReconCost, reconReasoning: aiRecon.result.totalReasoning,
    fairPurchasePrice, dealRating: aiDeal.result.rating, dealReasoning: aiDeal.result.reasoning, pricingTrace: fullTrace,
  });

  const finalPrice = !aiAudit.result.approved && aiAudit.result.adjustedFairPrice ? aiAudit.result.adjustedFairPrice : fairPurchasePrice;
  console.log(`  ${aiAudit.result.approved ? "APPROVED" : "ADJUSTED"} (${(aiAudit.result.coherenceScore * 100).toFixed(0)}%)`);

  // Build fairResult
  const fairResult = {
    fairPurchasePrice: finalPrice,
    baseMarketValue: basePriceCents,
    conditionMultiplier: aiCondition.result.conditionMultiplier,
    conditionGrade: getConditionGrade(conditionScore),
    historyMultiplier: aiHistory.result.historyMultiplier,
    historyBreakdown: {
      titleFactor: aiHistory.result.breakdown.titleImpact.factor,
      accidentFactor: aiHistory.result.breakdown.accidentImpact.factor,
      ownerFactor: aiHistory.result.breakdown.ownerImpact.factor,
      structuralDamageFactor: aiHistory.result.breakdown.structuralImpact.factor,
      floodDamageFactor: aiHistory.result.breakdown.floodImpact.factor,
      recallFactor: aiHistory.result.breakdown.recallImpact.factor,
    },
    adjustedValueBeforeRecon: estRetailDollars * 100,
    estReconCost: aiRecon.result.totalReconCost,
  };

  const estRetailCents = estRetailDollars * 100;
  const estGrossProfit = estRetailCents - finalPrice - aiRecon.result.totalReconCost;
  const comparables = marketData.nearbyListings.map((l) => ({
    title: l.title, price: l.price, mileage: l.mileage, location: l.location, source: l.source, url: l.url,
  }));

  const bands = [
    { label: "STRONG_BUY" as const, maxPriceCents: aiDeal.result.priceBands.strongBuyMax, marginPercent: 0.15 },
    { label: "FAIR_BUY" as const, maxPriceCents: aiDeal.result.priceBands.fairBuyMax, marginPercent: 0.05 },
    { label: "OVERPAYING" as const, maxPriceCents: aiDeal.result.priceBands.overpayingMax, marginPercent: 0 },
    { label: "PASS" as const, maxPriceCents: aiDeal.result.priceBands.overpayingMax, marginPercent: 0 },
  ];

  // Save to database
  console.log("\n[5] Saving to database...");
  await db.marketAnalysis.upsert({
    where: { inspectionId },
    create: {
      inspectionId,
      comparables: JSON.parse(JSON.stringify(comparables)),
      baselinePrice: basePriceCents,
      adjustments: JSON.parse(JSON.stringify({ mileage: Math.round(marketData.mileageAdjustment * 100), conditionDelta: fairResult.adjustedValueBeforeRecon - basePriceCents, historyDelta: Math.round(basePriceCents * fairResult.conditionMultiplier * (fairResult.historyMultiplier - 1)) })),
      adjustedPrice: finalPrice,
      recommendation: aiDeal.result.rating as never,
      strongBuyMax: bands[0].maxPriceCents,
      fairBuyMax: bands[1].maxPriceCents,
      overpayingMax: bands[2].maxPriceCents,
      estRetailPrice: estRetailCents,
      estReconCost: aiRecon.result.totalReconCost,
      estGrossProfit,
      conditionScore,
      conditionMultiplier: fairResult.conditionMultiplier,
      conditionGrade: fairResult.conditionGrade,
      historyMultiplier: fairResult.historyMultiplier,
      historyBreakdown: JSON.parse(JSON.stringify(fairResult.historyBreakdown)),
      adjustedValueBeforeRecon: fairResult.adjustedValueBeforeRecon,
      priceBands: JSON.parse(JSON.stringify(bands)),
      dataSource: marketData.dataSource,
      dataSourceConfidence: marketData.confidence,
      configPremiums: marketData.configPremiums.length > 0 ? JSON.parse(JSON.stringify(marketData.configPremiums)) : undefined,
      configMultiplier: marketData.configMultiplier !== 1.0 ? marketData.configMultiplier : undefined,
      baseValuePreConfig: marketData.baseValuePreConfig !== marketData.estimatedValue ? Math.round(marketData.baseValuePreConfig * 100) : undefined,
      tradeInValue: Math.round(marketData.tradeInValue * 100),
      privatePartyValue: Math.round(marketData.privatePartyValue * 100),
      dealerRetailValue: estRetailCents,
      wholesaleValue: Math.round((marketData.wholesaleValue || 0) * 100) || undefined,
      loanValue: Math.round((marketData.loanValue || 0) * 100) || undefined,
      sourceResults: JSON.parse(JSON.stringify(marketData.sourceResults.map((s) => ({ source: s.source, estimatedValue: s.estimatedValue, confidence: s.confidence, isConditionTiered: s.isConditionTiered })))),
      consensusMethod: marketData.consensusMethod,
      configPremiumMode: marketData.configPremiumMode,
      conditionAttenuation: marketData.conditionAttenuation,
      sourceCount: marketData.sourceCount,
      aiAuditorApproved: aiAudit.result.approved,
      aiAuditorCoherence: aiAudit.result.coherenceScore,
      aiAuditorFlags: aiAudit.result.flags.length > 0 ? JSON.parse(JSON.stringify(aiAudit.result.flags)) : undefined,
      aiAuditorReasoning: aiAudit.result.reasoning || undefined,
    },
    update: {
      comparables: JSON.parse(JSON.stringify(comparables)),
      baselinePrice: basePriceCents,
      adjustedPrice: finalPrice,
      recommendation: aiDeal.result.rating as never,
      strongBuyMax: bands[0].maxPriceCents, fairBuyMax: bands[1].maxPriceCents, overpayingMax: bands[2].maxPriceCents,
      estRetailPrice: estRetailCents, estReconCost: aiRecon.result.totalReconCost, estGrossProfit,
      conditionScore, conditionMultiplier: fairResult.conditionMultiplier, conditionGrade: fairResult.conditionGrade,
      historyMultiplier: fairResult.historyMultiplier, historyBreakdown: JSON.parse(JSON.stringify(fairResult.historyBreakdown)),
      adjustedValueBeforeRecon: fairResult.adjustedValueBeforeRecon, priceBands: JSON.parse(JSON.stringify(bands)),
      dataSource: marketData.dataSource, dataSourceConfidence: marketData.confidence,
      tradeInValue: Math.round(marketData.tradeInValue * 100), privatePartyValue: Math.round(marketData.privatePartyValue * 100),
      dealerRetailValue: estRetailCents, wholesaleValue: Math.round((marketData.wholesaleValue || 0) * 100) || undefined,
      loanValue: Math.round((marketData.loanValue || 0) * 100) || undefined,
      sourceResults: JSON.parse(JSON.stringify(marketData.sourceResults.map((s) => ({ source: s.source, estimatedValue: s.estimatedValue, confidence: s.confidence, isConditionTiered: s.isConditionTiered })))),
      sourceCount: marketData.sourceCount, configPremiumMode: marketData.configPremiumMode,
      aiAuditorApproved: aiAudit.result.approved, aiAuditorCoherence: aiAudit.result.coherenceScore,
      aiAuditorFlags: aiAudit.result.flags.length > 0 ? JSON.parse(JSON.stringify(aiAudit.result.flags)) : undefined,
      aiAuditorReasoning: aiAudit.result.reasoning || undefined,
    },
  });

  console.log(`\nDone! Max Offer: $${maxOfferDollars.toLocaleString()} | Retail: $${estRetailDollars.toLocaleString()} | Margin: $${(estGrossProfit / 100).toLocaleString()}`);
  await db.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
