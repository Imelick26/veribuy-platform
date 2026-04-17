/**
 * Smoke test for Black Book + VinAudit integrations.
 *
 * Calls both APIs with a real VIN and prints exactly what comes back,
 * so we can diagnose auth/connectivity/response-shape issues WITHOUT
 * burning an inspection credit.
 *
 * Usage:
 *   npx tsx scripts/smoke-test-integrations.ts <VIN> [mileage] [state]
 *
 * Example:
 *   npx tsx scripts/smoke-test-integrations.ts 1FTFW1ET5DFA12345 82000 TX
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const VIN = process.argv[2];
  const MILEAGE = process.argv[3] ? Number(process.argv[3]) : 80000;
  const STATE = process.argv[4] || "TX";

  if (!VIN || VIN.length !== 17) {
    console.error("Usage: npx tsx scripts/smoke-test-integrations.ts <17-char VIN> [mileage] [state]");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log(` SMOKE TEST: Black Book + VinAudit`);
  console.log(`   VIN: ${VIN}`);
  console.log(`   Mileage: ${MILEAGE.toLocaleString()}`);
  console.log(`   State: ${STATE}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── Credential check ────────────────────────────────────────────
  console.log("── Credentials present in process.env? ──");
  const creds = {
    BLACKBOOK_USERNAME: !!process.env.BLACKBOOK_USERNAME,
    BLACKBOOK_PASSWORD: !!process.env.BLACKBOOK_PASSWORD,
    VINAUDIT_API_KEY: !!process.env.VINAUDIT_API_KEY,
    VINAUDIT_USER: !!process.env.VINAUDIT_USER,
    VINAUDIT_PASS: !!process.env.VINAUDIT_PASS,
  };
  for (const [k, v] of Object.entries(creds)) {
    console.log(`   ${v ? "✓" : "✗"} ${k}: ${v ? "set" : "MISSING"}`);
  }
  const missing = Object.entries(creds).filter(([, v]) => !v);
  if (missing.length > 0) {
    console.error(`\n⚠  Missing credentials: ${missing.map(([k]) => k).join(", ")}`);
    console.error(`   Tests for those providers will be skipped.\n`);
  } else {
    console.log();
  }

  const bbReady = creds.BLACKBOOK_USERNAME && creds.BLACKBOOK_PASSWORD;
  const vaReady = creds.VINAUDIT_API_KEY && creds.VINAUDIT_USER && creds.VINAUDIT_PASS;

  // ── Black Book: VIN valuation ───────────────────────────────────
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" BLACK BOOK — Used Car VIN valuation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (!bbReady) {
    console.log("   ⊘ Skipped — BLACKBOOK_USERNAME/PASSWORD not set in .env.local");
  } else try {
    const { fetchBlackBookValuation, fetchBlackBookRetailInsights } = await import("../src/lib/blackbook.js");
    const bb = await fetchBlackBookValuation(VIN, MILEAGE, STATE);
    if (!bb) {
      console.log("   → No valuation returned. BB may not have data for this VIN.");
    } else {
      console.log(`   ✓ Valuation received`);
      console.log(`      Vehicle: ${bb.year} ${bb.make} ${bb.model} ${bb.series}`);
      console.log(`      Style: ${bb.style} | Class: ${bb.className}`);
      console.log(`      UVC: ${bb.uvc}`);
      console.log(`      Retail (clean):     $${bb.retail.clean.toLocaleString()}`);
      console.log(`      Wholesale (clean):  $${bb.wholesale.clean.toLocaleString()}`);
      console.log(`      Trade-In (clean):   $${bb.tradeIn.clean.toLocaleString()}`);
      console.log(`      Finance Advance:    $${bb.financeAdvance.toLocaleString()}`);
      console.log(`      Data quality: firstValuesFlag=${bb.firstValuesFlag} vinOnly=${bb.vinOnly} enhancedTrimMatch=${bb.enhancedTrimMatch}`);

      // ── Black Book: Retail Insights ─────────────────────────────
      console.log("\n── BB Retail Insights (comparable listings) ──");
      if (!bb.uvc) {
        console.log("   ✗ No UVC returned — cannot fetch comps");
      } else {
        const insights = await fetchBlackBookRetailInsights(bb.uvc, "75201", MILEAGE, 200, 10);
        if (!insights) {
          console.log("   → No retail insights returned.");
        } else {
          console.log(`   ✓ Insights received`);
          console.log(`      Total listings: ${insights.totalListings}`);
          console.log(`      Active count: ${insights.activeCount} (mean price $${insights.activeMeanPrice.toLocaleString()})`);
          console.log(`      Sold count: ${insights.soldCount} (mean price $${insights.soldMeanPrice.toLocaleString()})`);
          console.log(`      Mean days to turn: ${insights.meanDaysToTurn ?? "n/a"}`);
          console.log(`      Market days supply: ${insights.marketDaysSupply ?? "n/a"}`);
          console.log(`      Sample comps returned: ${insights.comps.length}`);
        }
      }
    }
  } catch (err) {
    console.error(`   ✗ BLACK BOOK FAILED:`);
    console.error(`      ${err instanceof Error ? err.message : err}`);
  }

  // ── VinAudit: Vehicle history ───────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" VINAUDIT — Vehicle History (v2/pullreport)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (!vaReady) {
    console.log("   ⊘ Skipped — VINAUDIT_* credentials not set in .env.local");
  } else try {
    const { fetchVehicleHistory } = await import("../src/lib/vinaudit.js");
    const h = await fetchVehicleHistory(VIN);
    console.log(`   ✓ History report received`);
    console.log(`      Provider: ${h.provider}`);
    console.log(`      Title status: ${h.titleStatus}`);
    console.log(`      Accidents: ${h.accidentCount}`);
    console.log(`      Previous owners: ${h.ownerCount}`);
    console.log(`      Service records: ${h.serviceRecords}`);
    console.log(`      Structural damage: ${h.structuralDamage ? "YES" : "no"}`);
    console.log(`      Flood damage: ${h.floodDamage ? "YES" : "no"}`);
    console.log(`      Open recalls (from VinAudit): ${h.openRecallCount}`);
    console.log(`      Title records: ${h.titleRecords.length}`);
    console.log(`      Odometer readings: ${h.odometerReadings.length}`);
    if (h.odometerReadings.length > 0) {
      const latest = h.odometerReadings[h.odometerReadings.length - 1];
      console.log(`      Latest odometer: ${latest.reading.toLocaleString()} ${latest.unit} on ${latest.date} (${latest.source})`);
    }
  } catch (err) {
    console.error(`   ✗ VINAUDIT FAILED:`);
    console.error(`      ${err instanceof Error ? err.message : err}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(" Smoke test complete.");
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
