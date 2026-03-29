/**
 * Re-run condition assessment and SAVE results to the database.
 * Usage: npx tsx scripts/rerun-condition-save.ts [inspectionId]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { analyzeVehicleCondition } from "../src/lib/ai/media-analyzer.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const inspectionId = process.argv[2] || "cmn9l7f43000004kz2yfjv6vh"; // CR-V default

  const inspection = await db.inspection.findUnique({
    where: { id: inspectionId },
    include: { vehicle: true, media: true },
  });

  if (!inspection?.vehicle) {
    console.error("Inspection not found:", inspectionId);
    return;
  }

  const vehicle = inspection.vehicle;
  console.log(`Re-running condition scan: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  console.log(`Current score: ${inspection.overallScore}/100`);

  const photos = inspection.media
    .filter((m) => m.url && m.captureType)
    .map((m) => ({
      url: m.url!,
      captureType: m.captureType!,
      category: m.category || undefined,
    }));

  console.log(`Running AI condition assessment (${photos.length} photos)...`);
  const t = Date.now();

  const result = await analyzeVehicleCondition(
    {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      mileage: inspection.odometer,
    },
    photos as Parameters<typeof analyzeVehicleCondition>[1],
  );

  console.log(`Done in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  console.log(`NEW: ${result.overallScore}/100 (was ${inspection.overallScore}/100)`);
  console.log(`  Ext: ${result.exteriorBodyScore}/10, Int: ${result.interiorScore}/10, Mech: ${result.mechanicalVisualScore}/10, Under: ${result.underbodyFrameScore}/10`);

  // Save to database
  await db.inspection.update({
    where: { id: inspectionId },
    data: {
      overallScore: result.overallScore,
      exteriorBodyScore: result.exteriorBodyScore,
      interiorScore: result.interiorScore,
      mechanicalVisualScore: result.mechanicalVisualScore,
      underbodyFrameScore: result.underbodyFrameScore,
      conditionSummary: result.summary,
      conditionRawData: {
        overallScore: result.overallScore,
        exteriorBodyScore: result.exteriorBodyScore,
        interiorScore: result.interiorScore,
        mechanicalVisualScore: result.mechanicalVisualScore,
        underbodyFrameScore: result.underbodyFrameScore,
        exteriorBody: result.exteriorBody,
        interior: result.interior,
        mechanicalVisual: result.mechanicalVisual,
        underbodyFrame: result.underbodyFrame,
        photoCoverage: result.photoCoverage,
      },
    },
  });

  console.log("Saved to database.");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
