import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });
async function main() {
  const inspections = await db.inspection.findMany({
    where: { vehicle: { make: { contains: "Audi", mode: "insensitive" } } },
    include: { vehicle: { select: { year: true, make: true, model: true, vin: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  for (const i of inspections) {
    console.log(i.id, "|", i.vehicle?.year, i.vehicle?.make, i.vehicle?.model, "|", i.vehicle?.vin, "| score:", i.overallScore);
  }
  if (inspections.length === 0) console.log("No Audi inspections found");
  await db.$disconnect();
}
main().catch(console.error);
