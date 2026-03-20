import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { getStripe, INSPECTION_PACKS, SUBSCRIPTION_PLANS, getPlanByTier } from "@/lib/stripe";
import { sendUpgradeRequestEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const billingRouter = router({
  createCheckoutSession: protectedProcedure
    .input(z.object({ packSize: z.union([z.literal(1), z.literal(3), z.literal(10)]) }))
    .mutation(async ({ ctx, input }) => {
      const pack = INSPECTION_PACKS.find((p) => p.size === input.packSize);
      if (!pack) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid pack size" });
      if (!pack.priceId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe price not configured for this pack" });
      }

      const purchase = await ctx.db.inspectionPackPurchase.create({
        data: {
          orgId: ctx.orgId,
          stripeSessionId: "pending",
          packSize: pack.size,
          amountCents: pack.priceCents,
          status: "pending",
          purchasedById: ctx.userId,
        },
      });

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: pack.priceId, quantity: 1 }],
        metadata: {
          orgId: ctx.orgId,
          packSize: String(pack.size),
          purchaseId: purchase.id,
        },
        success_url: `${APP_URL}/dashboard/settings?checkout=success`,
        cancel_url: `${APP_URL}/dashboard/settings?checkout=cancelled`,
      });

      await ctx.db.inspectionPackPurchase.update({
        where: { id: purchase.id },
        data: { stripeSessionId: session.id },
      });

      return { url: session.url };
    }),

  requestUpgrade: protectedProcedure
    .input(z.object({ message: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.orgId },
        select: {
          name: true,
          subscription: true,
          maxInspectionsPerMonth: true,
          bonusInspections: true,
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { name: true, email: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const usedThisMonth = await ctx.db.inspection.count({
        where: { orgId: ctx.orgId, createdAt: { gte: startOfMonth } },
      });

      await sendUpgradeRequestEmail({
        orgName: org.name,
        orgId: ctx.orgId,
        currentPlan: org.subscription,
        monthlyLimit: org.maxInspectionsPerMonth,
        bonusInspections: org.bonusInspections,
        usedThisMonth,
        contactName: user.name,
        contactEmail: user.email,
        message: input.message,
      });

      return { success: true };
    }),

  // ── Recurring Subscriptions ───────────────────────────────────────

  createSubscription: protectedProcedure
    .input(z.object({ tier: z.enum(["BASE", "PRO"]) }))
    .mutation(async ({ ctx, input }) => {
      const plan = getPlanByTier(input.tier);
      if (!plan || !plan.priceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid plan or price not configured" });
      }

      const stripe = getStripe();

      // Find or create Stripe customer for this org
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.orgId },
        select: { stripeCustomerId: true, name: true },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      let customerId = org.stripeCustomerId;
      if (!customerId) {
        const user = await ctx.db.user.findUnique({
          where: { id: ctx.userId },
          select: { email: true },
        });
        const customer = await stripe.customers.create({
          email: user?.email ?? undefined,
          name: org.name,
          metadata: { orgId: ctx.orgId },
        });
        customerId = customer.id;
        await ctx.db.organization.update({
          where: { id: ctx.orgId },
          data: { stripeCustomerId: customerId },
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: plan.priceId, quantity: 1 }],
        metadata: {
          orgId: ctx.orgId,
          tier: input.tier,
        },
        success_url: `${APP_URL}/dashboard/settings?checkout=subscription_success`,
        cancel_url: `${APP_URL}/dashboard/settings?checkout=cancelled`,
      });

      return { url: session.url };
    }),

  createPortalSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.orgId },
        select: { stripeCustomerId: true },
      });
      if (!org?.stripeCustomerId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No billing account found. Subscribe to a plan first." });
      }

      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${APP_URL}/dashboard/settings`,
      });

      return { url: session.url };
    }),

  getSubscriptionStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.orgId },
        select: {
          subscription: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          maxInspectionsPerMonth: true,
          bonusInspections: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        tier: org.subscription,
        status: org.subscriptionStatus,
        currentPeriodEnd: org.currentPeriodEnd,
        maxInspectionsPerMonth: org.maxInspectionsPerMonth,
        bonusInspections: org.bonusInspections,
        hasStripeCustomer: !!org.stripeCustomerId,
        hasSubscription: !!org.stripeSubscriptionId,
      };
    }),
});
