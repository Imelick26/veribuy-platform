import { z } from "zod/v4";
import { router, superAdminProcedure } from "../init";
import bcrypt from "bcryptjs";

export const adminRouter = router({
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
        ownerPassword: z.string().min(8),
        subscription: z.enum(["BASE", "PRO", "ENTERPRISE"]),
        maxInspectionsPerMonth: z.number().int().min(1),
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

      const passwordHash = await bcrypt.hash(input.ownerPassword, 12);

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

      return { orgId: result.org.id, userId: result.user.id };
    }),

  // Update org plan / limits
  updateOrg: superAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        subscription: z.enum(["BASE", "PRO", "ENTERPRISE"]).optional(),
        maxInspectionsPerMonth: z.number().int().min(1).optional(),
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

      const inspectionsThisMonth = await ctx.db.inspection.count({
        where: { orgId: input.orgId, createdAt: { gte: startOfMonth } },
      });

      const totalInspections = await ctx.db.inspection.count({
        where: { orgId: input.orgId },
      });

      return { ...org, inspectionsThisMonth, totalInspections };
    }),
});
