import { NextResponse } from "next/server";
import { getStripe, getPlanByPriceId, getPlanByTier } from "@/lib/stripe";
import { db } from "@/server/db";

// Stripe webhook event data types don't always align perfectly with the SDK.
// We use loose typing for webhook payloads since they come directly from Stripe's API.
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: any;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      /* ──────────────────────────────────────────────────────────── */
      /*  Checkout completed (one-time packs OR new subscriptions)   */
      /* ──────────────────────────────────────────────────────────── */
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode === "subscription") {
          // ── New subscription ──
          const orgId = session.metadata?.orgId;
          const tier = session.metadata?.tier;
          if (!orgId || !tier) {
            console.error("Missing subscription metadata:", session.id);
            break;
          }

          const plan = getPlanByTier(tier);
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;

          // Fetch subscription to get current period end
          let periodEnd: Date | undefined;
          if (subscriptionId) {
            const stripe = getStripe();
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            // In Stripe v20+, current_period_end is on subscription items
            const itemEnd = (sub as any).items?.data?.[0]?.current_period_end;
            if (itemEnd) periodEnd = new Date(itemEnd * 1000);
          }

          await db.organization.update({
            where: { id: orgId },
            data: {
              stripeSubscriptionId: subscriptionId ?? undefined,
              stripePriceId: plan?.priceId ?? undefined,
              subscription: tier as "BASE" | "PRO" | "ENTERPRISE",
              subscriptionStatus: "active",
              maxInspectionsPerMonth: plan?.inspectionsPerMonth ?? 25,
              currentPeriodEnd: periodEnd,
            },
          });
          console.log(`Subscription created: ${tier} for org ${orgId}`);
        } else {
          // ── One-time pack purchase (existing logic) ──
          const orgId = session.metadata?.orgId;
          const packSize = parseInt(session.metadata?.packSize ?? "0", 10);
          const purchaseId = session.metadata?.purchaseId;

          if (!orgId || !packSize || !purchaseId) {
            console.error("Missing pack metadata:", session.id);
            break;
          }

          await db.$transaction([
            db.organization.update({
              where: { id: orgId },
              data: { bonusInspections: { increment: packSize } },
            }),
            db.inspectionPackPurchase.update({
              where: { id: purchaseId },
              data: { status: "completed", completedAt: new Date() },
            }),
          ]);
          console.log(`Pack purchase completed: ${packSize} inspections for org ${orgId}`);
        }
        break;
      }

      /* ──────────────────────────────────────────────────────────── */
      /*  Invoice paid — subscription renewal succeeded              */
      /* ──────────────────────────────────────────────────────────── */
      case "invoice.paid": {
        const invoice = event.data.object;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!subscriptionId) break;

        // Only process renewal invoices (not the first one)
        if (invoice.billing_reason === "subscription_create") break;

        const org = await db.organization.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          select: { id: true },
        });

        if (org) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const itemEnd = (sub as any).items?.data?.[0]?.current_period_end;

          await db.organization.update({
            where: { id: org.id },
            data: {
              subscriptionStatus: "active",
              currentPeriodEnd: itemEnd ? new Date(itemEnd * 1000) : undefined,
            },
          });
          console.log(`Subscription renewed for org ${org.id}`);
        }
        break;
      }

      /* ──────────────────────────────────────────────────────────── */
      /*  Subscription updated — plan change via Customer Portal     */
      /* ──────────────────────────────────────────────────────────── */
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const org = await db.organization.findUnique({
          where: { stripeSubscriptionId: subscription.id },
          select: { id: true },
        });

        if (org) {
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const plan = priceId ? getPlanByPriceId(priceId) : null;
          const itemEnd = subscription.items?.data?.[0]?.current_period_end;

          await db.organization.update({
            where: { id: org.id },
            data: {
              stripePriceId: priceId ?? undefined,
              subscription: plan ? (plan.tier as "BASE" | "PRO" | "ENTERPRISE") : undefined,
              subscriptionStatus: subscription.status,
              maxInspectionsPerMonth: plan?.inspectionsPerMonth ?? undefined,
              currentPeriodEnd: itemEnd ? new Date(itemEnd * 1000) : undefined,
            },
          });
          console.log(`Subscription updated for org ${org.id}: ${plan?.tier ?? "unknown"} (${subscription.status})`);
        }
        break;
      }

      /* ──────────────────────────────────────────────────────────── */
      /*  Subscription deleted — cancelled                           */
      /* ──────────────────────────────────────────────────────────── */
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const org = await db.organization.findUnique({
          where: { stripeSubscriptionId: subscription.id },
          select: { id: true },
        });

        if (org) {
          await db.organization.update({
            where: { id: org.id },
            data: {
              subscription: "BASE",
              subscriptionStatus: "cancelled",
              maxInspectionsPerMonth: 25,
              stripeSubscriptionId: null,
              stripePriceId: null,
              currentPeriodEnd: null,
            },
          });
          console.log(`Subscription cancelled for org ${org.id} — downgraded to BASE`);
        }
        break;
      }

      /* ──────────────────────────────────────────────────────────── */
      /*  Payment failed — mark as past_due                          */
      /* ──────────────────────────────────────────────────────────── */
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!subscriptionId) break;

        const org = await db.organization.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          select: { id: true },
        });

        if (org) {
          await db.organization.update({
            where: { id: org.id },
            data: { subscriptionStatus: "past_due" },
          });
          console.log(`Payment failed for org ${org.id} — marked past_due`);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
