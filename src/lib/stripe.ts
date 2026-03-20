import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

export const INSPECTION_PACKS = [
  {
    size: 1,
    label: "1 Inspection",
    priceCents: 3999,
    priceDisplay: "$39.99",
    priceId: process.env.STRIPE_PRICE_1_INSPECTION ?? "",
  },
  {
    size: 3,
    label: "3 Inspections",
    priceCents: 9999,
    priceDisplay: "$99.99",
    priceId: process.env.STRIPE_PRICE_3_INSPECTIONS ?? "",
  },
  {
    size: 10,
    label: "10 Inspections",
    priceCents: 24999,
    priceDisplay: "$249.99",
    priceId: process.env.STRIPE_PRICE_10_INSPECTIONS ?? "",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Recurring Subscription Plans                                       */
/* ------------------------------------------------------------------ */

export const SUBSCRIPTION_PLANS = [
  {
    tier: "BASE" as const,
    label: "Base",
    inspectionsPerMonth: 25,
    priceId: process.env.STRIPE_PRICE_BASE_MONTHLY ?? "",
  },
  {
    tier: "PRO" as const,
    label: "Pro",
    inspectionsPerMonth: 100,
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  },
  {
    tier: "ENTERPRISE" as const,
    label: "Enterprise",
    inspectionsPerMonth: 9999,
    priceId: null, // Contact only — no self-serve checkout
  },
] as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_PLANS)[number]["tier"];

export function getPlanByTier(tier: string) {
  return SUBSCRIPTION_PLANS.find((p) => p.tier === tier);
}

export function getPlanByPriceId(priceId: string) {
  return SUBSCRIPTION_PLANS.find((p) => p.priceId === priceId);
}
