import { z } from "zod/v4";
import { router, protectedProcedure } from "../init";

// Generate sequential inspection number
async function generateInspectionNumber(db: typeof import("@/server/db").db) {
  const year = new Date().getFullYear();
  const count = await db.inspection.count({
    where: {
      number: { startsWith: `VB-${year}-` },
    },
  });
  return `VB-${year}-${String(count + 1).padStart(5, "0")}`;
}

export const inspectionRouter = router({
  // Create a new inspection
  create: protectedProcedure
    .input(
      z.object({
        vehicleId: z.string(),
        odometer: z.number().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const number = await generateInspectionNumber(ctx.db);

      const inspection = await ctx.db.inspection.create({
        data: {
          number,
          vehicleId: input.vehicleId,
          inspectorId: ctx.userId,
          orgId: ctx.orgId,
          odometer: input.odometer,
          location: input.location,
          notes: input.notes,
          steps: {
            createMany: {
              data: [
                { step: "VIN_DECODE", status: "COMPLETED", completedAt: new Date() },
                { step: "RISK_REVIEW" },
                { step: "MEDIA_CAPTURE" },
                { step: "PHYSICAL_INSPECTION" },
                { step: "VEHICLE_HISTORY" },
                { step: "MARKET_ANALYSIS" },
                { step: "REPORT_GENERATION" },
              ],
            },
          },
        },
        include: {
          vehicle: true,
          steps: true,
        },
      });

      return inspection;
    }),

  // Get single inspection with all relations
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.id, orgId: ctx.orgId },
        include: {
          vehicle: true,
          inspector: { select: { id: true, name: true, email: true, avatar: true } },
          steps: { orderBy: { step: "asc" } },
          findings: { include: { media: true }, orderBy: { severity: "asc" } },
          media: true,
          marketAnalysis: true,
          vehicleHistory: true,
          report: true,
        },
      });

      if (!inspection) throw new Error("Inspection not found");
      return inspection;
    }),

  // List inspections for the org
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        status: z
          .enum([
            "CREATED", "VIN_DECODED", "RISK_REVIEWED", "MEDIA_CAPTURE",
            "FINDINGS_RECORDED", "MARKET_PRICED", "REVIEWED", "COMPLETED", "CANCELLED",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const inspections = await ctx.db.inspection.findMany({
        where: {
          orgId: ctx.orgId,
          ...(input.status ? { status: input.status } : {}),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          vehicle: true,
          inspector: { select: { id: true, name: true } },
          _count: { select: { findings: true, media: true } },
        },
      });

      let nextCursor: string | undefined;
      if (inspections.length > input.limit) {
        const next = inspections.pop();
        nextCursor = next?.id;
      }

      return { inspections, nextCursor };
    }),

  // Advance workflow step
  advanceStep: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        step: z.enum([
          "VIN_DECODE", "RISK_REVIEW", "MEDIA_CAPTURE",
          "PHYSICAL_INSPECTION", "VEHICLE_HISTORY", "MARKET_ANALYSIS",
          "REPORT_GENERATION",
        ]),
        data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Mark step as completed
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: input.step,
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          data: input.data ? JSON.parse(JSON.stringify(input.data)) : undefined,
        },
      });

      // Map step → inspection status
      const statusMap: Record<string, string> = {
        VIN_DECODE: "VIN_DECODED",
        RISK_REVIEW: "RISK_REVIEWED",
        MEDIA_CAPTURE: "MEDIA_CAPTURE",
        PHYSICAL_INSPECTION: "FINDINGS_RECORDED",
        VEHICLE_HISTORY: "FINDINGS_RECORDED",
        MARKET_ANALYSIS: "MARKET_PRICED",
        REPORT_GENERATION: "COMPLETED",
      };

      await ctx.db.inspection.update({
        where: { id: input.inspectionId },
        data: {
          status: statusMap[input.step] as never,
          ...(input.step === "REPORT_GENERATION"
            ? { completedAt: new Date() }
            : {}),
        },
      });

      return { success: true };
    }),

  // Add a finding
  addFinding: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        severity: z.enum(["CRITICAL", "MAJOR", "MODERATE", "MINOR", "INFO"]),
        category: z.enum([
          "STRUCTURAL", "DRIVETRAIN", "ENGINE", "TRANSMISSION", "ELECTRICAL",
          "COSMETIC_EXTERIOR", "COSMETIC_INTERIOR", "ELECTRONICS", "SAFETY",
          "TIRES_WHEELS", "BRAKES", "SUSPENSION", "HVAC", "OTHER",
        ]),
        title: z.string().min(1),
        description: z.string().min(1),
        evidence: z.string().optional(),
        impact: z.string().optional(),
        repairCostLow: z.number().optional(),
        repairCostHigh: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const finding = await ctx.db.finding.create({
        data: input,
      });

      // Recalculate condition score
      await recalculateScore(ctx.db, input.inspectionId);

      return finding;
    }),

  // Update condition scores
  updateScores: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return recalculateScore(ctx.db, input.inspectionId);
    }),
});

// Condition score calculation
async function recalculateScore(db: typeof import("@/server/db").db, inspectionId: string) {
  const findings = await db.finding.findMany({
    where: { inspectionId },
  });

  const weights = { structural: 0.45, cosmetic: 0.30, electronics: 0.25 };
  const deductions: Record<string, number> = {
    CRITICAL: 30, MAJOR: 15, MODERATE: 7, MINOR: 3, INFO: 0,
  };

  const scores = { structural: 100, cosmetic: 100, electronics: 100 };

  for (const f of findings) {
    const ded = deductions[f.severity] || 0;
    const bucket = mapCategory(f.category);
    scores[bucket] = Math.max(0, scores[bucket] - ded);
  }

  const overall = Math.round(
    scores.structural * weights.structural +
    scores.cosmetic * weights.cosmetic +
    scores.electronics * weights.electronics
  );

  return db.inspection.update({
    where: { id: inspectionId },
    data: {
      overallScore: overall,
      structuralScore: scores.structural,
      cosmeticScore: scores.cosmetic,
      electronicsScore: scores.electronics,
    },
  });
}

function mapCategory(cat: string): "structural" | "cosmetic" | "electronics" {
  const structural = ["STRUCTURAL", "DRIVETRAIN", "ENGINE", "TRANSMISSION", "BRAKES", "SUSPENSION"];
  const electronics = ["ELECTRICAL", "ELECTRONICS", "SAFETY"];
  if (structural.includes(cat)) return "structural";
  if (electronics.includes(cat)) return "electronics";
  return "cosmetic";
}
