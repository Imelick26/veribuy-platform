import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });
async function main() {
  const insp = await db.inspection.findUnique({
    where: { id: "cmnc5xjvr000004ifdb8h65q7" },
    include: { media: true },
  });
  if (!insp) { console.log("Not found"); return; }
  console.log(`Photos: ${insp.media.length}`);
  for (const m of insp.media) {
    const url = m.url || "NO URL";
    const hasNewline = url.includes('\n') || url.includes('\r');
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status !== 200) {
        console.log(`  ${m.captureType}: ${res.status} | newline=${hasNewline} | ${JSON.stringify(url.substring(0, 100))}`);
      }
    } catch (e) {
      console.log(`  ${m.captureType}: FAILED | newline=${hasNewline} | ${JSON.stringify(url.substring(0, 100))}`);
    }
  }
  console.log("Done checking all URLs");
  await db.$disconnect();
}
main().catch(console.error);
