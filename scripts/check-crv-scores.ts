import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const insp = await db.inspection.findFirst({
    where: { vehicle: { model: { contains: "CR-V", mode: "insensitive" } } },
    select: {
      id: true,
      overallScore: true,
      conditionSummary: true,
      exteriorBodyScore: true,
      interiorScore: true,
      mechanicalVisualScore: true,
      underbodyFrameScore: true,
      conditionRawData: true,
    },
  });
  console.log(JSON.stringify(insp, null, 2));
  await db.$disconnect();
}
main().catch(console.error);
