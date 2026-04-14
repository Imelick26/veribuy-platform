import { z } from "zod/v4";
import { router, superAdminProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import { getStripe, getPlanByTier, createCustomPrice } from "@/lib/stripe";

export const adminRouter = router({
  // ─── Platform Stats ─────────────────────────────────────────
  stats: superAdminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrgs,
      totalUsers,
      totalInspections,
      inspectionsThisMonth,
      completedInspections,
      totalReports,
      reportViewsAgg,
      orgsByTier,
    ] = await Promise.all([
      ctx.db.organization.count(),
      ctx.db.user.count(),
      ctx.db.inspection.count(),
      ctx.db.inspection.count({ where: { createdAt: { gte: firstOfMonth } } }),
      ctx.db.inspection.count({ where: { status: "COMPLETED" } }),
      ctx.db.report.count(),
      ctx.db.report.aggregate({ _sum: { viewCount: true } }),
      ctx.db.organization.groupBy({ by: ["subscription"], _count: true }),
    ]);

    const tierCounts: Record<string, number> = { CORE: 0, BASE: 0, PRO: 0, ENTERPRISE: 0 };
    for (const g of orgsByTier) {
      tierCounts[g.subscription] = g._count;
    }

    return {
      totalOrgs,
      totalUsers,
      totalInspections,
      inspectionsThisMonth,
      completedInspections,
      activeInspections: totalInspections - completedInspections,
      totalReports,
      totalReportViews: reportViewsAgg._sum.viewCount ?? 0,
      orgsByTier: tierCounts,
    };
  }),

  // List all organizations with stats
  listOrgs: superAdminProcedure.query(async ({ ctx }) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const orgs = await ctx.db.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        subscription: true,
        maxInspectionsPerMonth: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get monthly inspection counts
    const counts = await ctx.db.inspection.groupBy({
      by: ["orgId"],
      where: { createdAt: { gte: startOfMonth } },
      _count: true,
    });
    const countMap = new Map(counts.map((c) => [c.orgId, c._count]));

    return orgs.map((org) => ({
      ...org,
      inspectionsThisMonth: countMap.get(org.id) || 0,
    }));
  }),

  // Create a new dealer organization + owner
  createOrg: superAdminProcedure
    .input(
      z.object({
        orgName: z.string().min(1),
        orgType: z.enum(["DEALER", "INSPECTOR_FIRM", "INSURANCE", "INDIVIDUAL"]),
        ownerName: z.string().min(1),
        ownerEmail: z.email(),
        subscription: z.enum(["CORE", "BASE", "PRO", "ENTERPRISE"]),
        maxInspectionsPerMonth: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { email: input.ownerEmail },
      });
      if (existing) throw new Error("Email already registered");

      const slug = input.orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      const tempPassword = crypto.randomUUID().slice(0, 12);
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const result = await ctx.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: input.orgName,
            slug,
            type: input.orgType,
            subscription: input.subscription,
            maxInspectionsPerMonth: input.maxInspectionsPerMonth,
          },
        });
        const user = await tx.user.create({
          data: {
            email: input.ownerEmail,
            name: input.ownerName,
            passwordHash,
            role: "OWNER",
            orgId: org.id,
          },
        });
        return { org, user };
      });

      return { orgId: result.org.id, userId: result.user.id, tempPassword };
    }),

  // Update org plan / limits
  updateOrg: superAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        subscription: z.enum(["CORE", "BASE", "PRO", "ENTERPRISE"]).optional(),
        maxInspectionsPerMonth: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, ...data } = input;
      return ctx.db.organization.update({ where: { id: orgId }, data });
    }),

  // Get single org detail
  getOrgDetail: superAdminProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const org = await ctx.db.organization.findUnique({
        where: { id: input.orgId },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
              _count: { select: { inspections: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!org) throw new Error("Organization not found");

      // Fetch current Stripe price amount for display
      let stripePriceAmountCents: number | null = null;
      if (org.stripePriceId) {
        try {
          const stripe = getStripe();
          const price = await stripe.prices.retrieve(org.stripePriceId);
          stripePriceAmountCents = price.unit_amount;
        } catch { /* price may have been deleted */ }
      }

      const inspectionsThisMonth = await ctx.db.inspection.count({
        where: { orgId: input.orgId, createdAt: { gte: startOfMonth } },
      });

      const totalInspections = await ctx.db.inspection.count({
        where: { orgId: input.orgId },
      });

      const recentInspections = await ctx.db.inspection.findMany({
        where: { orgId: input.orgId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          vehicle: { select: { id: true, year: true, make: true, model: true, vin: true } },
          inspector: { select: { name: true } },
          marketAnalysis: { select: { recommendation: true, adjustedPrice: true } },
          _count: { select: { findings: true } },
        },
      });

      return { ...org, inspectionsThisMonth, totalInspections, recentInspections, stripePriceAmountCents };
    }),

  // ─── Users (cross-org) ─────────────────────────────────────
  listUsers: superAdminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        search: z.string().optional(),
        role: z.enum(["SUPER_ADMIN", "OWNER", "MANAGER", "INSPECTOR", "VIEWER"]).optional(),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, search, role, orgId } = input;
      const where: Record<string, unknown> = {};
      if (role) where.role = role;
      if (orgId) where.orgId = orgId;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      const users = await ctx.db.user.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
          org: { select: { id: true, name: true, slug: true } },
          _count: { select: { inspections: true } },
        },
      });

      let nextCursor: string | undefined;
      if (users.length > limit) {
        const next = users.pop()!;
        nextCursor = next.id;
      }
      return { users, nextCursor };
    }),

  updateUser: superAdminProcedure
    .input(
      z.object({
        id: z.string(),
        role: z.enum(["SUPER_ADMIN", "OWNER", "MANAGER", "INSPECTOR", "VIEWER"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, role } = input;
      const user = await ctx.db.user.findUnique({ where: { id } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const data: Record<string, unknown> = {};
      if (role !== undefined) data.role = role;

      const updated = await ctx.db.user.update({ where: { id }, data });

      await ctx.db.auditLog.create({
        data: {
          action: "USER_ROLE_CHANGE",
          entityType: "User",
          entityId: id,
          metadata: { newRole: role, previousRole: user.role } as unknown as Prisma.InputJsonValue,
          userId: ctx.userId,
        },
      });

      return updated;
    }),

  setTempPassword: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({ where: { id: input.id } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const tempPassword = Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      await ctx.db.user.update({
        where: { id: input.id },
        data: { passwordHash },
      });

      await ctx.db.auditLog.create({
        data: {
          action: "PASSWORD_RESET",
          entityType: "User",
          entityId: input.id,
          metadata: { resetBy: ctx.userId },
          userId: ctx.userId,
        },
      });

      return { tempPassword };
    }),

  // ─── Inspections (cross-org) ────────────────────────────────
  listInspections: superAdminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        status: z.enum([
          "CREATED", "VIN_DECODED", "RISK_REVIEWED", "MEDIA_CAPTURE",
          "FINDINGS_RECORDED", "MARKET_PRICED", "REVIEWED", "COMPLETED", "CANCELLED",
        ]).optional(),
        orgId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, status, orgId } = input;
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (orgId) where.orgId = orgId;

      const inspections = await ctx.db.inspection.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          vehicle: { select: { year: true, make: true, model: true, vin: true } },
          inspector: { select: { name: true } },
          org: { select: { id: true, name: true } },
          _count: { select: { findings: true, media: true } },
        },
      });

      let nextCursor: string | undefined;
      if (inspections.length > limit) {
        const next = inspections.pop()!;
        nextCursor = next.id;
      }
      return { inspections, nextCursor };
    }),

  // ─── Audit Logs ─────────────────────────────────────────────
  listAuditLogs: superAdminProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        userId: z.string().optional(),
        entityType: z.string().optional(),
        action: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, userId, entityType, action } = input;
      const where: Record<string, unknown> = {};
      if (userId) where.userId = userId;
      if (entityType) where.entityType = entityType;
      if (action) where.action = { contains: action, mode: "insensitive" };

      const logs = await ctx.db.auditLog.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      let nextCursor: string | undefined;
      if (logs.length > limit) {
        const next = logs.pop()!;
        nextCursor = next.id;
      }
      return { logs, nextCursor };
    }),

  // ─── Stripe Subscription Management ────────────────────────

  createSubscription: superAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        tier: z.enum(["CORE", "BASE", "PRO", "ENTERPRISE"]),
        customAnnualAmountCents: z.number().int().min(100).optional(),
        collectionMethod: z.enum(["charge_automatically", "send_invoice"]).default("charge_automatically"),
        daysUntilDue: z.number().int().min(1).max(90).default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: input.orgId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          name: true,
          users: {
            where: { role: "OWNER" },
            select: { email: true },
            take: 1,
          },
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });
      if (org.stripeSubscriptionId) {
        throw new TRPCError({ code: "CONFLICT", message: "Organization already has an active subscription. Use update instead." });
      }

      const plan = getPlanByTier(input.tier);
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tier" });

      const stripe = getStripe();

      // Ensure Stripe customer exists
      let customerId = org.stripeCustomerId;
      if (!customerId) {
        const ownerEmail = org.users[0]?.email;
        const customer = await stripe.customers.create({
          email: ownerEmail ?? undefined,
          name: org.name,
          metadata: { orgId: input.orgId },
        });
        customerId = customer.id;
        await ctx.db.organization.update({
          where: { id: input.orgId },
          data: { stripeCustomerId: customerId },
        });
      }

      // Determine price — custom or standard
      const isCustomPrice = input.customAnnualAmountCents && input.customAnnualAmountCents !== plan.annualPriceCents;
      const priceId = isCustomPrice
        ? await createCustomPrice(input.tier, input.customAnnualAmountCents!, input.orgId)
        : plan.priceId;

      if (!priceId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe price not configured for this tier" });
      }

      // Create subscription directly (no checkout)
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        collection_method: input.collectionMethod,
        ...(input.collectionMethod === "send_invoice" ? { days_until_due: input.daysUntilDue } : {}),
        metadata: { orgId: input.orgId, tier: input.tier, createdByAdmin: "true" },
      });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemEnd = (sub as any).items?.data?.[0]?.current_period_end as number | undefined;

      // Update org with subscription details
      await ctx.db.organization.update({
        where: { id: input.orgId },
        data: {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          subscription: input.tier,
          subscriptionStatus: sub.status,
          maxInspectionsPerMonth: plan.inspectionsPerMonth,
          currentPeriodEnd: itemEnd ? new Date(itemEnd * 1000) : undefined,
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          action: "ADMIN_SUBSCRIPTION_CREATED",
          entityType: "Organization",
          entityId: input.orgId,
          metadata: {
            tier: input.tier,
            amountCents: isCustomPrice ? input.customAnnualAmountCents : plan.annualPriceCents,
            custom: !!isCustomPrice,
            collectionMethod: input.collectionMethod,
          } as unknown as Prisma.InputJsonValue,
          userId: ctx.userId,
        },
      });

      return { subscriptionId: sub.id, status: sub.status };
    }),

  updateSubscription: superAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        tier: z.enum(["CORE", "BASE", "PRO", "ENTERPRISE"]),
        customAnnualAmountCents: z.number().int().min(100).optional(),
        maxInspectionsPerMonth: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: input.orgId },
        select: {
          stripeSubscriptionId: true,
          stripeCustomerId: true,
          subscription: true,
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });
      if (!org.stripeSubscriptionId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active subscription. Create one first." });
      }

      const plan = getPlanByTier(input.tier);
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tier" });

      const stripe = getStripe();

      // Cancel the existing subscription immediately
      await stripe.subscriptions.cancel(org.stripeSubscriptionId, {
        cancellation_details: { comment: "Admin plan change — replaced with new subscription" },
      });

      // Determine new price
      const isCustomPrice = input.customAnnualAmountCents && input.customAnnualAmountCents !== plan.annualPriceCents;
      const priceId = isCustomPrice
        ? await createCustomPrice(input.tier, input.customAnnualAmountCents!, input.orgId)
        : plan.priceId;

      if (!priceId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe price not configured" });
      }

      // Create new subscription
      const sub = await stripe.subscriptions.create({
        customer: org.stripeCustomerId!,
        items: [{ price: priceId }],
        metadata: { orgId: input.orgId, tier: input.tier, createdByAdmin: "true" },
      });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemEnd = (sub as any).items?.data?.[0]?.current_period_end as number | undefined;

      // Update org — do this immediately to beat the cancellation webhook
      await ctx.db.organization.update({
        where: { id: input.orgId },
        data: {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          subscription: input.tier,
          subscriptionStatus: sub.status,
          maxInspectionsPerMonth: input.maxInspectionsPerMonth ?? plan.inspectionsPerMonth,
          currentPeriodEnd: itemEnd ? new Date(itemEnd * 1000) : undefined,
        },
      });

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          action: "ADMIN_SUBSCRIPTION_UPDATED",
          entityType: "Organization",
          entityId: input.orgId,
          metadata: {
            previousTier: org.subscription,
            newTier: input.tier,
            amountCents: isCustomPrice ? input.customAnnualAmountCents : plan.annualPriceCents,
            custom: !!isCustomPrice,
          } as unknown as Prisma.InputJsonValue,
          userId: ctx.userId,
        },
      });

      return { subscriptionId: sub.id, status: sub.status };
    }),

  cancelSubscription: superAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        cancelAtPeriodEnd: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: input.orgId },
        select: { stripeSubscriptionId: true },
      });
      if (!org?.stripeSubscriptionId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active subscription to cancel." });
      }

      const stripe = getStripe();

      if (input.cancelAtPeriodEnd) {
        await stripe.subscriptions.update(org.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        await ctx.db.organization.update({
          where: { id: input.orgId },
          data: { subscriptionStatus: "cancelling" },
        });
      } else {
        await stripe.subscriptions.cancel(org.stripeSubscriptionId);
        await ctx.db.organization.update({
          where: { id: input.orgId },
          data: {
            subscription: "CORE",
            subscriptionStatus: "cancelled",
            maxInspectionsPerMonth: 0,
            stripeSubscriptionId: null,
            stripePriceId: null,
            currentPeriodEnd: null,
          },
        });
      }

      // Audit log
      await ctx.db.auditLog.create({
        data: {
          action: "ADMIN_SUBSCRIPTION_CANCELLED",
          entityType: "Organization",
          entityId: input.orgId,
          metadata: {
            cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          } as unknown as Prisma.InputJsonValue,
          userId: ctx.userId,
        },
      });

      return { success: true };
    }),
});
