import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  // Scope to Audi Q5 inspection
  const inspections = [{ id: "cmnc5xjvr000004ifdb8h65q7" }];

  let totalDeleted = 0;
  for (const insp of inspections) {
    const findings = await db.finding.findMany({
      where: { inspectionId: insp.id },
      orderBy: { createdAt: "asc" },
    });
    const seen = new Set<string>();
    for (const f of findings) {
      if (seen.has(f.title)) {
        await db.finding.delete({ where: { id: f.id } });
        totalDeleted++;
        console.log(`  Deleted duplicate: "${f.title}" (${insp.id})`);
      } else {
        seen.add(f.title);
      }
    }
  }
  console.log(`\nDeleted ${totalDeleted} duplicate findings total`);
  await db.$disconnect();
}
main().catch(console.error);
