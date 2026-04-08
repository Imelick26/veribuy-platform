import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const result = await db.mediaItem.updateMany({
    where: { uploadStatus: "PENDING" },
    data: { uploadStatus: "CONFIRMED" },
  });
  console.log("Backfilled", result.count, "records to CONFIRMED");
  await db.$disconnect();
}

main().catch(console.error);
