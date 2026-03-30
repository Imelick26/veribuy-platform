import { config } from "dotenv";
config({ path: ".env.local" });

const INSPECTION_ID = process.argv[2] || "cmnc5xjvr000004ifdb8h65q7";

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const inspection = await db.inspection.findUnique({
    where: { id: INSPECTION_ID },
    include: { vehicle: true, findings: true },
  });
  if (!inspection?.vehicle) { console.log("Not found"); await db.$disconnect(); return; }

  const vehicle = inspection.vehicle;
  console.log(`Running recon for: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${inspection.findings.length} findings)`);

  const { estimateReconCosts } = await import("../src/lib/ai/recon-estimator.js");
  const zip = (inspection.location || "46250").trim().match(/\d{5}/)?.[0] || "46250";

  const result = await estimateReconCosts({
    vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
    zip,
    mileage: inspection.odometer || undefined,
    findings: inspection.findings
      .filter((f) => f.repairCostLow || f.repairCostHigh)
      .map((f) => ({ title: f.title, costLow: f.repairCostLow || undefined, costHigh: f.repairCostHigh || undefined, category: f.category || undefined, severity: f.severity || undefined })),
    baseMarketValue: 8000,
  });

  console.log(`Total: $${(result.result.totalReconCost / 100).toFixed(0)}`);
  for (const item of result.result.itemizedCosts) {
    console.log(`  ${item.finding}: $${(item.estimatedCostCents / 100).toFixed(0)} — ${item.reasoning}`);
  }

  await db.valuationLog.create({
    data: {
      inspectionId: INSPECTION_ID,
      module: "recon",
      model: result.model || "gpt-4o",
      fallbackTier: result.fallbackTier,
      retried: result.retried || false,
      input: JSON.parse(JSON.stringify({ vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model }, findingCount: inspection.findings.length, zip })),
      output: JSON.parse(JSON.stringify(result.result)),
      reasoning: result.result.totalReasoning || null,
    },
  });
  console.log("Saved to ValuationLog");
  await db.$disconnect();
}
main().catch(console.error);
