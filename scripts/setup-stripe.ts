/**
 * One-time Stripe setup script.
 * Creates products, prices, and webhook endpoint for VeriBuy.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... WEBHOOK_URL=https://app.getveribuy.com npx tsx scripts/setup-stripe.ts
 *
 * After running, copy the printed env vars into Vercel:
 *   vercel env add STRIPE_SECRET_KEY production
 *   vercel env add STRIPE_WEBHOOK_SECRET production
 *   ... etc
 */

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://app.getveribuy.com";

if (!STRIPE_SECRET_KEY) {
  console.error("Error: STRIPE_SECRET_KEY env var is required");
  console.error("Usage: STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/setup-stripe.ts");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { typescript: true });

async function main() {
  console.log("Setting up Stripe for VeriBuy...\n");

  // ── 1. Subscription Products ──────────────────────────────────────

  console.log("Creating subscription products...");

  const baseProd = await stripe.products.create({
    name: "VeriBuy Base",
    description: "Base plan — 25 inspections per month",
    metadata: { tier: "BASE" },
  });
  const basePrice = await stripe.prices.create({
    product: baseProd.id,
    unit_amount: 9900, // $99.00/mo — adjust as needed
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { tier: "BASE" },
  });
  console.log(`  ✓ Base: ${baseProd.id} → price ${basePrice.id} ($${(basePrice.unit_amount! / 100).toFixed(2)}/mo)`);

  const proProd = await stripe.products.create({
    name: "VeriBuy Pro",
    description: "Pro plan — 100 inspections per month",
    metadata: { tier: "PRO" },
  });
  const proPrice = await stripe.prices.create({
    product: proProd.id,
    unit_amount: 29900, // $299.00/mo — adjust as needed
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { tier: "PRO" },
  });
  console.log(`  ✓ Pro:  ${proProd.id} → price ${proPrice.id} ($${(proPrice.unit_amount! / 100).toFixed(2)}/mo)`);

  // ── 2. One-Time Inspection Pack Products ──────────────────────────

  console.log("\nCreating inspection pack products...");

  const packs = [
    { name: "1 Inspection Pack", size: 1, amount: 3999 },
    { name: "3 Inspection Pack", size: 3, amount: 9999 },
    { name: "10 Inspection Pack", size: 10, amount: 24999 },
  ];

  const packPrices: Record<number, string> = {};
  for (const pack of packs) {
    const prod = await stripe.products.create({
      name: `VeriBuy ${pack.name}`,
      description: `${pack.size} additional inspection${pack.size > 1 ? "s" : ""}`,
      metadata: { packSize: String(pack.size) },
    });
    const price = await stripe.prices.create({
      product: prod.id,
      unit_amount: pack.amount,
      currency: "usd",
      metadata: { packSize: String(pack.size) },
    });
    packPrices[pack.size] = price.id;
    console.log(`  ✓ ${pack.name}: ${prod.id} → price ${price.id} ($${(pack.amount / 100).toFixed(2)})`);
  }

  // ── 3. Webhook Endpoint ───────────────────────────────────────────

  console.log("\nCreating webhook endpoint...");

  const webhook = await stripe.webhookEndpoints.create({
    url: `${WEBHOOK_URL}/api/webhooks/stripe`,
    enabled_events: [
      "checkout.session.completed",
      "invoice.paid",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
    ],
    description: "VeriBuy production webhook",
  });
  console.log(`  ✓ Webhook: ${webhook.id} → ${webhook.url}`);

  // ── 4. Customer Portal Configuration ──────────────────────────────

  console.log("\nConfiguring Customer Portal...");

  try {
    await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "VeriBuy — Manage Your Subscription",
      },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price"],
          products: [
            { product: baseProd.id, prices: [basePrice.id] },
            { product: proProd.id, prices: [proPrice.id] },
          ],
        },
      },
    });
    console.log("  ✓ Customer Portal configured (plan switching, cancellation, invoices)");
  } catch (err: any) {
    console.log(`  ⚠ Portal config skipped: ${err.message}`);
    console.log("    You may need to configure this manually in the Stripe Dashboard.");
  }

  // ── 5. Print env vars ─────────────────────────────────────────────

  console.log("\n" + "=".repeat(60));
  console.log("SETUP COMPLETE! Add these env vars to Vercel:\n");
  console.log(`STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}`);
  console.log(`STRIPE_WEBHOOK_SECRET=${webhook.secret}`);
  console.log(`STRIPE_PRICE_BASE_MONTHLY=${basePrice.id}`);
  console.log(`STRIPE_PRICE_PRO_MONTHLY=${proPrice.id}`);
  console.log(`STRIPE_PRICE_1_INSPECTION=${packPrices[1]}`);
  console.log(`STRIPE_PRICE_3_INSPECTIONS=${packPrices[3]}`);
  console.log(`STRIPE_PRICE_10_INSPECTIONS=${packPrices[10]}`);
  console.log("\n" + "=".repeat(60));
  console.log("\nTo add each one to Vercel, run:");
  console.log('  echo "VALUE" | npx vercel env add VAR_NAME production\n');
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
