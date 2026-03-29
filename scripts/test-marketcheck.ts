import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  console.log("API key exists:", !!apiKey);
  if (!apiKey) { console.log("No MARKETCHECK_API_KEY set"); return; }

  // Simple search: 2015 Honda CR-V, nationwide
  const params = new URLSearchParams({
    api_key: apiKey,
    year: "2015",
    make: "Honda",
    model: "CR-V",
    rows: "5",
    car_type: "used",
  });

  const url = `https://api.marketcheck.com/v2/search/car/active?${params}`;
  console.log("Searching: 2015 Honda CR-V (nationwide, no filters)...");

  const res = await fetch(url);
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Found:", data.num_found, "listings");

  if (data.listings?.length > 0) {
    const withPrice = data.listings.filter((l: any) => l.price > 0);
    console.log(`  With valid price: ${withPrice.length}`);
    for (const l of withPrice.slice(0, 5)) {
      console.log(`  $${l.price} — ${l.heading} — ${l.miles} mi — ${l.dealer?.city}, ${l.dealer?.state}`);
    }
  }

  if (data.error) console.log("Error:", JSON.stringify(data.error));
  if (data.message) console.log("Message:", data.message);

  // Also try with trim=EX and drivetrain=AWD
  console.log("\nWith trim=EX, drivetrain=AWD...");
  params.set("trim", "EX");
  params.set("drivetrain", "awd");
  const url2 = `https://api.marketcheck.com/v2/search/car/active?${params}`;
  const res2 = await fetch(url2);
  const data2 = await res2.json();
  console.log("Found:", data2.num_found, "listings");
  if (data2.listings?.length > 0) {
    for (const l of data2.listings.slice(0, 3)) {
      console.log(`  $${l.price} — ${l.heading} — ${l.miles} mi`);
    }
  }

  // Try sold listings
  console.log("\nSold listings (no trim filter)...");
  const soldParams = new URLSearchParams({
    api_key: apiKey,
    year: "2015",
    make: "Honda",
    model: "CR-V",
    rows: "5",
    car_type: "used",
  });
  const urlSold = `https://api.marketcheck.com/v2/search/car/sold?${soldParams}`;
  const resSold = await fetch(urlSold);
  console.log("Sold status:", resSold.status);
  const dataSold = await resSold.json();
  console.log("Found:", dataSold.num_found, "sold listings");
  if (dataSold.listings?.length > 0) {
    for (const l of dataSold.listings.slice(0, 3)) {
      console.log(`  $${l.price} — ${l.heading} — ${l.miles} mi`);
    }
  }
  if (dataSold.error) console.log("Error:", JSON.stringify(dataSold.error));
}

main().catch(console.error);
