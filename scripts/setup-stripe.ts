/**
 * Stripe setup script — creates all VeriBuy products, prices, and webhook.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... WEBHOOK_URL=https://app.getveribuy.com npx tsx scripts/setup-stripe.ts
 *
 * After running, copy the printed env vars into your .env / Vercel.
 *
 * Idempotent: checks for existing products by metadata before creating.
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

/* ── Pricing config ────────────────────────────────────────────────── */

const SUBSCRIPTION_TIERS = [
  { tier: "CORE", label: "Core", annualCents: 358800, inspections: 10 },
  { tier: "BASE", label: "Base", annualCents: 718800, inspections: 50 },
  { tier: "PRO", label: "Pro", annualCents: 1558800, inspections: 125 },
  { tier: "ENTERPRISE", label: "Enterprise", annualCents: 4798800, inspections: 400 },
];

const OVERAGE_TIERS = [
  { tier: "CORE", label: "Core", priceCents: 1999 },
  { tier: "BASE", label: "Base", priceCents: 1499 },
  { tier: "PRO", label: "Pro", priceCents: 1199 },
  { tier: "ENTERPRISE", label: "Enterprise", priceCents: 999 },
];

/* ── Helpers ────────────────────────────────────────────────────────── */

async function findExistingProduct(metaKey: string, metaValue: string): Promise<Stripe.Product | null> {
  const products = await stripe.products.list({ limit: 100 });
  return products.data.find((p) => p.metadata[metaKey] === metaValue && p.active) ?? null;
}

async function findExistingPrice(productId: string): Promise<Stripe.Price | null> {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 10 });
  return prices.data[0] ?? null;
}

/* ── Main ───────────────────────────────────────────────────────────── */

async function main() {
  console.log("Setting up Stripe for VeriBuy (4-tier annual + overage)...\n");

  const envVars: Record<string, string> = {};

  // ── 1. Subscription Products (annual billing) ─────────────────────

  console.log("Creating subscription products...");

  for (const plan of SUBSCRIPTION_TIERS) {
    let product = await findExistingProduct("veribuy_tier", plan.tier);
    if (!product) {
      product = await stripe.products.create({
        name: `VeriBuy ${plan.label}`,
        description: `${plan.label} plan — ${plan.inspections} inspections per month, billed annually`,
        metadata: { veribuy_tier: plan.tier },
      });
    }

    let price = await findExistingPrice(product.id);
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.annualCents,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { veribuy_tier: plan.tier },
      });
    }

    const envKey = `STRIPE_PRICE_${plan.tier}_ANNUAL`;
    envVars[envKey] = price.id;
    console.log(`  + ${plan.label}: ${product.id} -> price ${price.id} ($${(plan.annualCents / 100).toFixed(2)}/yr)`);
  }

  // ── 2. Overage Products (per-report, one-time) ────────────────────

  console.log("\nCreating overage products...");

  for (const overage of OVERAGE_TIERS) {
    let product = await findExistingProduct("veribuy_overage", overage.tier);
    if (!product) {
      product = await stripe.products.create({
        name: `VeriBuy Additional Report (${overage.label})`,
        description: `1 additional inspection report for ${overage.label} tier`,
        metadata: { veribuy_overage: overage.tier },
      });
    }

    let price = await findExistingPrice(product.id);
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: overage.priceCents,
        currency: "usd",
        metadata: { veribuy_overage: overage.tier },
      });
    }

    const envKey = `STRIPE_PRICE_OVERAGE_${overage.tier}`;
    envVars[envKey] = price.id;
    console.log(`  + ${overage.label} overage: ${product.id} -> price ${price.id} ($${(overage.priceCents / 100).toFixed(2)})`);
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
  envVars["STRIPE_WEBHOOK_SECRET"] = webhook.secret!;
  console.log(`  + Webhook: ${webhook.id} -> ${webhook.url}`);

  // ── 4. Customer Portal Configuration ──────────────────────────────

  console.log("\nConfiguring Customer Portal...");

  try {
    // Collect all subscription products/prices for portal plan switching
    const portalProducts: Stripe.BillingPortal.ConfigurationCreateParams.Features.SubscriptionUpdate.Product[] = [];
    for (const plan of SUBSCRIPTION_TIERS) {
      const product = await findExistingProduct("veribuy_tier", plan.tier);
      const price = product ? await findExistingPrice(product.id) : null;
      if (product && price) {
        portalProducts.push({ product: product.id, prices: [price.id] });
      }
    }

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
          products: portalProducts,
        },
      },
    });
    console.log("  + Customer Portal configured (plan switching, cancellation, invoices)");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ! Portal config skipped: ${message}`);
    console.log("    You may need to configure this manually in the Stripe Dashboard.");
  }

  // ── 5. Print env vars ─────────────────────────────────────────────

  console.log("\n" + "=".repeat(60));
  console.log("SETUP COMPLETE! Add these env vars:\n");
  for (const [key, value] of Object.entries(envVars)) {
    console.log(`${key}=${value}`);
  }
  console.log("\n" + "=".repeat(60));
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
