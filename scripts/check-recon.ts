import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const inspId = "cmnc5xjvr000004ifdb8h65q7";

  // Findings
  const findings = await db.finding.findMany({
    where: { inspectionId: inspId },
    select: { title: true, severity: true, repairCostLow: true, repairCostHigh: true },
  });
  console.log("Findings:");
  for (const f of findings) {
    console.log(`  ${f.title} | ${f.severity} | $${((f.repairCostLow || 0) / 100).toFixed(0)} - $${((f.repairCostHigh || 0) / 100).toFixed(0)}`);
  }
  const totalLow = findings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
  const totalHigh = findings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);
  console.log(`Total: $${(totalLow / 100).toFixed(0)} - $${(totalHigh / 100).toFixed(0)} | Avg: $${(((totalLow + totalHigh) / 2) / 100).toFixed(0)}`);

  // Market analysis recon
  const ma = await db.marketAnalysis.findUnique({
    where: { inspectionId: inspId },
    select: { estReconCost: true },
  });
  console.log(`\nMarketAnalysis estReconCost: $${((ma?.estReconCost || 0) / 100).toFixed(0)}`);

  await db.$disconnect();
}
main().catch(console.error);
