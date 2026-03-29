/**
 * Re-run condition assessment for a specific inspection.
 * Usage: npx tsx scripts/rerun-condition.ts [inspectionId]
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
  console.log(`\nRe-running condition scan: ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
  console.log(`VIN: ${vehicle.vin} | Photos: ${inspection.media.length}`);
  console.log(`Current score: ${inspection.overallScore}/100\n`);

  const photos = inspection.media
    .filter((m) => m.url && m.captureType)
    .map((m) => ({
      url: m.url!,
      captureType: m.captureType!,
      category: m.category || undefined,
    }));

  console.log(`Photos by captureType:`);
  const byType: Record<string, number> = {};
  for (const p of photos) {
    const t = p.captureType || "unknown";
    byType[t] = (byType[t] || 0) + 1;
  }
  for (const [t, count] of Object.entries(byType)) {
    console.log(`  ${t}: ${count}`);
  }

  console.log(`\nRunning AI condition assessment...`);
  const t = Date.now();

  const result = await analyzeVehicleCondition(
    {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      mileage: inspection.odometer,
    },
    photos,
  );

  console.log(`Done in ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
  console.log(`NEW Overall Score: ${result.overallScore}/100 (was ${inspection.overallScore}/100)`);
  console.log(`  Exterior Body:     ${result.exteriorBodyScore}/10`);
  console.log(`  Interior:          ${result.interiorScore}/10`);
  console.log(`  Mechanical/Visual: ${result.mechanicalVisualScore}/10`);
  console.log(`  Underbody/Frame:   ${result.underbodyFrameScore}/10`);

  // Show details for each area
  const areas = [
    { name: "Exterior Body", data: result.exteriorBody },
    { name: "Interior", data: result.interior },
    { name: "Mechanical/Visual", data: result.mechanicalVisual },
    { name: "Underbody/Frame", data: result.underbodyFrame },
  ];

  for (const area of areas) {
    console.log(`\n--- ${area.name} (${area.data.score}/10, ${(area.data.confidence * 100).toFixed(0)}% conf) ---`);
    console.log(`  ${area.data.summary}`);
    if (area.data.scoreJustification) {
      console.log(`  WHY: ${area.data.scoreJustification}`);
    }
    if (area.data.keyObservations.length > 0) {
      for (const obs of area.data.keyObservations) {
        console.log(`  + ${obs}`);
      }
    }
    if (area.data.concerns.length > 0) {
      for (const c of area.data.concerns) {
        console.log(`  - ${c}`);
      }
    }
  }

  console.log(`\nSummary: ${result.summary}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
