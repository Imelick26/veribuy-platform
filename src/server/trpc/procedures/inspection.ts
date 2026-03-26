import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { analyzeRiskMedia, scanForUnexpectedIssues, analyzeVehicleCondition, extractVinFromPhoto } from "@/lib/ai/media-analyzer";
import { fetchMarketValue } from "@/lib/marketcheck";
import { fetchRecalls } from "@/lib/nhtsa";
import { calculateFairPrice, calculateDealEconomics, type HistoryData } from "@/lib/market-valuation";
import type { AggregatedRiskProfile, AIAnalysisResult, OverallConditionResult, ConditionAssessment } from "@/types/risk";
import { persistConditionScores } from "@/lib/scoring";

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
        vehicleId: z.string().optional(),
        odometer: z.number().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce monthly inspection limit (base + bonus)
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.orgId },
        select: { maxInspectionsPerMonth: true, bonusInspections: true },
      });
      if (org) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthlyCount = await ctx.db.inspection.count({
          where: { orgId: ctx.orgId, createdAt: { gte: startOfMonth } },
        });
        const effectiveLimit = org.maxInspectionsPerMonth + (org.bonusInspections ?? 0);
        if (monthlyCount >= effectiveLimit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Monthly inspection limit reached. Purchase additional inspections or contact VeriBuy to upgrade your plan.",
          });
        }
        // Consume a bonus inspection if base monthly quota is exhausted
        if (monthlyCount >= org.maxInspectionsPerMonth && (org.bonusInspections ?? 0) > 0) {
          await ctx.db.organization.update({
            where: { id: ctx.orgId },
            data: { bonusInspections: { decrement: 1 } },
          });
        }
      }

      const number = await generateInspectionNumber(ctx.db);

      // New workflow: MEDIA_CAPTURE first, VIN comes from photo
      const inspection = await ctx.db.inspection.create({
        data: {
          number,
          vehicleId: input.vehicleId ?? null,
          inspectorId: ctx.userId,
          orgId: ctx.orgId,
          odometer: input.odometer,
          location: input.location,
          notes: input.notes,
          steps: {
            createMany: {
              data: [
                { step: "MEDIA_CAPTURE" },
                { step: "VIN_CONFIRM" },
                { step: "AI_CONDITION_SCAN" },
                { step: "RISK_INSPECTION" },
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
      // Check new step name first, then fall back to old
      let step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "RISK_INSPECTION",
          },
        },
      });
      if (!step?.data) {
        step = await ctx.db.inspectionStep.findUnique({
          where: {
            inspectionId_step: {
              inspectionId: input.inspectionId,
              step: "RISK_REVIEW",
            },
          },
        });
      }

      if (!step?.data) return null;
      return step.data as unknown as AggregatedRiskProfile;
    }),

  // Confirm VIN from photo OCR → decode + link vehicle + trigger risk profile
  confirmVin: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        vin: z.string().length(17),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
      });
      if (!inspection) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection not found" });

      const vin = input.vin.toUpperCase();

      // Check if vehicle already exists
      let vehicle = await ctx.db.vehicle.findUnique({ where: { vin } });

      if (!vehicle) {
        // Decode VIN via NHTSA vPIC API
        const res = await fetch(
          `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`
        );
        const data = await res.json();
        const r = data.Results?.[0];

        if (!r || !r.ModelYear) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unable to decode VIN. Please check and try again." });
        }

        vehicle = await ctx.db.vehicle.create({
          data: {
            vin,
            year: parseInt(r.ModelYear) || 0,
            make: r.Make || "Unknown",
            model: r.Model || "Unknown",
            trim: r.Trim || null,
            bodyStyle: r.BodyClass || null,
            drivetrain: r.DriveType || null,
            engine: [r.EngineConfiguration, r.DisplacementL ? `${r.DisplacementL}L` : null, r.EngineCylinders ? `${r.EngineCylinders}cyl` : null]
              .filter(Boolean).join(" ") || null,
            transmission: r.TransmissionStyle || null,
            nhtsaData: JSON.parse(JSON.stringify(r)),
            orgId: ctx.orgId,
          },
        });
      }

      // Link vehicle to inspection
      await ctx.db.inspection.update({
        where: { id: input.inspectionId },
        data: {
          vehicleId: vehicle.id,
          status: "VIN_DECODED",
        },
      });

      // Mark VIN_CONFIRM step complete
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "VIN_CONFIRM",
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          data: JSON.parse(JSON.stringify({
            vin,
            decoded: {
              year: vehicle.year,
              make: vehicle.make,
              model: vehicle.model,
              trim: vehicle.trim,
              bodyStyle: vehicle.bodyStyle,
              engine: vehicle.engine,
            },
          })),
        },
      });

      return { vehicle };
    }),

  // Detect VIN from captured photos using GPT-4o Vision OCR
  // Tries VIN-specific photos first, then falls back to other likely candidates
  detectVin: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: { media: true },
      });
      if (!inspection) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection not found" });

      // Photos most likely to contain a VIN, in priority order
      // Door jamb sticker is the primary source — clear flat label, no glass/glare
      const VIN_PHOTO_TYPES = [
        "DOOR_JAMB_DRIVER",       // Door jamb sticker (always has VIN, clearest source)
        "VIN_PLATE",              // Dashboard VIN plate (legacy, kept for backward compat)
        "UNDER_HOOD_LABEL",       // Hood label (legacy, kept for backward compat)
      ];

      const photosWithUrls = inspection.media.filter((m) => m.url && m.captureType);

      // Try each VIN-likely photo type in order
      for (const captureType of VIN_PHOTO_TYPES) {
        const photo = photosWithUrls.find((m) => m.captureType === captureType);
        if (!photo?.url) continue;

        console.log(`[detectVin] Trying ${captureType} photo...`);
        const result = await extractVinFromPhoto(photo.url);
        if (result.vin) {
          console.log(`[detectVin] Found VIN ${result.vin} (confidence: ${result.confidence}) from ${captureType}`);
          return result;
        }
      }

      // No VIN found in any photo
      console.log("[detectVin] No VIN detected in any photo");
      return { vin: null, confidence: 0 };
    }),

  // Run AI condition scan (4-area assessment + unexpected issues)
  runConditionScan: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: { vehicle: true, media: true },
      });
      if (!inspection) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection not found" });
      if (!inspection.vehicle) throw new TRPCError({ code: "BAD_REQUEST", message: "VIN not confirmed yet" });

      // Mark step as in progress
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_CONDITION_SCAN",
          },
        },
        data: {
          status: "IN_PROGRESS",
          enteredAt: new Date(),
        },
      });

      const mediaForAnalysis = inspection.media
        .filter((m) => m.url && m.captureType)
        .map((m) => ({ id: m.id, url: m.url!, captureType: m.captureType! }));

      if (mediaForAnalysis.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No photos captured yet" });
      }

      const vehicleInfo = {
        year: inspection.vehicle.year,
        make: inspection.vehicle.make,
        model: inspection.vehicle.model,
        mileage: inspection.odometer,
      };

      // Run condition assessment + unexpected issues in parallel
      const [conditionAssessment, unexpectedResult] = await Promise.all([
        analyzeVehicleCondition(vehicleInfo, mediaForAnalysis),
        scanForUnexpectedIssues(vehicleInfo, mediaForAnalysis),
      ]);

      // Persist condition scores to Inspection record
      await persistConditionScores(ctx.db, input.inspectionId, conditionAssessment);

      // Store results in step data (including photo-discovered risks)
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_CONDITION_SCAN",
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          data: JSON.parse(JSON.stringify({
            conditionAssessment,
            unexpectedFindings: unexpectedResult.unexpectedFindings,
            unexpectedSummary: unexpectedResult.summary,
          })),
        },
      });

      return {
        conditionAssessment,
        unexpectedFindings: unexpectedResult.unexpectedFindings,
      };
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
          "MEDIA_CAPTURE", "VIN_CONFIRM", "AI_CONDITION_SCAN",
          "RISK_INSPECTION", "VEHICLE_HISTORY", "MARKET_ANALYSIS",
          "REPORT_GENERATION",
          // Deprecated — kept for backward compat
          "VIN_DECODE", "RISK_REVIEW", "AI_ANALYSIS",
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
        // New workflow steps
        MEDIA_CAPTURE: "MEDIA_CAPTURE",
        VIN_CONFIRM: "VIN_DECODED",
        AI_CONDITION_SCAN: "AI_ANALYZED",
        RISK_INSPECTION: "RISK_REVIEWED",
        VEHICLE_HISTORY: "AI_ANALYZED",
        MARKET_ANALYSIS: "MARKET_PRICED",
        REPORT_GENERATION: "COMPLETED",
        // Deprecated
        VIN_DECODE: "VIN_DECODED",
        RISK_REVIEW: "RISK_REVIEWED",
        AI_ANALYSIS: "AI_ANALYZED",
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

      // Condition score is now independent (AI-driven from photos).
      // Findings only affect repair costs, not condition score.

      return finding;
    }),

  // Update condition scores — now only used if manual override needed
  updateScores: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Condition scores are now set by AI condition assessment.
      // This endpoint is a no-op placeholder for backward compat.
      return ctx.db.inspection.findUnique({ where: { id: input.inspectionId } });
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

      if (!inspection.vehicle) {
        throw new Error("No vehicle linked — confirm VIN before running AI analysis");
      }

      const vehicleInfo = {
        year: inspection.vehicle.year,
        make: inspection.vehicle.make,
        model: inspection.vehicle.model,
      };

      // Read question answers from AI_ANALYSIS step to pass to the analyzer
      const aiStep = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_ANALYSIS",
          },
        },
      });
      const aiStepData = (aiStep?.data as Record<string, unknown>) || {};
      const checkStatuses = (aiStepData.checkStatuses as Record<string, Record<string, unknown>>) || {};
      const questionAnswersByRisk: Record<string, Array<{ questionId: string; answer: string | null; answeredAt: string; mediaIds?: string[] }>> = {};
      for (const [riskId, cs] of Object.entries(checkStatuses)) {
        if (cs.questionAnswers && Array.isArray(cs.questionAnswers)) {
          questionAnswersByRisk[riskId] = cs.questionAnswers as Array<{ questionId: string; answer: string | null; answeredAt: string; mediaIds?: string[] }>;
        }
      }

      // Run risk-specific + unexpected issues scan in parallel
      const [riskResults, overallCondition] = await Promise.all([
        analyzeRiskMedia(vehicleInfo, riskProfile.aggregatedRisks, mediaForAnalysis, questionAnswersByRisk as Record<string, import("@/types/risk").QuestionAnswer[]>),
        scanForUnexpectedIssues(vehicleInfo, mediaForAnalysis),
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
                repairCostLow: result.refinedCost?.low ?? risk.cost.low,
                repairCostHigh: result.refinedCost?.high ?? risk.cost.high,
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

      // Condition scores are now set by the separate AI condition assessment
      // (runConditionScan procedure). Findings affect repair costs, not score.

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
      if (!vehicle) throw new Error("No vehicle linked — confirm VIN first");

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
      if (!vehicle) throw new Error("No vehicle linked — confirm VIN first");

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
      // Determine which step stores check statuses (AI_ANALYSIS for legacy, RISK_INSPECTION for new)
      const allSteps = await ctx.db.inspectionStep.findMany({
        where: { inspectionId: input.inspectionId },
        select: { step: true },
      });
      const stepNames = allSteps.map((s) => s.step);
      const checkStepName = stepNames.includes("RISK_INSPECTION")
        ? "RISK_INSPECTION"
        : "AI_ANALYSIS";

      const step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: checkStepName,
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
            step: checkStepName,
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

  // Record an answer to a guided inspection question
  recordQuestionAnswer: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        riskId: z.string(),
        questionId: z.string(),
        answer: z.enum(["yes", "no"]),
        mediaIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Determine which steps store data (new vs legacy workflow)
      const allSteps = await ctx.db.inspectionStep.findMany({
        where: { inspectionId: input.inspectionId },
        select: { step: true },
      });
      const stepNames = allSteps.map((s) => s.step);
      const checkStepName = stepNames.includes("RISK_INSPECTION") ? "RISK_INSPECTION" : "AI_ANALYSIS";

      // Get the step where check statuses live
      const aiStep = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: checkStepName,
          },
        },
      });

      const existingData = (aiStep?.data as Record<string, unknown>) || {};
      const checkStatuses = (existingData.checkStatuses as Record<string, Record<string, unknown>>) || {};

      // Get or initialize this risk's check status
      const riskStatus = checkStatuses[input.riskId] || {
        riskId: input.riskId,
        status: "NOT_CHECKED",
        mediaIds: [],
        hasPhotoEvidence: false,
      };

      // Get existing question answers or initialize
      const questionAnswers = (riskStatus.questionAnswers as Array<Record<string, unknown>>) || [];

      // Upsert the answer
      const existingIdx = questionAnswers.findIndex((qa) => qa.questionId === input.questionId);
      const answerEntry = {
        questionId: input.questionId,
        answer: input.answer,
        answeredAt: new Date().toISOString(),
        mediaIds: input.mediaIds || [],
      };
      if (existingIdx >= 0) {
        questionAnswers[existingIdx] = answerEntry;
      } else {
        questionAnswers.push(answerEntry);
      }
      riskStatus.questionAnswers = questionAnswers;

      // Collect all media from question answers
      const allMediaIds = questionAnswers.flatMap((qa) => (qa.mediaIds as string[]) || []);
      if (allMediaIds.length > 0) {
        riskStatus.mediaIds = allMediaIds;
        riskStatus.hasPhotoEvidence = true;
      }

      // Just store the answer — don't auto-derive risk status.
      // Status derivation happens when the user explicitly completes the step.
      riskStatus.checkedAt = new Date().toISOString();
      checkStatuses[input.riskId] = riskStatus;

      // Save back
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: checkStepName,
          },
        },
        data: {
          status: "IN_PROGRESS",
          enteredAt: aiStep?.enteredAt || new Date(),
          data: JSON.parse(JSON.stringify({ ...existingData, checkStatuses })),
        },
      });

      return { success: true, derivedStatus: riskStatus.status as string };
    }),

  // Get risk checklist statuses for an inspection
  getRiskChecklist: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check new step first, then fall back to legacy
      let step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "RISK_INSPECTION",
          },
        },
      });
      if (!step?.data) {
        step = await ctx.db.inspectionStep.findUnique({
          where: {
            inspectionId_step: {
              inspectionId: input.inspectionId,
              step: "AI_ANALYSIS",
            },
          },
        });
      }

      if (!step?.data) return {};
      const data = step.data as Record<string, unknown>;
      return (data.checkStatuses || {}) as Record<string, { riskId: string; status: string; notes?: string; mediaIds?: string[]; hasPhotoEvidence?: boolean; checkedAt?: string }>;
    }),

  // Monthly usage stats for the org
  usageStats: protectedProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUnique({
      where: { id: ctx.orgId },
      select: { maxInspectionsPerMonth: true, bonusInspections: true },
    });
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const used = await ctx.db.inspection.count({
      where: { orgId: ctx.orgId, createdAt: { gte: startOfMonth } },
    });
    return {
      used,
      limit: org?.maxInspectionsPerMonth ?? 10,
      bonusInspections: org?.bonusInspections ?? 0,
    };
  }),
});

// Score calculation is now in @/lib/scoring.ts (shared with report generation)
