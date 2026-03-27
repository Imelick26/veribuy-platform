/**
 * Quick test: hit VehicleDatabases + NADA APIs with the Raptor VIN
 * Usage: npx tsx scripts/test-pricing-apis.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const RAPTOR_VIN = "1FTFW1RG1LFA71191";
const MILEAGE = 45000;
const STATE = "OR";

async function testVehicleDatabases() {
  const key = process.env.VEHICLEDATABASES_API_KEY;
  if (!key) {
    console.log("[VDB] ⚠ VEHICLEDATABASES_API_KEY not set — skipping");
    return;
  }

  console.log("[VDB] Fetching market value for Raptor...");
  const url = `https://api.vehicledatabases.com/market-value/${RAPTOR_VIN}?mileage=${MILEAGE}&state=${STATE}`;

  const res = await fetch(url, {
    headers: {
      "x-AuthKey": key,
      Accept: "application/json",
    },
  });

  console.log(`[VDB] Status: ${res.status} ${res.statusText}`);
  const data = await res.json();
  console.log("[VDB] Response:", JSON.stringify(data, null, 2));
}

async function testNADA() {
  const key = process.env.NADA_RAPIDAPI_KEY;
  if (!key) {
    console.log("[NADA] ⚠ NADA_RAPIDAPI_KEY not set — skipping");
    return;
  }

  const body = {
    AutomobileInfo: {
      VIN: RAPTOR_VIN,
      ModelYear: "2020",
    },
    Period: new Date().toISOString().split("T")[0],
    Mileage: String(MILEAGE),
  };

  // Try multiple endpoint patterns to find the correct one
  const endpoints = [
    "https://nada-vehicle-pricing.p.rapidapi.com/GetReport",
    "https://nada-vehicle-pricing.p.rapidapi.com/NADAVehiclePricing/GetReport",
    "https://nada-vehicle-pricing.p.rapidapi.com/api/GetReport",
    "https://nada-vehicle-pricing.p.rapidapi.com/v1/GetReport",
  ];

  for (const url of endpoints) {
    console.log(`[NADA] Trying: ${url}`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-rapidapi-host": "nada-vehicle-pricing.p.rapidapi.com",
          "x-rapidapi-key": key,
        },
        body: JSON.stringify(body),
      });

      console.log(`[NADA]   Status: ${res.status}`);
      const data = await res.text();
      if (res.status !== 404) {
        try {
          const parsed = JSON.parse(data);
          console.log("[NADA]   Response:", JSON.stringify(parsed, null, 2).substring(0, 1500));
        } catch {
          console.log("[NADA]   Raw:", data.substring(0, 500));
        }
        return; // Found a working endpoint
      } else {
        console.log("[NADA]   404 — trying next...");
      }
    } catch (err) {
      console.log(`[NADA]   Error: ${err}`);
    }
  }

  // Try lowercase and alternate names
  const altEndpoints = [
    { url: "/getreport", method: "POST", body: JSON.stringify(body) },
    { url: "/report", method: "POST", body: JSON.stringify(body) },
    { url: "/valuation", method: "POST", body: JSON.stringify(body) },
    { url: "/vin-lookup", method: "POST", body: JSON.stringify({ vin: RAPTOR_VIN, mileage: MILEAGE }) },
    { url: "/", method: "POST", body: JSON.stringify(body) },
    { url: "/vin/" + RAPTOR_VIN, method: "GET", body: undefined },
  ];

  for (const ep of altEndpoints) {
    const url = `https://nada-vehicle-pricing.p.rapidapi.com${ep.url}`;
    console.log(`[NADA] Trying ${ep.method} ${ep.url}`);
    try {
      const res = await fetch(url, {
        method: ep.method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-rapidapi-host": "nada-vehicle-pricing.p.rapidapi.com",
          "x-rapidapi-key": key,
        },
        ...(ep.body ? { body: ep.body } : {}),
      });
      console.log(`[NADA]   Status: ${res.status}`);
      if (res.status !== 404) {
        const data = await res.text();
        console.log("[NADA]   Response:", data.substring(0, 800));
        return;
      }
      const errText = await res.text();
      console.log(`[NADA]   ${errText.substring(0, 200)}`);
    } catch (err) {
      console.log(`[NADA]   Error: ${err}`);
    }
  }
  console.log("[NADA] All endpoints returned 404 — API may require subscription upgrade or different host");
}

async function main() {
  console.log(`\nTesting pricing APIs with VIN: ${RAPTOR_VIN}\n`);
  console.log("=".repeat(60));

  await testVehicleDatabases();
  console.log("\n" + "=".repeat(60) + "\n");
  await testNADA();

  console.log("\n" + "=".repeat(60));
  console.log("Done.");
}

main().catch(console.error);
