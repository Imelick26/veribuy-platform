import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  // Find all media with newlines in URLs
  const allMedia = await db.mediaItem.findMany({ where: { url: { contains: "\n" } } });
  console.log(`Found ${allMedia.length} media records with newlines in URLs`);

  for (const m of allMedia) {
    const fixed = m.url!.replace(/[\r\n]/g, "");
    console.log(`  Fixing ${m.id} (${m.captureType}): ${m.url!.substring(0, 50)}... → ${fixed.substring(0, 50)}...`);
    await db.mediaItem.update({ where: { id: m.id }, data: { url: fixed } });
  }

  console.log(`Fixed ${allMedia.length} URLs`);
  await db.$disconnect();
}
main().catch(console.error);
