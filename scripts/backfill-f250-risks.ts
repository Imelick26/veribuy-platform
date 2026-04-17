/**
 * One-off: generate the risk profile for the F-250 inspection VB-2026-00068
 * that finished without risks due to the RISK_INSPECTION auto-trigger bug.
 * Uses the same enrichment pipeline the UI calls via tRPC.
 *
 * Usage: npx tsx scripts/backfill-f250-risks.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const { fetchComplaints, fetchRecalls, fetchInvestigations } = await import("../src/lib/nhtsa.js");
  const { generateKnownIssues, filterRisksByVehicleConfig } = await import("../src/lib/ai/risk-summarizer.js");
  const { buildRiskProfile } = await import("../src/lib/risk-engine.js");

  const INSPECTION_ID = "cmo3arku1000004lbn634mbka"; // VB-2026-00068

  const inspection = await db.inspection.findUnique({
    where: { id: INSPECTION_ID },
    include: { vehicle: true },
  });
  if (!inspection?.vehicle) { console.error("Inspection or vehicle missing"); process.exit(1); }

  const { vin, make, model, year } = inspection.vehicle;
  console.log(`Enriching ${year} ${make} ${model} (${vin})...`);

  const [complaintsResult, recallsResult, investigationsResult] = await Promise.allSettled([
    fetchComplaints(make, model, year),
    fetchRecalls(make, model, year),
    fetchInvestigations(make, model, year),
  ]);
  const complaints = complaintsResult.status === "fulfilled" ? complaintsResult.value : [];
  const recalls = recallsResult.status === "fulfilled" ? recallsResult.value : [];
  const investigations = investigationsResult.status === "fulfilled" ? investigationsResult.value : [];
  console.log(`NHTSA: ${complaints.length} complaints, ${recalls.length} recalls, ${investigations.length} investigations`);

  const curatedProfile = await db.riskProfile.findFirst({
    where: {
      make: { equals: make, mode: "insensitive" },
      model: { contains: model, mode: "insensitive" },
      yearFrom: { lte: year },
      yearTo: { gte: year },
    },
  });
  const curatedRisks = (curatedProfile?.risks as Array<Record<string, unknown>> | undefined) ?? [];
  console.log(`Curated: ${curatedRisks.length} seed risks`);

  let knownIssues = await generateKnownIssues({
    year, make, model,
    trim: inspection.vehicle.trim,
    engine: inspection.vehicle.engine,
    transmission: inspection.vehicle.transmission,
    drivetrain: inspection.vehicle.drivetrain,
    complaints, recalls, investigations,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    curatedRisks: curatedRisks as any,
  });
  console.log(`AI generated ${knownIssues.length} known issues`);

  if (knownIssues.length > 0) {
    try {
      knownIssues = await filterRisksByVehicleConfig(knownIssues, {
        year, make, model,
        trim: inspection.vehicle.trim,
        engine: inspection.vehicle.engine,
        transmission: inspection.vehicle.transmission,
        drivetrain: inspection.vehicle.drivetrain,
        bodyStyle: inspection.vehicle.bodyStyle,
      });
      console.log(`Filtered to ${knownIssues.length} applicable issues`);
    } catch (err) {
      console.warn("Filter failed, using unfiltered:", err);
    }
  }

  const profile = buildRiskProfile({
    vehicleId: inspection.vehicle.id, vin, make, model, year,
    knownIssues, recalls, investigations,
    complaintCount: complaints.length,
    curatedProfileId: curatedProfile?.id,
  });
  console.log(`Built profile with ${profile.aggregatedRisks.length} aggregated risks`);

  await db.inspectionStep.update({
    where: { inspectionId_step: { inspectionId: INSPECTION_ID, step: "RISK_INSPECTION" } },
    data: { data: JSON.parse(JSON.stringify(profile)), enteredAt: new Date() },
  });
  console.log(`✓ Saved to RISK_INSPECTION step data`);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
