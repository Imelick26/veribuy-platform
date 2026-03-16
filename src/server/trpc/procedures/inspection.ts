import { z } from "zod/v4";
import { router, protectedProcedure } from "../init";
import { analyzeRiskMedia, analyzeOverallCondition } from "@/lib/ai/media-analyzer";
import { fetchMarketValue } from "@/lib/marketcheck";
import { fetchRecalls } from "@/lib/nhtsa";
import { calculateFairPrice, calculateDealEconomics, type HistoryData } from "@/lib/market-valuation";
import type { AggregatedRiskProfile, AIAnalysisResult, OverallConditionResult } from "@/types/risk";

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
                { step: "AI_ANALYSIS" },
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

  // Get the aggregated risk profile for an inspection (stored in RISK_REVIEW step data)
  getRiskProfile: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "RISK_REVIEW",
          },
        },
      });

      if (!step?.data) return null;
      return step.data as unknown as AggregatedRiskProfile;
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
            "AI_ANALYZED", "MARKET_PRICED", "REVIEWED", "COMPLETED", "CANCELLED",
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
          "AI_ANALYSIS", "VEHICLE_HISTORY", "MARKET_ANALYSIS",
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
        AI_ANALYSIS: "AI_ANALYZED",
        VEHICLE_HISTORY: "AI_ANALYZED",
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
        positionX: z.number().optional(),
        positionY: z.number().optional(),
        positionZ: z.number().optional(),
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

  // Run AI analysis on captured photos against risk items + overall condition scan
  runAIAnalysis: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get inspection with vehicle and media
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: { vehicle: true, media: true },
      });
      if (!inspection) throw new Error("Inspection not found");

      // Get risk profile from RISK_REVIEW step
      const riskStep = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "RISK_REVIEW",
          },
        },
      });
      if (!riskStep?.data) throw new Error("No risk profile found — run risk review first");
      const riskProfile = riskStep.data as unknown as AggregatedRiskProfile;

      // Prepare media for analysis (only items with URLs)
      const mediaForAnalysis = inspection.media
        .filter((m) => m.url && m.captureType)
        .map((m) => ({
          id: m.id,
          url: m.url!,
          captureType: m.captureType!,
        }));

      if (mediaForAnalysis.length === 0) {
        throw new Error("No photos captured yet — capture photos before running AI analysis");
      }

      const vehicleInfo = {
        year: inspection.vehicle.year,
        make: inspection.vehicle.make,
        model: inspection.vehicle.model,
      };

      // Run risk-specific + overall condition analysis in parallel
      const [riskResults, overallCondition] = await Promise.all([
        analyzeRiskMedia(vehicleInfo, riskProfile.aggregatedRisks, mediaForAnalysis),
        analyzeOverallCondition(vehicleInfo, mediaForAnalysis),
      ]);

      // Auto-create findings for CONFIRMED risks with evidence linking
      for (const result of riskResults) {
        if (result.verdict === "CONFIRMED") {
          const risk = riskProfile.aggregatedRisks.find((r) => r.id === result.riskId);
          if (risk) {
            const finding = await ctx.db.finding.create({
              data: {
                inspectionId: input.inspectionId,
                title: risk.title,
                description: result.explanation,
                severity: risk.severity as never,
                category: risk.category as never,
                evidence: `AI Analysis (${Math.round(result.confidence * 100)}% confidence): ${result.explanation}`,
                repairCostLow: risk.cost.low,
                repairCostHigh: risk.cost.high,
                positionX: risk.position.x,
                positionY: risk.position.y,
                positionZ: risk.position.z,
              },
            });

            // Link evidence photos to the finding
            if (result.evidenceMediaIds.length > 0) {
              await ctx.db.mediaItem.updateMany({
                where: {
                  id: { in: result.evidenceMediaIds },
                  inspectionId: input.inspectionId,
                },
                data: { findingId: finding.id },
              });
            }
          }
        }
      }

      // Auto-create findings from unexpected issues found in overall condition scan
      for (const uf of overallCondition.unexpectedFindings) {
        if (uf.confidence < 0.6) continue;

        const finding = await ctx.db.finding.create({
          data: {
            inspectionId: input.inspectionId,
            title: uf.title,
            description: uf.description,
            severity: uf.severity as never,
            category: (uf.category || "OTHER") as never,
            evidence: `AI Condition Scan (${Math.round(uf.confidence * 100)}% confidence): ${uf.description}`,
          },
        });

        // Link the specific photo if identifiable
        if (uf.photoIndex >= 0 && uf.photoIndex < mediaForAnalysis.length) {
          await ctx.db.mediaItem.update({
            where: { id: mediaForAnalysis[uf.photoIndex].id },
            data: { findingId: finding.id },
          });
        }
      }

      // Recalculate scores after auto-creating all findings
      await recalculateScore(ctx.db, input.inspectionId);

      // Store both result sets in the AI_ANALYSIS step data
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_ANALYSIS",
          },
        },
        data: {
          status: "IN_PROGRESS",
          enteredAt: new Date(),
          data: JSON.parse(JSON.stringify({
            aiResults: riskResults,
            overallCondition,
          })),
        },
      });

      return {
        riskResults: riskResults as AIAnalysisResult[],
        overallCondition,
      };
    }),

  // Get AI analysis results for an inspection
  getAIAnalysisResults: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_ANALYSIS",
          },
        },
      });

      if (!step?.data) return { aiResults: [] as AIAnalysisResult[], overallCondition: null as OverallConditionResult | null };
      const data = step.data as Record<string, unknown>;
      return {
        aiResults: (data.aiResults || []) as AIAnalysisResult[],
        overallCondition: (data.overallCondition || null) as OverallConditionResult | null,
      };
    }),

  // Fetch vehicle history using NHTSA (free) for recalls
  // Title status, accidents, owners are entered by the inspector or
  // can be upgraded to a paid provider (VinAudit/Carfax) later.
  fetchHistory: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: { vehicle: true },
      });
      if (!inspection) throw new Error("Inspection not found");

      const vehicle = inspection.vehicle;

      // Fetch recalls from NHTSA (free, no API key needed)
      const nhtsaRecalls = await fetchRecalls(
        vehicle.make,
        vehicle.model,
        vehicle.year,
      );

      // Count open recalls (all NHTSA recalls are considered open unless completed)
      const openRecallCount = nhtsaRecalls.length;

      const historyRecord = {
        provider: "NHTSA",
        titleStatus: "CLEAN",        // Default — inspector can override
        accidentCount: 0,            // Default — inspector can override
        ownerCount: 1,               // Default — inspector can override
        serviceRecords: 0,
        structuralDamage: false,     // Default — inspector can override
        floodDamage: false,          // Default — inspector can override
        openRecallCount,
        recalls: JSON.parse(JSON.stringify(
          nhtsaRecalls.map((r) => ({
            campaignNumber: r.campaignNumber,
            component: r.component,
            summary: r.summary,
            consequence: r.consequence,
            remedy: r.remedy,
          }))
        )),
        rawData: JSON.parse(JSON.stringify({ nhtsaRecalls })),
      };

      // Create or update VehicleHistory record
      const vehicleHistory = await ctx.db.vehicleHistory.upsert({
        where: { inspectionId: input.inspectionId },
        create: {
          inspectionId: input.inspectionId,
          ...historyRecord,
        },
        update: historyRecord,
      });

      // Mark step as completed
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "VEHICLE_HISTORY",
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          enteredAt: new Date(),
        },
      });

      return vehicleHistory;
    }),

  // Fetch market analysis using MarketCheck + valuation engine
  fetchMarket: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: { vehicle: true, findings: true, vehicleHistory: true },
      });
      if (!inspection) throw new Error("Inspection not found");

      const vehicle = inspection.vehicle;

      // Extract ZIP code from location string, or default
      const zipMatch = (inspection.location || "").match(/\b(\d{5})\b/);
      const zip = zipMatch ? zipMatch[1] : "97201"; // default Portland, OR

      // Fetch market value + comps from MarketCheck
      const marketData = await fetchMarketValue(
        vehicle.year,
        vehicle.make,
        vehicle.model,
        zip,
        inspection.odometer || undefined
      );

      // Build comparables from nearby listings
      const comparables = marketData.nearbyListings.map((l) => ({
        title: l.title,
        price: l.price,
        mileage: l.mileage,
        location: l.location,
        source: l.source,
        url: l.url,
      }));

      // Convert MarketCheck dollar values → cents (DB stores cents)
      const basePriceCents = Math.round(marketData.estimatedValue * 100);
      const retailPriceCents = Math.round(
        (marketData.valueHigh || marketData.estimatedValue * 1.1) * 100
      );

      // Build history data from vehicleHistory (safe defaults if skipped)
      const historyData: HistoryData = inspection.vehicleHistory
        ? {
            titleStatus: inspection.vehicleHistory.titleStatus,
            accidentCount: inspection.vehicleHistory.accidentCount,
            ownerCount: inspection.vehicleHistory.ownerCount ?? 1,
            structuralDamage: inspection.vehicleHistory.structuralDamage,
            floodDamage: inspection.vehicleHistory.floodDamage,
            openRecallCount: inspection.vehicleHistory.openRecallCount,
          }
        : {
            titleStatus: "CLEAN",
            accidentCount: 0,
            ownerCount: 1,
            structuralDamage: false,
            floodDamage: false,
            openRecallCount: 0,
          };

      // Recon cost from findings (already in cents in DB)
      const totalRepairLow = inspection.findings.reduce((s, f) => s + (f.repairCostLow || 0), 0);
      const totalRepairHigh = inspection.findings.reduce((s, f) => s + (f.repairCostHigh || 0), 0);
      const reconCostCents = Math.round((totalRepairLow + totalRepairHigh) / 2);

      const conditionScore = inspection.overallScore || 70;

      // Fair value at baseline (score 85 = good condition, no recon) — the reference point
      const baselineResult = calculateFairPrice(basePriceCents, 85, historyData, 0);

      // Actual fair value for THIS specific car
      const fairResult = calculateFairPrice(basePriceCents, conditionScore, historyData, reconCostCents);

      // Price bands around the fair value
      const dealEcon = calculateDealEconomics(
        fairResult.fairPurchasePrice,
        retailPriceCents,
        conditionScore,
        historyData,
      );

      // Derive recommendation: compare fair value against bands
      const bands = dealEcon.priceBands;
      let recommendation: string;
      const hasDealBreaker =
        conditionScore < 40 ||
        historyData.floodDamage ||
        historyData.titleStatus.toUpperCase().includes("SALVAGE");

      if (hasDealBreaker) {
        recommendation = "PASS";
      } else if (fairResult.fairPurchasePrice <= bands[0].maxPriceCents) {
        recommendation = "STRONG_BUY";
      } else if (fairResult.fairPurchasePrice <= bands[1].maxPriceCents) {
        recommendation = "FAIR_BUY";
      } else if (fairResult.fairPurchasePrice <= bands[2].maxPriceCents) {
        recommendation = "OVERPAYING";
      } else {
        recommendation = "PASS";
      }

      const estGrossProfit = retailPriceCents - fairResult.fairPurchasePrice - reconCostCents;

      // Shared data object for create/update
      const marketAnalysisData = {
        comparables: JSON.parse(JSON.stringify(comparables)),
        baselinePrice: basePriceCents,
        adjustments: JSON.parse(JSON.stringify({
          mileage: Math.round(marketData.mileageAdjustment * 100),
          conditionDelta: fairResult.adjustedValueBeforeRecon - basePriceCents,
          historyDelta: Math.round(basePriceCents * fairResult.conditionMultiplier * (fairResult.historyMultiplier - 1)),
        })),
        adjustedPrice: fairResult.fairPurchasePrice,
        recommendation: recommendation as never,
        strongBuyMax: bands[0].maxPriceCents,
        fairBuyMax: bands[1].maxPriceCents,
        overpayingMax: bands[2].maxPriceCents,
        estRetailPrice: retailPriceCents,
        estReconCost: reconCostCents,
        estGrossProfit,
        conditionScore,
        conditionMultiplier: fairResult.conditionMultiplier,
        conditionGrade: fairResult.conditionGrade,
        historyMultiplier: fairResult.historyMultiplier,
        historyBreakdown: JSON.parse(JSON.stringify(fairResult.historyBreakdown)),
        fairValueAtBaseline: baselineResult.fairPurchasePrice,
        adjustedValueBeforeRecon: fairResult.adjustedValueBeforeRecon,
        priceBands: JSON.parse(JSON.stringify(bands)),
      };

      // Create or update MarketAnalysis record
      const marketAnalysis = await ctx.db.marketAnalysis.upsert({
        where: { inspectionId: input.inspectionId },
        create: {
          inspectionId: input.inspectionId,
          ...marketAnalysisData,
        },
        update: marketAnalysisData,
      });

      // Mark step as completed
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "MARKET_ANALYSIS",
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          enteredAt: new Date(),
        },
      });

      return marketAnalysis;
    }),

  // Record risk check status during physical inspection
  recordRiskCheck: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        riskId: z.string(),
        status: z.enum(["NOT_CHECKED", "CONFIRMED", "NOT_FOUND", "UNABLE_TO_INSPECT"]),
        notes: z.string().optional(),
        mediaIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the AI_ANALYSIS step
      const step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_ANALYSIS",
          },
        },
      });

      // Get existing check data or initialize
      const existingData = (step?.data as Record<string, unknown>) || {};
      const checkStatuses = (existingData.checkStatuses as Record<string, unknown>) || {};

      // Update the risk check status
      const mediaIds = input.mediaIds || [];
      checkStatuses[input.riskId] = {
        riskId: input.riskId,
        status: input.status,
        notes: input.notes || null,
        mediaIds,
        hasPhotoEvidence: mediaIds.length > 0,
        checkedAt: new Date().toISOString(),
      };

      // Save back to the step
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_ANALYSIS",
          },
        },
        data: {
          status: "IN_PROGRESS",
          enteredAt: step?.enteredAt || new Date(),
          data: JSON.parse(JSON.stringify({ ...existingData, checkStatuses })),
        },
      });

      return { success: true };
    }),

  // Get risk checklist statuses for an inspection
  getRiskChecklist: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_ANALYSIS",
          },
        },
      });

      if (!step?.data) return {};
      const data = step.data as Record<string, unknown>;
      return (data.checkStatuses || {}) as Record<string, { riskId: string; status: string; notes?: string; mediaIds?: string[]; hasPhotoEvidence?: boolean; checkedAt?: string }>;
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
