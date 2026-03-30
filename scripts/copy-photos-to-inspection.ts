import { config } from "dotenv";
config({ path: ".env.local" });

const SOURCE_INSPECTION = "cmnc5xjvr000004ifdb8h65q7"; // Original Audi Q5
const TARGET_INSPECTION = "cmncgabhr0009wotcvwlmwcwq"; // New inspection

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const db = new PrismaClient({ adapter });

  // Get media from source inspection (exclude id, timestamps, inspectionId)
  const media = await db.mediaItem.findMany({
    where: { inspectionId: SOURCE_INSPECTION },
  });
  console.log(`Found ${media.length} photos in source inspection`);

  // Copy to target — reuse all fields except id and inspectionId
  for (const m of media) {
    const { id, inspectionId, createdAt, updatedAt, ...fields } = m;
    await db.mediaItem.create({
      data: {
        ...fields,
        inspectionId: TARGET_INSPECTION,
      },
    });
  }
  console.log(`Copied ${media.length} photos to target inspection`);

  // Mark MEDIA_CAPTURE step as completed
  await db.inspectionStep.update({
    where: {
      inspectionId_step: {
        inspectionId: TARGET_INSPECTION,
        step: "MEDIA_CAPTURE",
      },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      enteredAt: new Date(),
    },
  });
  console.log("MEDIA_CAPTURE step marked COMPLETED");

  // Verify
  const count = await db.mediaItem.count({ where: { inspectionId: TARGET_INSPECTION } });
  console.log(`Target inspection now has ${count} photos`);

  await db.$disconnect();
}

main().catch(console.error);
