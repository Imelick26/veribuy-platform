import { z } from "zod/v4";
import { router, protectedProcedure, publicProcedure } from "../init";
import crypto from "crypto";

export const reportRouter = router({
  // Generate report from completed inspection
  generate: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: {
          vehicle: true,
          findings: true,
          marketAnalysis: true,
          vehicleHistory: true,
        },
      });

      if (!inspection) throw new Error("Inspection not found");

      // Generate report number
      const year = new Date().getFullYear();
      const count = await ctx.db.report.count({
        where: { number: { startsWith: `RPT-${year}-` } },
      });
      const number = `RPT-${year}-${String(count + 1).padStart(5, "0")}`;

      // Generate share token
      const shareToken = crypto.randomBytes(16).toString("hex");

      const report = await ctx.db.report.create({
        data: {
          number,
          shareToken,
          inspectionId: input.inspectionId,
          orgId: ctx.orgId,
          // PDF generation will be handled by background job
        },
      });

      // Mark inspection as completed
      await ctx.db.inspection.update({
        where: { id: input.inspectionId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      return report;
    }),

  // Get report by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.report.findUnique({
        where: { id: input.id, orgId: ctx.orgId },
        include: {
          inspection: {
            include: {
              vehicle: true,
              findings: { include: { media: true } },
              media: true,
              marketAnalysis: true,
              vehicleHistory: true,
              inspector: { select: { name: true, email: true } },
            },
          },
        },
      });
    }),

  // List reports for org
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const reports = await ctx.db.report.findMany({
        where: { orgId: ctx.orgId },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { generatedAt: "desc" },
        include: {
          inspection: {
            include: {
              vehicle: true,
              _count: { select: { findings: true } },
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (reports.length > input.limit) {
        const next = reports.pop();
        nextCursor = next?.id;
      }

      return { reports, nextCursor };
    }),

  // Public: view shared report (by share token)
  viewShared: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const report = await ctx.db.report.findUnique({
        where: { shareToken: input.token },
        include: {
          inspection: {
            include: {
              vehicle: true,
              findings: { include: { media: true } },
              media: true,
              marketAnalysis: true,
              vehicleHistory: true,
              inspector: { select: { name: true } },
            },
          },
          org: { select: { name: true, logo: true } },
        },
      });

      if (!report) throw new Error("Report not found");

      // Check expiration
      if (report.shareExpiresAt && report.shareExpiresAt < new Date()) {
        throw new Error("This share link has expired");
      }

      // Increment view count
      await ctx.db.report.update({
        where: { id: report.id },
        data: { viewCount: { increment: 1 } },
      });

      return report;
    }),
});
