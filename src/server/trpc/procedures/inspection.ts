import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { analyzeRiskMedia, scanForUnexpectedIssues, analyzeVehicleCondition, extractVinFromPhoto, extractOdometerFromPhoto } from "@/lib/ai/media-analyzer";
import { fetchMarketData } from "@/lib/market-data";
import { fetchRecalls } from "@/lib/nhtsa";
import { fetchVehicleHistory as fetchVinAuditHistory } from "@/lib/vinaudit";
import { reportSuccess, reportFailure } from "@/lib/api-health";
import { calculateFairPrice, calculateDealEconomics, getConditionGrade, type HistoryData } from "@/lib/market-valuation";
import { classifyBody, type VehicleConfig } from "@/lib/config-premiums";
import type { AggregatedRiskProfile, AIAnalysisResult, OverallConditionResult, ConditionAssessment } from "@/types/risk";
import { persistConditionScores } from "@/lib/scoring";
import { analyzeHistoryImpact } from "@/lib/ai/history-adjuster";
import { analyzeConditionValue } from "@/lib/ai/condition-adjuster";
import { estimateReconCosts } from "@/lib/ai/recon-estimator";
import { rateDeal } from "@/lib/ai/deal-rater";
import { auditPrice } from "@/lib/ai/price-auditor";
import { analyzeAcquisitionCost } from "@/lib/ai/acquisition-adjuster";

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

      // Run condition assessment + unexpected issues + odometer OCR in parallel
      const odometerPhoto = mediaForAnalysis.find((m) => m.captureType === "ODOMETER");

      const [conditionAssessment, unexpectedResult, odometerResult] = await Promise.all([
        analyzeVehicleCondition(vehicleInfo, mediaForAnalysis),
        scanForUnexpectedIssues(vehicleInfo, mediaForAnalysis),
        odometerPhoto && !inspection.odometer
          ? extractOdometerFromPhoto(odometerPhoto.url)
          : Promise.resolve(null),
      ]);

      // Persist condition scores to Inspection record
      await persistConditionScores(ctx.db, input.inspectionId, conditionAssessment);

      // Persist odometer reading if extracted and not already set
      if (odometerResult?.mileage && odometerResult.confidence >= 0.5 && !inspection.odometer) {
        await ctx.db.inspection.update({
          where: { id: input.inspectionId },
          data: { odometer: odometerResult.mileage },
        });
        console.log(
          `[Inspection] Odometer extracted from photo: ${odometerResult.mileage.toLocaleString()} miles (${(odometerResult.confidence * 100).toFixed(0)}% confidence)`,
        );
      }

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
            odometerOCR: odometerResult ? {
              mileage: odometerResult.mileage,
              confidence: odometerResult.confidence,
            } : null,
          })),
        },
      });

      return {
        conditionAssessment,
        unexpectedFindings: unexpectedResult.unexpectedFindings,
        odometerOCR: odometerResult ? {
          mileage: odometerResult.mileage,
          confidence: odometerResult.confidence,
        } : null,
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

  // Fetch vehicle history using VinAudit (paid, ~$5) + NHTSA recalls (free).
  // Falls back to NHTSA-only defaults if VinAudit key is missing or API fails.
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

      // Always fetch NHTSA recalls (free)
      const nhtsaRecalls = await fetchRecalls(
        vehicle.make,
        vehicle.model,
        vehicle.year,
      );

      // Try VinAudit paid history if API key is configured
      let vinAuditHistory: Awaited<ReturnType<typeof fetchVinAuditHistory>> | null = null;
      if (process.env.VINAUDIT_API_KEY) {
        try {
          vinAuditHistory = await fetchVinAuditHistory(vehicle.vin);
          reportSuccess("VinAudit-History");
          console.log(`[History] VinAudit: title=${vinAuditHistory.titleStatus}, accidents=${vinAuditHistory.accidentCount}, owners=${vinAuditHistory.ownerCount}`);
        } catch (err) {
          const statusMatch = String(err).match(/\((\d{3})\)/);
          reportFailure("VinAudit-History", err instanceof Error ? err : String(err), statusMatch ? Number(statusMatch[1]) : undefined, vehicle.vin).catch(() => {});
          console.warn(`[History] VinAudit failed, using NHTSA defaults: ${err instanceof Error ? err.message : err}`);
        }
      } else {
        console.warn("[History] VINAUDIT_API_KEY not set — using NHTSA defaults for title/accidents/owners");
      }

      // Merge: VinAudit data takes priority, NHTSA recalls always included
      const allRecalls = vinAuditHistory?.recalls?.length
        ? vinAuditHistory.recalls.map((r) => ({
            campaignNumber: r.campaignNumber,
            component: r.component,
            summary: r.summary,
            consequence: r.consequence,
            remedy: r.remedy,
          }))
        : nhtsaRecalls.map((r) => ({
            campaignNumber: r.campaignNumber,
            component: r.component,
            summary: r.summary,
            consequence: r.consequence,
            remedy: r.remedy,
          }));

      // Use the larger recall count (NHTSA may know about recalls VinAudit doesn't and vice versa)
      const openRecallCount = Math.max(
        nhtsaRecalls.length,
        vinAuditHistory?.openRecallCount ?? 0,
      );

      const historyRecord = {
        provider: vinAuditHistory ? "VinAudit" : "NHTSA",
        titleStatus: vinAuditHistory?.titleStatus ?? "CLEAN",
        accidentCount: vinAuditHistory?.accidentCount ?? 0,
        ownerCount: vinAuditHistory?.ownerCount ?? 1,
        serviceRecords: vinAuditHistory?.serviceRecords ?? 0,
        structuralDamage: vinAuditHistory?.structuralDamage ?? false,
        floodDamage: vinAuditHistory?.floodDamage ?? false,
        openRecallCount,
        recalls: JSON.parse(JSON.stringify(allRecalls)),
        rawData: JSON.parse(JSON.stringify({
          nhtsaRecalls,
          vinAuditHistory: vinAuditHistory?.rawData ?? null,
          vinAuditTitleRecords: vinAuditHistory?.titleRecords ?? null,
          vinAuditOdometer: vinAuditHistory?.odometerReadings ?? null,
        })),
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

      // Use location field as ZIP code (or extract ZIP from legacy city strings)
      const locStr = (inspection.location || "").trim();
      const zip = /^\d{5}$/.test(locStr) ? locStr
        : (locStr.match(/\b(\d{5})\b/)?.[1] || "97201");

      // Fetch market value from multi-source consensus engine
      const conditionScore = inspection.overallScore || 70;
      const marketData = await fetchMarketData(
        {
          vin: vehicle.vin,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          bodyStyle: vehicle.bodyStyle,
          drivetrain: vehicle.drivetrain,
          engine: vehicle.engine,
          transmission: vehicle.transmission,
          trim: vehicle.trim,
          nhtsaData: vehicle.nhtsaData as Record<string, unknown> | null,
        },
        zip,
        inspection.odometer || undefined,
        conditionScore,
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

      // ── Acquisition cost adjustment (strip dealer markup from comps) ──
      const compBreakdown = {
        activeDealer: marketData.nearbyListings.filter((l) => !l.source.includes("Sold") && !l.source.includes("Auction")).length,
        soldDealer: marketData.nearbyListings.filter((l) => l.source.includes("Sold") && !l.source.includes("Auction")).length,
        auction: marketData.nearbyListings.filter((l) => l.source.includes("Auction")).length,
        total: marketData.nearbyListings.length,
      };

      const aiAcquisition = await analyzeAcquisitionCost({
        vehicle: {
          year: vehicle.year, make: vehicle.make, model: vehicle.model,
          trim: vehicle.trim, engine: vehicle.engine,
          transmission: vehicle.transmission, drivetrain: vehicle.drivetrain,
        },
        consensusValue: marketData.estimatedValue,
        comps: comparables.map((c) => ({ title: c.title, price: c.price, source: c.source })),
        compBreakdown,
        bodyCategory: classifyBody(vehicle as VehicleConfig),
        conditionScore,
        isEnthusiastPlatform: marketData.aiMetadata?.consensusReasoning?.toLowerCase().includes("enthusiast") || false,
      });

      console.log(
        `[Inspection] Acquisition: ${aiAcquisition.result.acquisitionMultiplier.toFixed(2)}x → $${aiAcquisition.result.acquisitionCost.toLocaleString()} ` +
        `(tier ${aiAcquisition.fallbackTier}) — ${aiAcquisition.reasoning || ""}`,
      );

      // Use acquisition cost as the base (what dealer should pay), not retail consensus
      const basePriceCents = Math.round(aiAcquisition.result.acquisitionCost * 100);
      const retailPriceCents = Math.round(aiAcquisition.result.estimatedRetail * 100);

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

      // ── AI-Powered Valuation ──────────────────────────────────────
      const bodyCategory = classifyBody(vehicle as VehicleConfig);

      // Parallel batch: History + Condition + Recon (all independent)
      const [aiHistoryResult, aiConditionResult, aiReconResult] = await Promise.all([
        analyzeHistoryImpact({
          vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
          bodyCategory,
          baseMarketValue: marketData.estimatedValue,
          history: historyData,
          conditionScore,
          mileage: inspection.odometer || undefined,
        }),
        analyzeConditionValue({
          vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model },
          mileage: inspection.odometer || undefined,
          baseMarketValue: marketData.estimatedValue,
          bodyCategory,
          conditionScore,
          areaScores: {
            exteriorBody: inspection.exteriorBodyScore ?? undefined,
            interior: inspection.interiorScore ?? undefined,
            mechanicalVisual: inspection.mechanicalVisualScore ?? undefined,
            underbodyFrame: inspection.underbodyFrameScore ?? undefined,
          },
          keyObservations: inspection.conditionSummary ? [inspection.conditionSummary] : undefined,
          conditionAttenuation: marketData.conditionAttenuation,
        }),
        estimateReconCosts({
          vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
          zip,
          mileage: inspection.odometer || undefined,
          findings: inspection.findings
            .filter((f) => f.repairCostLow || f.repairCostHigh)
            .map((f) => ({
              title: f.title,
              costLow: f.repairCostLow || undefined,
              costHigh: f.repairCostHigh || undefined,
              category: f.category || undefined,
              severity: f.severity || undefined,
            })),
          baseMarketValue: marketData.estimatedValue,
        }),
      ]);

      const aiConditionMultiplier = aiConditionResult.result.conditionMultiplier;
      const aiHistoryMultiplier = aiHistoryResult.result.historyMultiplier;
      const aiReconCostCents = aiReconResult.result.totalReconCost;

      // Compute fair price: base × condition × history - recon
      const adjustedValueBeforeRecon = Math.round(basePriceCents * aiConditionMultiplier * aiHistoryMultiplier);
      const minFloor = Math.round(basePriceCents * 0.05); // 5% floor
      const fairPurchasePrice = Math.max(minFloor, adjustedValueBeforeRecon - aiReconCostCents);

      // Baseline (what car would be worth in good condition, no recon)
      const baselineResult = calculateFairPrice(basePriceCents, 85, historyData, 0, marketData.conditionAttenuation);

      // Build fairResult-like object for downstream compat
      const fairResult = {
        fairPurchasePrice,
        baseMarketValue: basePriceCents,
        conditionMultiplier: aiConditionMultiplier,
        conditionGrade: getConditionGrade(conditionScore),
        historyMultiplier: aiHistoryMultiplier,
        historyBreakdown: {
          titleFactor: aiHistoryResult.result.breakdown.titleImpact.factor,
          accidentFactor: aiHistoryResult.result.breakdown.accidentImpact.factor,
          ownerFactor: aiHistoryResult.result.breakdown.ownerImpact.factor,
          structuralDamageFactor: aiHistoryResult.result.breakdown.structuralImpact.factor,
          floodDamageFactor: aiHistoryResult.result.breakdown.floodImpact.factor,
          recallFactor: aiHistoryResult.result.breakdown.recallImpact.factor,
        },
        adjustedValueBeforeRecon,
        estReconCost: aiReconCostCents,
      };

      console.log(
        `[Inspection] AI Valuation: condition=${aiConditionMultiplier.toFixed(3)}x (tier ${aiConditionResult.fallbackTier}), ` +
        `history=${aiHistoryMultiplier.toFixed(3)}x (tier ${aiHistoryResult.fallbackTier}), ` +
        `recon=$${(aiReconCostCents / 100).toLocaleString()} (tier ${aiReconResult.fallbackTier}), ` +
        `fairPrice=$${(fairPurchasePrice / 100).toLocaleString()}`,
      );

      // History summary for deal rater
      const historySummary = [
        `Title: ${historyData.titleStatus}`,
        historyData.accidentCount > 0 ? `${historyData.accidentCount} accident(s)` : null,
        historyData.structuralDamage ? "Structural damage" : null,
        historyData.floodDamage ? "Flood damage" : null,
        `${historyData.ownerCount} owner(s)`,
      ].filter(Boolean).join(", ");

      // Sequential: Deal rating (needs fair price)
      const aiDealResult = await rateDeal({
        vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
        fairPurchasePrice,
        baseMarketValue: basePriceCents,
        retailValue: retailPriceCents,
        conditionScore,
        historyMultiplier: aiHistoryMultiplier,
        historySummary,
        reconCostCents: aiReconCostCents,
        mileage: inspection.odometer || undefined,
        nearbyListingCount: marketData.nearbyListings.length || undefined,
      });

      // Sequential: Price auditor (cross-validation)
      const aiAuditResult = await auditPrice({
        vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
        mileage: inspection.odometer || undefined,
        sourcePrices: marketData.sourceResults
          .filter((s) => s.estimatedValue > 0)
          .map((s) => ({ source: s.source, value: s.estimatedValue })),
        consensusValue: marketData.baseValuePreConfig,
        consensusReasoning: marketData.aiMetadata?.consensusReasoning || "",
        configMultiplier: marketData.configMultiplier,
        configReasoning: marketData.aiMetadata?.configReasoning || "",
        regionalMultiplier: marketData.estimatedValue / (marketData.baseValuePreConfig * marketData.configMultiplier) || 1.0,
        regionalReasoning: marketData.aiMetadata?.geoReasoning || "",
        adjustedBaseValueCents: basePriceCents,
        conditionMultiplier: aiConditionMultiplier,
        conditionScore,
        conditionReasoning: aiConditionResult.result.reasoning,
        historyMultiplier: aiHistoryMultiplier,
        historyReasoning: aiHistoryResult.result.combinedReasoning,
        historySummary,
        reconCostCents: aiReconCostCents,
        reconReasoning: aiReconResult.result.totalReasoning,
        fairPurchasePrice,
        dealRating: aiDealResult.result.rating,
        dealReasoning: aiDealResult.result.reasoning,
        // Full vehicle context
        transmission: vehicle.transmission,
        drivetrain: vehicle.drivetrain,
        bodyCategory,
        conditionSummary: inspection.conditionSummary || undefined,
        areaScores: {
          exteriorBody: inspection.exteriorBodyScore ?? undefined,
          interior: inspection.interiorScore ?? undefined,
          mechanicalVisual: inspection.mechanicalVisualScore ?? undefined,
          underbodyFrame: inspection.underbodyFrameScore ?? undefined,
        },
        confirmedFindings: inspection.findings
          .filter((f) => f.repairCostLow || f.repairCostHigh)
          .map((f) => ({ title: f.title, severity: f.severity })),
        comparableListings: marketData.nearbyListings.slice(0, 10).map((l) => ({
          title: l.title, price: l.price, mileage: l.mileage, source: l.source,
        })),
        nearbyListingCount: marketData.nearbyListings.length,
      });

      // Apply auditor correction if not approved
      let finalFairPurchasePrice = fairPurchasePrice;
      if (!aiAuditResult.result.approved && aiAuditResult.result.adjustedFairPrice) {
        console.warn(
          `[Inspection] ⚠ Price auditor REJECTED — flags: ${aiAuditResult.result.flags.join("; ")}`,
        );
        console.warn(
          `[Inspection] Adjusting fair price: $${(fairPurchasePrice / 100).toLocaleString()} → $${(aiAuditResult.result.adjustedFairPrice / 100).toLocaleString()}`,
        );
        finalFairPurchasePrice = aiAuditResult.result.adjustedFairPrice;
      } else {
        console.log(
          `[Inspection] Price auditor APPROVED (coherence: ${(aiAuditResult.result.coherenceScore * 100).toFixed(0)}%)`,
        );
      }

      // Use AI deal rating bands
      const bands = [
        { label: "STRONG_BUY" as const, maxPriceCents: aiDealResult.result.priceBands.strongBuyMax, marginPercent: 0.15 },
        { label: "FAIR_BUY" as const, maxPriceCents: aiDealResult.result.priceBands.fairBuyMax, marginPercent: 0.05 },
        { label: "OVERPAYING" as const, maxPriceCents: aiDealResult.result.priceBands.overpayingMax, marginPercent: 0 },
        { label: "PASS" as const, maxPriceCents: aiDealResult.result.priceBands.overpayingMax, marginPercent: 0 },
      ];

      const recommendation = aiDealResult.result.rating;
      const estGrossProfit = retailPriceCents - finalFairPurchasePrice - aiReconCostCents;

      // Shared data object for create/update
      const marketAnalysisData = {
        comparables: JSON.parse(JSON.stringify(comparables)),
        baselinePrice: basePriceCents,
        adjustments: JSON.parse(JSON.stringify({
          mileage: Math.round(marketData.mileageAdjustment * 100),
          conditionDelta: fairResult.adjustedValueBeforeRecon - basePriceCents,
          historyDelta: Math.round(basePriceCents * fairResult.conditionMultiplier * (fairResult.historyMultiplier - 1)),
        })),
        adjustedPrice: finalFairPurchasePrice,
        recommendation: recommendation as never,
        strongBuyMax: bands[0].maxPriceCents,
        fairBuyMax: bands[1].maxPriceCents,
        overpayingMax: bands[2].maxPriceCents,
        estRetailPrice: retailPriceCents,
        estReconCost: aiReconCostCents,
        estGrossProfit,
        conditionScore,
        conditionMultiplier: fairResult.conditionMultiplier,
        conditionGrade: fairResult.conditionGrade,
        historyMultiplier: fairResult.historyMultiplier,
        historyBreakdown: JSON.parse(JSON.stringify(fairResult.historyBreakdown)),
        fairValueAtBaseline: baselineResult.fairPurchasePrice,
        adjustedValueBeforeRecon: fairResult.adjustedValueBeforeRecon,
        priceBands: JSON.parse(JSON.stringify(bands)),
        // Multi-source pricing metadata
        dataSource: marketData.dataSource,
        dataSourceConfidence: marketData.confidence,
        configPremiums: marketData.configPremiums.length > 0
          ? JSON.parse(JSON.stringify(marketData.configPremiums))
          : undefined,
        configMultiplier: marketData.configMultiplier !== 1.0
          ? marketData.configMultiplier
          : undefined,
        baseValuePreConfig: marketData.baseValuePreConfig !== marketData.estimatedValue
          ? Math.round(marketData.baseValuePreConfig * 100)
          : undefined,

        // Five-perspective pricing (cents)
        tradeInValue: Math.round(marketData.tradeInValue * 100),
        privatePartyValue: Math.round(marketData.privatePartyValue * 100),
        dealerRetailValue: Math.round(marketData.dealerRetailValue * 100),
        wholesaleValue: Math.round((marketData.wholesaleValue || 0) * 100) || undefined,
        loanValue: Math.round((marketData.loanValue || 0) * 100) || undefined,

        // Condition tier + consensus metadata
        vdbConditionTier: marketData.vdbConditionTier,
        sourceResults: JSON.parse(JSON.stringify(
          marketData.sourceResults.map((s) => ({
            source: s.source,
            estimatedValue: s.estimatedValue,
            tradeInValue: s.tradeInValue,
            dealerRetailValue: s.dealerRetailValue,
            wholesaleValue: s.wholesaleValue || 0,
            loanValue: s.loanValue || 0,
            confidence: s.confidence,
            isConditionTiered: s.isConditionTiered,
          })),
        )),
        consensusMethod: marketData.consensusMethod,
        configPremiumMode: marketData.configPremiumMode,
        conditionAttenuation: marketData.conditionAttenuation,
        sourceCount: marketData.sourceCount,

        // AI auditor result
        aiAuditorApproved: aiAuditResult.result.approved,
        aiAuditorCoherence: aiAuditResult.result.coherenceScore,
        aiAuditorFlags: aiAuditResult.result.flags.length > 0
          ? JSON.parse(JSON.stringify(aiAuditResult.result.flags))
          : undefined,
        aiAuditorReasoning: aiAuditResult.result.reasoning || undefined,
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

      // ── Log AI valuation calls for training data ──────────────────
      const aiLogs = [
        { module: "acquisition", model: aiAcquisition.model, fallbackTier: aiAcquisition.fallbackTier, retried: aiAcquisition.retried, input: { consensusValue: marketData.estimatedValue, compBreakdown }, output: aiAcquisition.result, reasoning: aiAcquisition.reasoning },
        { module: "consensus", model: "gpt-4o", fallbackTier: marketData.aiMetadata?.consensusTier ?? 1, retried: false, input: { vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim }, sourceCount: marketData.sourceCount }, output: { consensusValue: marketData.baseValuePreConfig, confidence: marketData.confidence }, reasoning: marketData.aiMetadata?.consensusReasoning },
        { module: "config_premium", model: "gpt-4o", fallbackTier: marketData.aiMetadata?.configPremiumTier ?? 1, retried: false, input: { vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim }, bodyCategory, baseConsensusValue: marketData.baseValuePreConfig }, output: { configMultiplier: marketData.configMultiplier }, reasoning: marketData.aiMetadata?.configReasoning },
        { module: "geo_pricing", model: "gpt-4o-mini", fallbackTier: marketData.aiMetadata?.geoPricingTier ?? 1, retried: false, input: { bodyCategory, zip }, output: { regionalMultiplier: marketData.configMultiplier > 0 ? marketData.estimatedValue / (marketData.baseValuePreConfig * marketData.configMultiplier) : 1.0 }, reasoning: marketData.aiMetadata?.geoReasoning },
        { module: "history", model: aiHistoryResult.model, fallbackTier: aiHistoryResult.fallbackTier, retried: aiHistoryResult.retried, input: { vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model }, history: historyData, conditionScore }, output: aiHistoryResult.result, reasoning: aiHistoryResult.reasoning },
        { module: "condition", model: aiConditionResult.model, fallbackTier: aiConditionResult.fallbackTier, retried: aiConditionResult.retried, input: { vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model }, conditionScore, mileage: inspection.odometer }, output: aiConditionResult.result, reasoning: aiConditionResult.reasoning },
        { module: "recon", model: aiReconResult.model, fallbackTier: aiReconResult.fallbackTier, retried: aiReconResult.retried, input: { vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model }, findingCount: inspection.findings.length, zip }, output: aiReconResult.result, reasoning: aiReconResult.reasoning },
        { module: "deal_rating", model: aiDealResult.model, fallbackTier: aiDealResult.fallbackTier, retried: aiDealResult.retried, input: { fairPurchasePrice: finalFairPurchasePrice, baseMarketValue: basePriceCents, conditionScore }, output: aiDealResult.result, reasoning: aiDealResult.reasoning },
        { module: "auditor", model: aiAuditResult.model, fallbackTier: aiAuditResult.fallbackTier, retried: aiAuditResult.retried, input: { fairPurchasePrice: finalFairPurchasePrice, consensusValue: marketData.baseValuePreConfig }, output: aiAuditResult.result, reasoning: aiAuditResult.reasoning, auditorApproved: aiAuditResult.result.approved, auditorCoherence: aiAuditResult.result.coherenceScore, auditorFlags: aiAuditResult.result.flags, auditorAdjustment: aiAuditResult.result.adjustedFairPrice ? (aiAuditResult.result.adjustedFairPrice - fairPurchasePrice) : undefined },
      ];

      // Fire-and-forget: don't block the response for logging
      ctx.db.valuationLog.createMany({
        data: aiLogs.map((log) => ({
          inspectionId: input.inspectionId,
          module: log.module,
          model: log.model || "unknown",
          fallbackTier: log.fallbackTier,
          retried: log.retried || false,
          input: JSON.parse(JSON.stringify(log.input || {})),
          output: JSON.parse(JSON.stringify(log.output || {})),
          reasoning: log.reasoning || null,
          auditorApproved: log.auditorApproved ?? null,
          auditorCoherence: log.auditorCoherence ?? null,
          auditorFlags: log.auditorFlags ? JSON.parse(JSON.stringify(log.auditorFlags)) : null,
          auditorAdjustment: log.auditorAdjustment ?? null,
        })),
      }).catch((err: unknown) => console.error("[ValuationLog] Failed to save logs:", err));

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

  // Confirm odometer reading (from AI OCR or manual entry)
  confirmOdometer: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
      odometer: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.inspection.update({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        data: { odometer: input.odometer },
      });
      return { success: true, odometer: input.odometer };
    }),

  // Record purchase outcome (training data for AI accuracy)
  recordOutcome: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
      outcome: z.enum(["PURCHASED", "PASSED"]),
      purchasePrice: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.inspection.update({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        data: {
          purchaseOutcome: input.outcome,
          purchasePrice: input.outcome === "PURCHASED" ? (input.purchasePrice ?? null) : null,
          outcomeRecordedAt: new Date(),
        },
      });
      return { success: true };
    }),

  // Count inspections awaiting outcome (for dashboard nudge)
  pendingOutcomes: protectedProcedure
    .query(async ({ ctx }) => {
      const count = await ctx.db.inspection.count({
        where: {
          orgId: ctx.orgId,
          status: "COMPLETED",
          purchaseOutcome: null,
          completedAt: { not: null },
        },
      });
      return { count };
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
