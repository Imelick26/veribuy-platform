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

/* ------------------------------------------------------------------ */
/*  Subscription Plans — Annual billing                                */
/* ------------------------------------------------------------------ */

export const SUBSCRIPTION_PLANS = [
  {
    tier: "CORE" as const,
    label: "Core",
    monthlyEquiv: 299_00,
    annualPriceCents: 3_588_00,
    inspectionsPerMonth: 10,
    priceId: process.env.STRIPE_PRICE_CORE_ANNUAL ?? "",
    productId: process.env.STRIPE_PRODUCT_CORE ?? "",
  },
  {
    tier: "BASE" as const,
    label: "Base",
    monthlyEquiv: 599_00,
    annualPriceCents: 7_188_00,
    inspectionsPerMonth: 50,
    priceId: process.env.STRIPE_PRICE_BASE_ANNUAL ?? "",
    productId: process.env.STRIPE_PRODUCT_BASE ?? "",
  },
  {
    tier: "PRO" as const,
    label: "Pro",
    monthlyEquiv: 1_299_00,
    annualPriceCents: 15_588_00,
    inspectionsPerMonth: 125,
    priceId: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
    productId: process.env.STRIPE_PRODUCT_PRO ?? "",
  },
  {
    tier: "ENTERPRISE" as const,
    label: "Enterprise",
    monthlyEquiv: 3_999_00,
    annualPriceCents: 47_988_00,
    inspectionsPerMonth: 400,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL ?? "",
    productId: process.env.STRIPE_PRODUCT_ENTERPRISE ?? "",
  },
] as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_PLANS)[number]["tier"];

/** Client-safe pricing info (no secrets) */
export const PLAN_PRICING = SUBSCRIPTION_PLANS.map((p) => ({
  tier: p.tier,
  label: p.label,
  annualPriceCents: p.annualPriceCents,
  monthlyEquiv: p.monthlyEquiv,
  inspectionsPerMonth: p.inspectionsPerMonth,
}));

/* ------------------------------------------------------------------ */
/*  Overage — per-report pricing by tier                               */
/* ------------------------------------------------------------------ */

export const OVERAGE_PRICES: Record<SubscriptionTier, {
  priceCents: number;
  priceDisplay: string;
  priceId: string;
}> = {
  CORE: {
    priceCents: 19_99,
    priceDisplay: "$19.99",
    priceId: process.env.STRIPE_PRICE_OVERAGE_CORE ?? "",
  },
  BASE: {
    priceCents: 14_99,
    priceDisplay: "$14.99",
    priceId: process.env.STRIPE_PRICE_OVERAGE_BASE ?? "",
  },
  PRO: {
    priceCents: 11_99,
    priceDisplay: "$11.99",
    priceId: process.env.STRIPE_PRICE_OVERAGE_PRO ?? "",
  },
  ENTERPRISE: {
    priceCents: 9_99,
    priceDisplay: "$9.99",
    priceId: process.env.STRIPE_PRICE_OVERAGE_ENTERPRISE ?? "",
  },
};

/* ------------------------------------------------------------------ */
/*  Lookup helpers                                                     */
/* ------------------------------------------------------------------ */

export function getPlanByTier(tier: string) {
  return SUBSCRIPTION_PLANS.find((p) => p.tier === tier);
}

export function getPlanByPriceId(priceId: string) {
  return SUBSCRIPTION_PLANS.find((p) => p.priceId === priceId);
}

export function getOveragePriceForTier(tier: string) {
  return OVERAGE_PRICES[tier as SubscriptionTier] ?? OVERAGE_PRICES.CORE;
}

/**
 * Create a custom one-off Stripe price for a negotiated deal.
 * Attaches it to the existing product for the given tier.
 */
export async function createCustomPrice(
  tier: SubscriptionTier,
  amountCents: number,
  orgId: string,
): Promise<string> {
  const plan = getPlanByTier(tier);
  if (!plan?.productId) {
    throw new Error(`No Stripe product configured for tier ${tier}`);
  }

  const stripe = getStripe();
  const price = await stripe.prices.create({
    product: plan.productId,
    unit_amount: amountCents,
    currency: "usd",
    recurring: { interval: "year" },
    metadata: { orgId, tier, custom: "true" },
  });

  return price.id;
}
