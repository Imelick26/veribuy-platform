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
    include: { steps: true },
  });
  if (!insp) { console.log("Not found"); return; }

  console.log("Inspection:", insp.id);
  console.log("Steps:");
  for (const s of insp.steps) {
    const dataKeys = s.data && typeof s.data === "object" ? Object.keys(s.data as object) : [];
    console.log(`  ${s.step} (${s.status}) — data keys: [${dataKeys.join(", ")}]`);

    if (s.step === "RISK_REVIEW" && s.data) {
      const d = s.data as any;
      console.log(`    aggregatedRisks: ${d.aggregatedRisks?.length ?? "none"}`);
      if (d.aggregatedRisks?.length > 0) {
        for (const r of d.aggregatedRisks.slice(0, 3)) {
          console.log(`      - ${r.id}: ${r.title}`);
        }
      }
    }

    if (s.step === "AI_ANALYSIS" && s.data) {
      const d = s.data as any;
      const cs = d.checkStatuses;
      if (cs) {
        const keys = Object.keys(cs);
        console.log(`    checkStatuses: ${keys.length} entries`);
        for (const k of keys.slice(0, 3)) {
          console.log(`      - ${k}: ${cs[k].status}`);
        }
      } else {
        console.log(`    checkStatuses: not found`);
      }
    }
  }

  await db.$disconnect();
}
main().catch(console.error);
