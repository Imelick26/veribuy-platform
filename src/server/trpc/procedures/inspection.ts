import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import { router, protectedProcedure } from "../init";
import { analyzeRiskMedia, scanForUnexpectedIssues, analyzeVehicleCondition, estimateTireReplacementCost, extractVinFromPhoto, extractOdometerFromPhoto } from "@/lib/ai/media-analyzer";
import { type AnalysisProgressData, safeEmitter } from "@/lib/ai/media-analyzer/progress";
import { fetchMarketData, type AcquisitionType } from "@/lib/market-data";
import { fetchRecalls } from "@/lib/nhtsa";
import { fetchVehicleHistory as fetchVinAuditHistory } from "@/lib/vinaudit";
import { reportSuccess, reportFailure } from "@/lib/api-health";
import { getConditionGrade, type HistoryData } from "@/lib/market-valuation";
import { classifyBody, type VehicleConfig } from "@/lib/config-premiums";
import type { AggregatedRiskProfile, AIAnalysisResult, OverallConditionResult, ConditionAssessment } from "@/types/risk";
import { persistConditionScores, recalculateScores } from "@/lib/scoring";
import type { PreliminaryFinding, FindingReview } from "@/lib/scoring";
import { analyzeHistoryImpact } from "@/lib/ai/history-adjuster";
import { estimateReconCosts } from "@/lib/ai/recon-estimator";
import { auditPrice } from "@/lib/ai/price-auditor";
import { decomposeOfferGap } from "@/lib/ai/offer-cost-decomposition";
import { determineConditionWeights } from "@/lib/ai/condition-weighter";

// Generate sequential inspection number (uses max to avoid collisions after deletions)
async function generateInspectionNumber(db: typeof import("@/server/db").db) {
  const year = new Date().getFullYear();
  const prefix = `VB-${year}-`;

  // Find the highest existing number
  const latest = await db.inspection.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const lastNum = latest ? parseInt(latest.number.replace(prefix, ""), 10) : 0;
  const candidate = `${prefix}${String(lastNum + 1).padStart(5, "0")}`;

  // Safety check: if it still exists (shouldn't happen), use timestamp
  const exists = await db.inspection.findFirst({ where: { number: candidate }, select: { id: true } });
  if (exists) {
    return `${prefix}${String(lastNum + 2).padStart(5, "0")}`;
  }
  return candidate;
}

export const inspectionRouter = router({
  // Lightweight query polled by the client while the AI condition scan is running.
  // Progress is persisted by the pipeline into InspectionStep.data.analysisProgress
  // so serverless function instances all see the same state.
  getAnalysisProgress: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Scope check — confirm the caller has access to this inspection.
      const inspection = await ctx.db.inspection.findFirst({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        select: { id: true },
      });
      if (!inspection) return null;

      const step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_CONDITION_SCAN",
          },
        },
        select: { data: true },
      });
      const data = step?.data as { analysisProgress?: AnalysisProgressData } | null;
      return data?.analysisProgress ?? null;
    }),

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
                { step: "CONDITION_REVIEW" },
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
      const isSuperAdmin = (ctx.session.user as Record<string, unknown>).role === "SUPER_ADMIN";
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.id, ...(isSuperAdmin ? {} : { orgId: ctx.orgId }) },
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

      // Fire-and-forget: generate AI condition weights for the 9-bucket scoring system.
      // Non-blocking — if it fails, the system falls back to default weights.
      determineConditionWeights({
        vehicle: {
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim,
          engine: vehicle.engine,
          drivetrain: vehicle.drivetrain,
          bodyStyle: vehicle.bodyStyle,
        },
        mileage: inspection.odometer,
      }).then(async (result) => {
        await ctx.db.inspection.update({
          where: { id: input.inspectionId },
          data: { conditionWeights: result.result.weights as any },
        });
        console.log(`[Inspection] Condition weights set (tier ${result.fallbackTier}): ${JSON.stringify(result.result.weights)}`);
      }).catch((err) => {
        console.warn(`[Inspection] Condition weight generation failed (will use defaults): ${err instanceof Error ? err.message : err}`);
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
    .input(z.object({ inspectionId: z.string(), inspectorNotes: z.string().optional() }))
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

      // Run condition assessment pipeline + odometer OCR in parallel
      // The pipeline internally handles condition scoring, defect detection,
      // tire assessment, and cross-correlation — no need for separate calls.
      const odometerPhoto = mediaForAnalysis.find((m) => m.captureType === "ODOMETER");

      // Progress emitter: persist each update into InspectionStep.data.analysisProgress
      // so the client's polling query (which may hit a different serverless instance
      // on Vercel) can read the same value. We merge rather than overwrite so any
      // other keys on `data` survive.
      const inspectionId = input.inspectionId;
      const onProgress = safeEmitter(async (progress) => {
        const existing = await ctx.db.inspectionStep.findUnique({
          where: { inspectionId_step: { inspectionId, step: "AI_CONDITION_SCAN" } },
          select: { data: true },
        });
        const base = (existing?.data as Record<string, unknown> | null) ?? {};
        await ctx.db.inspectionStep.update({
          where: { inspectionId_step: { inspectionId, step: "AI_CONDITION_SCAN" } },
          data: { data: { ...base, analysisProgress: progress } },
        });
      });

      const [conditionAssessment, odometerResult] = await Promise.all([
        analyzeVehicleCondition(vehicleInfo, mediaForAnalysis, input.inspectorNotes, onProgress),
        odometerPhoto && !inspection.odometer
          ? extractOdometerFromPhoto(odometerPhoto.url, inspection.vehicle.year)
          : Promise.resolve(null),
      ]);

      // Build preliminary findings from the pipeline for inspector verification.
      // Scores and findings are NOT persisted yet — they go to CONDITION_REVIEW.
      // Note: runPipeline is memoized per media set, so this second call shares
      // the same in-flight result as the analyzeVehicleCondition call above.
      const pipelineFindings = await scanForUnexpectedIssues(vehicleInfo, mediaForAnalysis, onProgress);
      const preliminaryFindings = pipelineFindings.unexpectedFindings
        .filter((uf) => uf.confidence >= 0.4) // Low threshold — flag anything uncertain for inspector review
        .map((uf, index) => ({
          index,
          title: uf.title,
          description: uf.description,
          severity: uf.severity,
          category: uf.category || "OTHER",
          confidence: uf.confidence,
          photoIndex: uf.photoIndex,
          photoId: uf.photoIndex >= 0 && uf.photoIndex < mediaForAnalysis.length
            ? mediaForAnalysis[uf.photoIndex].id
            : null,
        }));

      // Build tire finding if applicable (also preliminary — awaits verification)
      const tireResult = conditionAssessment.tireAssessment;
      if (tireResult) {
        const tires = [
          { pos: "Front Left", ...tireResult.frontDriver },
          { pos: "Front Right", ...tireResult.frontPassenger },
          { pos: "Rear Left", ...tireResult.rearDriver },
          { pos: "Rear Right", ...tireResult.rearPassenger },
        ];
        const replaceCount = tires.filter((t) => t.condition === "REPLACE").length;
        const wornCount = tires.filter((t) => t.condition === "WORN").length;
        const needsAttention = replaceCount + wornCount;

        if (needsAttention > 0) {
          const tireCost = await estimateTireReplacementCost(vehicleInfo, needsAttention);
          const positions = tires
            .filter((t) => t.condition === "REPLACE" || t.condition === "WORN")
            .map((t) => `${t.pos} (${t.condition.toLowerCase()})`)
            .join(", ");

          preliminaryFindings.push({
            index: preliminaryFindings.length,
            title: `Tire Replacement (${needsAttention} tire${needsAttention > 1 ? "s" : ""})`,
            description: `${positions}. ${tireResult.summary}`,
            severity: replaceCount > 0 ? "MAJOR" : "MODERATE",
            category: "TIRES_WHEELS",
            confidence: 0.9,
            photoIndex: -1,
            photoId: null,
          });
        }
      }

      console.log(`[Inspection] AI scan complete: ${preliminaryFindings.length} preliminary findings awaiting verification`);

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

      // Store PRELIMINARY results in step data — scores and findings are NOT final yet.
      // The inspector will verify each finding in the CONDITION_REVIEW step.
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
            inspectorNotes: input.inspectorNotes || null,
            preliminaryFindings,
            odometerOCR: odometerResult ? {
              mileage: odometerResult.mileage,
              confidence: odometerResult.confidence,
            } : null,
          })),
        },
      });

      // Also enter the CONDITION_REVIEW step so it's ready for the inspector
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "CONDITION_REVIEW",
          },
        },
        data: {
          status: "IN_PROGRESS",
          enteredAt: new Date(),
        },
      }).catch(() => {
        // CONDITION_REVIEW step might not exist on older inspections
      });

      return {
        conditionAssessment,
        preliminaryFindings,
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
          report: { select: { id: true } },
          marketAnalysis: {
            select: {
              recommendation: true,
              estRetailPrice: true,
              estReconCost: true,
              adjustedPrice: true,
              conditionMultiplier: true,
              historyMultiplier: true,
            },
          },
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
          "CONDITION_REVIEW", "RISK_INSPECTION",
          "VEHICLE_HISTORY", "MARKET_ANALYSIS", "REPORT_GENERATION",
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
        CONDITION_REVIEW: "CONDITION_REVIEWED",
        RISK_INSPECTION: "RISK_REVIEWED",
        VEHICLE_HISTORY: "AI_ANALYZED",
        MARKET_ANALYSIS: "COMPLETED",
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
          ...((input.step === "MARKET_ANALYSIS" || input.step === "REPORT_GENERATION")
            ? { completedAt: new Date() }
            : {}),
        },
      });

      // When MARKET_ANALYSIS is advanced, also auto-advance REPORT_GENERATION
      // so the inspection is fully completed (report is generated from vehicle dashboard)
      if (input.step === "MARKET_ANALYSIS") {
        await ctx.db.inspectionStep.update({
          where: {
            inspectionId_step: {
              inspectionId: input.inspectionId,
              step: "REPORT_GENERATION",
            },
          },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        }).catch(() => {
          // REPORT_GENERATION step might not exist on older inspections
        });
      }

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
      // Prevent duplicate findings — if one with the same title already exists, return it
      const existing = await ctx.db.finding.findFirst({
        where: {
          inspectionId: input.inspectionId,
          title: input.title,
        },
      });
      if (existing) return existing;

      const finding = await ctx.db.finding.create({
        data: input,
      });

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

      // Run risk-specific analysis only — pipeline defect detection already
      // happened in runConditionScan and created Finding records there.
      const riskResults = await analyzeRiskMedia(
        vehicleInfo,
        riskProfile.aggregatedRisks,
        mediaForAnalysis,
        questionAnswersByRisk as Record<string, import("@/types/risk").QuestionAnswer[]>,
      );

      // Auto-create findings for CONFIRMED risks with evidence linking
      for (const result of riskResults) {
        if (result.verdict === "CONFIRMED") {
          const risk = riskProfile.aggregatedRisks.find((r) => r.id === result.riskId);
          if (risk) {
            // Check for duplicate (pipeline may have already found this defect)
            const existingFinding = await ctx.db.finding.findFirst({
              where: { inspectionId: input.inspectionId, title: risk.title },
            });
            if (existingFinding) continue;

            const finding = await ctx.db.finding.create({
              data: {
                inspectionId: input.inspectionId,
                title: risk.title,
                description: result.explanation,
                severity: risk.severity as never,
                category: risk.category as never,
                evidence: `AI Risk Analysis (${Math.round(result.confidence * 100)}% confidence): ${result.explanation}`,
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

      // Store risk analysis results in the AI_ANALYSIS step data
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
          })),
        },
      });

      return {
        riskResults: riskResults as AIAnalysisResult[],
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

      // Fetch NHTSA recalls (free) — non-blocking if API is flaky
      let nhtsaRecalls: Awaited<ReturnType<typeof fetchRecalls>> = [];
      try {
        nhtsaRecalls = await fetchRecalls(
          vehicle.make,
          vehicle.model,
          vehicle.year,
        );
      } catch (err) {
        console.warn(`[History] NHTSA recalls fetch failed, continuing without: ${err instanceof Error ? err.message : err}`);
      }

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

      // CRITICAL: when VinAudit fails, we previously populated the record with
      // what looked like a clean bill of health (CLEAN title, 0 accidents, 1
      // owner). That misled dealers. Now the provider is "UNKNOWN" and the
      // rawData flag surfaces the failure so the UI can warn the dealer.
      const historyRecord = {
        provider: vinAuditHistory ? "VinAudit" : "UNKNOWN",
        titleStatus: vinAuditHistory?.titleStatus ?? "UNKNOWN",
        accidentCount: vinAuditHistory?.accidentCount ?? 0,
        ownerCount: vinAuditHistory?.ownerCount ?? 0,
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
          // When VinAudit isn't available, record a warning so downstream
          // consumers (report template, MarketAnalysisSection) can disclose
          // that title/accident/owner data is unverified rather than treating
          // the placeholder zeros as a clean history.
          vinAuditAvailable: !!vinAuditHistory,
          historyWarning: vinAuditHistory
            ? null
            : "Vehicle history unavailable from VinAudit — title, accident, and owner counts are not verified. Check server logs for the specific VinAudit failure.",
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

  // Fetch market analysis using Black Book + AI intelligence pipeline
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

      // Get condition score — prefer inspection record, fall back to condition scan step data
      let conditionScore = inspection.overallScore || 0;
      if (!conditionScore) {
        const conditionStep = await ctx.db.inspectionStep.findUnique({
          where: { inspectionId_step: { inspectionId: input.inspectionId, step: "AI_CONDITION_SCAN" } },
        });
        const condData = conditionStep?.data as { conditionAssessment?: { overallScore?: number } } | null;
        conditionScore = condData?.conditionAssessment?.overallScore || 70;
      }
      // Read acquisition type from inspection (default WHOLESALE)
      const acquisitionType = (inspection.acquisitionType as AcquisitionType) || "WHOLESALE";

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
        acquisitionType,
      );

      // BB values are already in cents from market-data.ts
      const retailCents = marketData.marketValidatedRetail; // BB retail × market adjustment
      const bbRetailCents = marketData.retailValue;         // raw BB retail for reference

      // Build comparables for storage
      const comparables = marketData.comparables.map((c) => ({
        title: c.title,
        price: c.price,
        mileage: c.mileage,
        location: c.location,
        source: c.source,
        daysOnMarket: c.daysOnMarket,
      }));

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

      // ── AI-Powered Valuation (BB interpolated + market adjusted) ──
      const bodyCategory = classifyBody(vehicle as VehicleConfig);
      const adjustedRetailDollars = Math.round(retailCents / 100);

      // Parallel: History + Recon (condition is in the BB tier, interpolated)
      const [aiHistoryResult, aiReconResult] = await Promise.all([
        analyzeHistoryImpact({
          vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
          bodyCategory,
          baseMarketValue: adjustedRetailDollars,
          history: historyData,
          conditionScore,
          mileage: inspection.odometer || undefined,
        }),
        estimateReconCosts({
          vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
          zip,
          mileage: inspection.odometer || undefined,
          findings: (() => {
            const confirmed = inspection.findings
              .filter((f) => f.repairCostLow || f.repairCostHigh)
              .map((f) => ({
                title: f.title,
                costLow: f.repairCostLow || undefined,
                costHigh: f.repairCostHigh || undefined,
                category: f.category || undefined,
                severity: f.severity || undefined,
              }));

            // Include tire replacement if tires need attention
            const rawData = inspection.conditionRawData as Record<string, unknown> | null;
            const tireAssessment = rawData?.tireAssessment as {
              frontDriver?: { condition: string };
              frontPassenger?: { condition: string };
              rearDriver?: { condition: string };
              rearPassenger?: { condition: string };
              summary?: string;
            } | null;

            if (tireAssessment) {
              const tires = [
                { pos: "Front Left", condition: tireAssessment.frontDriver?.condition },
                { pos: "Front Right", condition: tireAssessment.frontPassenger?.condition },
                { pos: "Rear Left", condition: tireAssessment.rearDriver?.condition },
                { pos: "Rear Right", condition: tireAssessment.rearPassenger?.condition },
              ];
              const replaceCount = tires.filter((t) => t.condition === "REPLACE").length;
              const wornCount = tires.filter((t) => t.condition === "WORN").length;

              if (replaceCount > 0) {
                confirmed.push({
                  title: `Tire Replacement (${replaceCount} tire${replaceCount > 1 ? "s" : ""})`,
                  costLow: replaceCount * 15000,
                  costHigh: replaceCount * 30000,
                  category: "TIRES_WHEELS",
                  severity: "MAJOR",
                });
              }

              if (wornCount > 0) {
                const positions = tires
                  .filter((t) => t.condition === "WORN")
                  .map((t) => `${t.pos} (worn)`)
                  .join(", ");
                confirmed.push({
                  title: `Tire Replacement — Worn (${wornCount} tire${wornCount > 1 ? "s" : ""}: ${positions})`,
                  costLow: wornCount * 12000,
                  costHigh: wornCount * 25000,
                  category: "TIRES_WHEELS",
                  severity: "MODERATE",
                });
              }
            }

            return confirmed;
          })(),
          baseMarketValue: adjustedRetailDollars,
        }),
      ]);

      const aiHistoryMultiplier = aiHistoryResult.result.historyMultiplier;
      const aiReconCostCents = aiReconResult.result.totalReconCost;

      // ── Dealer offer calculation ──────────────────────────────────
      // adjustedRetailDollars = BB interpolated retail × AI market adjustment
      // Only remaining adjustment is history (title/accident/flood — BB doesn't know this)
      const estRetailDollars = Math.round(adjustedRetailDollars * aiHistoryMultiplier);
      const reconDollars = Math.round(aiReconCostCents / 100);

      // Get org's target margin setting
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.orgId },
        select: { targetMarginPercent: true },
      });
      const marginPercent = (org?.targetMarginPercent ?? 25) / 100;

      // Max offer = (1 - margin%) of retail - recon
      const maxOfferBeforeRecon = Math.round(estRetailDollars * (1 - marginPercent));
      const maxOfferDollars = Math.max(
        500, // $500 absolute floor — prevents negative/zero offers
        maxOfferBeforeRecon - reconDollars,
      );
      const fairPurchasePrice = maxOfferDollars * 100; // cents

      // Warn if offer is very low relative to retail
      if (maxOfferDollars < estRetailDollars * 0.15) {
        console.warn(
          `[Inspection] WARNING: Fair price $${maxOfferDollars.toLocaleString()} is <15% of est. retail $${estRetailDollars.toLocaleString()} — this vehicle may not be worth acquiring`,
        );
      }

      const estRetailCents = Math.round(estRetailDollars * 100);
      const estGrossProfit = estRetailCents - fairPurchasePrice - aiReconCostCents;

      // History summary for auditor
      const historySummary = [
        `Title: ${historyData.titleStatus}`,
        historyData.accidentCount > 0 ? `${historyData.accidentCount} accident(s)` : null,
        historyData.structuralDamage ? "Structural damage" : null,
        historyData.floodDamage ? "Flood damage" : null,
        `${historyData.ownerCount} owner(s)`,
      ].filter(Boolean).join(", ");

      console.log(
        `[Inspection] Pricing (${marketData.conditionTier}, score ${conditionScore}, ${acquisitionType}): ` +
        `bbRetail=$${(bbRetailCents / 100).toLocaleString()}, interpolated=$${adjustedRetailDollars.toLocaleString()}, ` +
        `mktAdj=${marketData.marketAdjustment.toFixed(2)}x (${marketData.demandSignal}), ` +
        `history=${aiHistoryMultiplier.toFixed(3)}x, recon=$${reconDollars.toLocaleString()}, ` +
        `estRetail=$${estRetailDollars.toLocaleString()}, fairPrice=$${maxOfferDollars.toLocaleString()}`,
      );

      // ── AI Price Auditor (second opinion — dealer can accept or decline) ──
      const aiAuditResult = await auditPrice({
        vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim, engine: vehicle.engine },
        mileage: inspection.odometer || undefined,
        sourcePrices: [{ source: "blackbook", value: Math.round(bbRetailCents / 100) }, { source: "bb_interpolated", value: Math.round(marketData.retailValue / 100) }, { source: "market_validated", value: adjustedRetailDollars }],
        consensusValue: adjustedRetailDollars,
        consensusReasoning: `BB ${marketData.conditionTier} tier (score ${conditionScore} interpolated)${marketData.marketAdjustment !== 1.0 ? `, AI market adj ${marketData.marketAdjustment.toFixed(2)}x (${marketData.demandSignal})` : ""}`,
        configMultiplier: 1.0,
        configReasoning: "BB prices specific VIN — no config premium needed",
        regionalMultiplier: 1.0,
        regionalReasoning: "BB includes regional adjustment via state parameter",
        adjustedBaseValueCents: retailCents,
        conditionMultiplier: 1.0,
        conditionScore,
        conditionReasoning: `Condition score ${conditionScore} → BB ${marketData.conditionTier} tier (interpolated between tier values)`,
        historyMultiplier: aiHistoryMultiplier,
        historyReasoning: aiHistoryResult.result.combinedReasoning,
        historySummary,
        reconCostCents: aiReconCostCents,
        reconReasoning: aiReconResult.result.totalReasoning,
        fairPurchasePrice,
        dealRating: "N/A",
        dealReasoning: "Deal rating removed — dealer controls margin directly",
        transmission: vehicle.transmission,
        drivetrain: vehicle.drivetrain,
        bodyCategory,
        conditionSummary: inspection.conditionSummary || undefined,
        areaScores: {
          paintBody: inspection.paintBodyScore ?? undefined,
          glassLighting: inspection.glassLightingScore ?? undefined,
          interiorSurfaces: inspection.interiorSurfacesScore ?? undefined,
          interiorControls: inspection.interiorControlsScore ?? undefined,
          engineBay: inspection.engineBayScore ?? undefined,
          tiresWheels: inspection.tiresWheelsScore ?? undefined,
          underbodyFrame: inspection.underbodyFrameScore ?? undefined,
          exhaust: inspection.exhaustScore ?? undefined,
        },
        confirmedFindings: inspection.findings
          .filter((f) => f.repairCostLow || f.repairCostHigh)
          .map((f) => ({ title: f.title, severity: f.severity })),
        comparableListings: marketData.comparables.slice(0, 10).map((c) => ({
          title: c.title, price: c.price, mileage: c.mileage, source: c.source,
        })),
        nearbyListingCount: marketData.comparables.length,
        wholesaleValue: marketData.wholesaleValue,
        tradeInValue: marketData.tradeInValue,
        targetMarginPercent: Math.round(marginPercent * 100),
      });

      // Don't auto-apply auditor adjustments — store for dealer to review
      if (!aiAuditResult.result.approved) {
        console.warn(
          `[Inspection] AI auditor DISAGREES — flags: ${aiAuditResult.result.flags.join("; ")}`,
        );
        if (aiAuditResult.result.adjustedFairPrice) {
          console.warn(
            `[Inspection] AI suggests: $${(aiAuditResult.result.adjustedFairPrice / 100).toLocaleString()} (dealer will decide)`,
          );
        }
      } else {
        console.log(
          `[Inspection] AI auditor AGREES (coherence: ${(aiAuditResult.result.coherenceScore * 100).toFixed(0)}%)`,
        );
      }

      // Build history breakdown
      const historyBreakdown = {
        titleFactor: aiHistoryResult.result.breakdown.titleImpact.factor,
        accidentFactor: aiHistoryResult.result.breakdown.accidentImpact.factor,
        ownerFactor: aiHistoryResult.result.breakdown.ownerImpact.factor,
        structuralDamageFactor: aiHistoryResult.result.breakdown.structuralImpact.factor,
        floodDamageFactor: aiHistoryResult.result.breakdown.floodImpact.factor,
        recallFactor: aiHistoryResult.result.breakdown.recallImpact.factor,
      };

      // Shared data object for create/update
      const marketAnalysisData = {
        comparables: JSON.parse(JSON.stringify(comparables)),
        baselinePrice: marketData.acquisitionValue,
        adjustments: JSON.parse(JSON.stringify({
          historyDelta: Math.round(retailCents * (aiHistoryMultiplier - 1)),
          marketAdjustment: marketData.marketAdjustment,
        })),
        adjustedPrice: fairPurchasePrice,

        // No deal recommendation in BB pipeline
        recommendation: undefined,
        strongBuyMax: undefined,
        fairBuyMax: undefined,
        overpayingMax: undefined,
        priceBands: Prisma.DbNull,

        estRetailPrice: estRetailCents,
        estReconCost: aiReconCostCents,
        estGrossProfit,
        conditionScore,
        conditionMultiplier: 1.0, // Condition is in the BB tier
        conditionGrade: getConditionGrade(conditionScore),
        historyMultiplier: aiHistoryMultiplier,
        historyBreakdown: JSON.parse(JSON.stringify(historyBreakdown)),
        adjustedValueBeforeRecon: estRetailCents,

        // Black Book data
        dataSource: marketData.dataSource,
        dataSourceConfidence: marketData.confidence,
        acquisitionType,
        bbConditionTier: marketData.conditionTier,
        bbRetailByTier: JSON.parse(JSON.stringify(marketData.bbRetailByTier)),
        bbWholesaleByTier: JSON.parse(JSON.stringify(marketData.bbWholesaleByTier)),
        bbTradeInByTier: JSON.parse(JSON.stringify(marketData.bbTradeInByTier)),
        marketAdjustment: marketData.marketAdjustment !== 1.0 ? marketData.marketAdjustment : undefined,
        marketAdjustmentNote: marketData.marketAdjustmentNote || undefined,

        // Perspective pricing (cents)
        tradeInValue: marketData.tradeInValue,
        dealerRetailValue: retailCents,
        wholesaleValue: marketData.wholesaleValue,

        // Single-source metadata
        sourceCount: 1,
        consensusMethod: "bb-interpolated",

        // AI auditor result (dealer reviews, not auto-applied)
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
        { module: "market-intelligence", model: "gpt-4o", fallbackTier: 1 as const, retried: false, input: { bbInterpolatedRetail: adjustedRetailDollars, conditionTier: marketData.conditionTier, compsCount: marketData.comparables.length, demandSignal: marketData.demandSignal }, output: { marketAdjustment: marketData.marketAdjustment, demandSignal: marketData.demandSignal, flags: marketData.marketFlags }, reasoning: marketData.marketAdjustmentNote },
        { module: "history", model: aiHistoryResult.model, fallbackTier: aiHistoryResult.fallbackTier, retried: aiHistoryResult.retried, input: { vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model }, history: historyData, conditionScore }, output: aiHistoryResult.result, reasoning: aiHistoryResult.reasoning },
        { module: "recon", model: aiReconResult.model, fallbackTier: aiReconResult.fallbackTier, retried: aiReconResult.retried, input: { vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model }, findingCount: inspection.findings.length, zip }, output: aiReconResult.result, reasoning: aiReconResult.reasoning },
        { module: "auditor", model: aiAuditResult.model, fallbackTier: aiAuditResult.fallbackTier, retried: aiAuditResult.retried, input: { bbRetailCents, interpolatedRetail: adjustedRetailDollars, bbConditionTier: marketData.conditionTier, marketAdjustment: marketData.marketAdjustment, demandSignal: marketData.demandSignal, compsCount: marketData.comparables.length }, output: aiAuditResult.result, reasoning: aiAuditResult.reasoning, auditorApproved: aiAuditResult.result.approved, auditorCoherence: aiAuditResult.result.coherenceScore, auditorFlags: aiAuditResult.result.flags, auditorAdjustment: aiAuditResult.result.adjustedFairPrice ? (aiAuditResult.result.adjustedFairPrice - fairPurchasePrice) : undefined },
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

      // Server-side completion guarantee: mark inspection as COMPLETED
      // so the vehicle appears in the vehicles list even if the client-side
      // advanceStep call fails or never fires
      await ctx.db.inspection.update({
        where: { id: input.inspectionId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Auto-complete REPORT_GENERATION step (mirrors advanceStep logic)
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "REPORT_GENERATION",
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      }).catch(() => {
        // REPORT_GENERATION step might not exist on older inspections
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
      const isSuperAdmin = (ctx.session.user as Record<string, unknown>).role === "SUPER_ADMIN";
      await ctx.db.inspection.update({
        where: { id: input.inspectionId, ...(isSuperAdmin ? {} : { orgId: ctx.orgId }) },
        data: {
          purchaseOutcome: input.outcome,
          purchasePrice: input.outcome === "PURCHASED" ? (input.purchasePrice ?? null) : null,
          outcomeRecordedAt: new Date(),
        },
      });
      return { success: true };
    }),

  // Set offer mode and notes (AI-estimated cost breakdown or custom dealer notes)
  setOfferMode: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
      mode: z.enum(["AI_ESTIMATED", "CUSTOM_NOTES"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const isSuperAdmin = (ctx.session.user as Record<string, unknown>).role === "SUPER_ADMIN";
      const inspection = await ctx.db.inspection.findFirstOrThrow({
        where: { id: input.inspectionId, ...(isSuperAdmin ? {} : { orgId: ctx.orgId }) },
        include: { vehicle: true, marketAnalysis: true },
      });

      if (input.mode === "CUSTOM_NOTES") {
        await ctx.db.inspection.update({
          where: { id: input.inspectionId },
          data: {
            offerMode: "CUSTOM_NOTES",
            offerNotes: input.notes || null,
            offerCostBreakdown: Prisma.DbNull,
          },
        });
        return { success: true, mode: "CUSTOM_NOTES" as const };
      }

      // AI_ESTIMATED: compute cost breakdown
      const ma = inspection.marketAnalysis;
      if (!ma) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Market analysis not yet completed" });

      // Valuation = the value before dealer margin (offer + margin portion)
      // We use adjustedValueBeforeRecon or compute from estRetail
      const valuationCents = (ma.adjustedValueBeforeRecon as number | null) || ma.estRetailPrice || ma.baselinePrice;
      const offerCents = ma.fairBuyMax || ma.adjustedPrice;
      const reconCents = ma.estReconCost || 0;

      // Compute avg days on market from comparables
      const comps = (ma.comparables as Array<{ daysOnMarket?: number }>) || [];
      const compsWithDom = comps.filter((c) => c.daysOnMarket && c.daysOnMarket > 0);
      const avgDom = compsWithDom.length > 0
        ? Math.round(compsWithDom.reduce((s, c) => s + (c.daysOnMarket || 0), 0) / compsWithDom.length)
        : null;

      const aiResult = await decomposeOfferGap({
        valuationCents,
        offerCents,
        reconCents,
        vehicle: {
          year: inspection.vehicle?.year || 2020,
          make: inspection.vehicle?.make || "Unknown",
          model: inspection.vehicle?.model || "Unknown",
          trim: inspection.vehicle?.trim,
          bodyStyle: inspection.vehicle?.bodyStyle || null,
          mileage: inspection.odometer,
        },
        location: inspection.location,
        avgDaysOnMarket: avgDom,
        findingsCount: await ctx.db.finding.count({ where: { inspectionId: input.inspectionId } }),
      });

      await ctx.db.inspection.update({
        where: { id: input.inspectionId },
        data: {
          offerMode: "AI_ESTIMATED",
          offerNotes: null,
          offerCostBreakdown: JSON.parse(JSON.stringify(aiResult.result)) as Prisma.InputJsonValue,
        },
      });

      return {
        success: true,
        mode: "AI_ESTIMATED" as const,
        breakdown: aiResult.result,
        tier: aiResult.fallbackTier,
      };
    }),

  // Save dealer-edited offer cost breakdown (without re-running AI)
  updateOfferBreakdown: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
      costItems: z.array(z.object({
        label: z.string(),
        amountCents: z.number(),
        description: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const breakdown = {
        costItems: input.costItems,
        totalCostsCents: input.costItems.reduce((s, c) => s + c.amountCents, 0),
        reasoning: "Dealer-edited cost breakdown",
      };
      const isSuperAdmin = (ctx.session.user as Record<string, unknown>).role === "SUPER_ADMIN";
      await ctx.db.inspection.update({
        where: { id: input.inspectionId, ...(isSuperAdmin ? {} : { orgId: ctx.orgId }) },
        data: {
          offerMode: "AI_ESTIMATED",
          offerCostBreakdown: JSON.parse(JSON.stringify(breakdown)) as Prisma.InputJsonValue,
        },
      });
      return { success: true };
    }),

  // Set acquisition type for an inspection (WHOLESALE or TRADE_IN)
  setAcquisitionType: protectedProcedure
    .input(z.object({
      inspectionId: z.string(),
      acquisitionType: z.enum(["WHOLESALE", "TRADE_IN"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.inspection.update({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        data: { acquisitionType: input.acquisitionType },
      });
      return { success: true, acquisitionType: input.acquisitionType };
    }),

  // Accept AI auditor's price adjustment
  acceptAuditAdjustment: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ma = await ctx.db.marketAnalysis.findUnique({
        where: { inspectionId: input.inspectionId },
      });
      if (!ma) throw new Error("No market analysis found");
      if (ma.aiAuditorApproved !== false) throw new Error("Auditor did not suggest an adjustment");

      // The auditor's suggested price is stored — apply it
      // For now, mark as accepted. The UI recalculates using the auditor's suggested values.
      await ctx.db.marketAnalysis.update({
        where: { inspectionId: input.inspectionId },
        data: { aiAuditAccepted: true },
      });

      return { success: true };
    }),

  // Decline AI auditor's adjustment — keep BB values
  declineAuditAdjustment: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.marketAnalysis.update({
        where: { inspectionId: input.inspectionId },
        data: { aiAuditAccepted: false },
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

  // ── CONDITION_REVIEW procedures ──────────────────────────────────────

  // Get preliminary findings from AI condition scan for inspector verification
  getConditionFindings: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const scanStep = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_CONDITION_SCAN",
          },
        },
      });
      if (!scanStep?.data) return { findings: [], conditionAssessment: null };

      const data = scanStep.data as {
        preliminaryFindings?: PreliminaryFinding[];
        conditionAssessment?: Record<string, unknown>;
      };

      // Also get any existing reviews from the CONDITION_REVIEW step
      const reviewStep = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "CONDITION_REVIEW",
          },
        },
      });
      const reviewData = reviewStep?.data as { reviews?: Record<string, FindingReview> } | null;

      return {
        findings: data.preliminaryFindings || [],
        conditionAssessment: data.conditionAssessment || null,
        reviews: reviewData?.reviews || {},
      };
    }),

  // Mark a single AI finding as confirmed or dismissed
  reviewConditionFinding: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        findingIndex: z.number(),
        verified: z.boolean(),
        notes: z.string().optional(),
        mediaId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const step = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "CONDITION_REVIEW",
          },
        },
      });
      if (!step) throw new TRPCError({ code: "NOT_FOUND", message: "CONDITION_REVIEW step not found" });

      const existing = (step.data as { reviews?: Record<string, FindingReview> } | null)?.reviews || {};
      const reviews = {
        ...existing,
        [String(input.findingIndex)]: {
          verified: input.verified,
          notes: input.notes,
          mediaId: input.mediaId,
          reviewedAt: new Date().toISOString(),
        },
      };

      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "CONDITION_REVIEW",
          },
        },
        data: {
          data: JSON.parse(JSON.stringify({ reviews })),
        },
      });

      return { success: true, reviews };
    }),

  // Complete condition review: create findings for verified issues, recalculate scores
  completeConditionReview: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get preliminary findings from AI scan step
      const scanStep = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "AI_CONDITION_SCAN",
          },
        },
      });
      if (!scanStep?.data) throw new TRPCError({ code: "BAD_REQUEST", message: "No condition scan data" });

      const scanData = scanStep.data as unknown as {
        preliminaryFindings: PreliminaryFinding[];
        conditionAssessment: Record<string, unknown>;
      };

      // Get reviews from CONDITION_REVIEW step
      const reviewStep = await ctx.db.inspectionStep.findUnique({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "CONDITION_REVIEW",
          },
        },
      });
      const reviewData = (reviewStep?.data as { reviews?: Record<string, FindingReview> } | null)?.reviews || {};

      const preliminaryFindings = scanData.preliminaryFindings || [];

      // Get media for photo linking
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: { media: true },
      });
      if (!inspection) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection not found" });

      const mediaForAnalysis = inspection.media
        .filter((m) => m.url && m.captureType)
        .map((m) => ({ id: m.id, url: m.url!, captureType: m.captureType! }));

      // Create Finding records for verified issues only
      let confirmedCount = 0;
      let dismissedCount = 0;
      for (const pf of preliminaryFindings) {
        const review = reviewData[String(pf.index)];
        if (!review) continue;

        if (review.verified) {
          confirmedCount++;
          // Check for existing finding (idempotency)
          const existing = await ctx.db.finding.findFirst({
            where: { inspectionId: input.inspectionId, title: pf.title },
          });
          if (existing) continue;

          const finding = await ctx.db.finding.create({
            data: {
              inspectionId: input.inspectionId,
              title: pf.title,
              description: pf.description,
              severity: pf.severity as never,
              category: (pf.category || "OTHER") as never,
              evidence: `AI Detection (${Math.round(pf.confidence * 100)}% confidence) — verified by inspector`,
            },
          });

          // Link source photo
          if (pf.photoId && pf.photoIndex >= 0 && pf.photoIndex < mediaForAnalysis.length) {
            await ctx.db.mediaItem.update({
              where: { id: mediaForAnalysis[pf.photoIndex].id },
              data: { findingId: finding.id },
            }).catch(() => {});
          }

          // Link evidence photo from review if provided
          if (review.mediaId) {
            await ctx.db.mediaItem.update({
              where: { id: review.mediaId },
              data: { findingId: finding.id },
            }).catch(() => {});
          }
        } else {
          dismissedCount++;
        }
      }

      // Recalculate condition scores based on verified findings
      const originalAssessment = scanData.conditionAssessment as unknown as import("@/types/risk").ConditionAssessment;
      const finalAssessment = recalculateScores(originalAssessment, preliminaryFindings, reviewData);

      // Persist final scores to Inspection record
      await persistConditionScores(ctx.db, input.inspectionId, finalAssessment);

      // Mark CONDITION_REVIEW step as completed
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: "CONDITION_REVIEW",
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          data: JSON.parse(JSON.stringify({
            reviews: reviewData,
            confirmedCount,
            dismissedCount,
            finalScores: {
              overall: finalAssessment.overallScore,
              exteriorBody: finalAssessment.exteriorBodyScore,
              interior: finalAssessment.interiorScore,
              mechanicalVisual: finalAssessment.mechanicalVisualScore,
              underbodyFrame: finalAssessment.underbodyFrameScore,
            },
          })),
        },
      });

      // Update inspection status
      await ctx.db.inspection.update({
        where: { id: input.inspectionId },
        data: { status: "CONDITION_REVIEWED" as never },
      });

      console.log(
        `[Inspection] Condition review complete: ${confirmedCount} confirmed, ${dismissedCount} dismissed. ` +
        `Score: ${originalAssessment.overallScore} → ${finalAssessment.overallScore}`,
      );

      return {
        confirmedCount,
        dismissedCount,
        originalScore: originalAssessment.overallScore,
        finalScore: finalAssessment.overallScore,
      };
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

  // Recover inspections that have a completed MARKET_ANALYSIS step but
  // whose inspection.status was never set to COMPLETED (e.g., client-side
  // advanceStep call failed). Called on vehicles list page load as a self-heal.
  recoverOrphanedInspections: protectedProcedure
    .mutation(async ({ ctx }) => {
      const orphaned = await ctx.db.inspection.findMany({
        where: {
          orgId: ctx.orgId,
          status: { not: "COMPLETED" },
          steps: {
            some: {
              step: "MARKET_ANALYSIS",
              status: "COMPLETED",
            },
          },
        },
        select: { id: true },
      });

      if (orphaned.length === 0) return { recovered: 0 };

      await ctx.db.inspection.updateMany({
        where: { id: { in: orphaned.map((o) => o.id) } },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      return { recovered: orphaned.length };
    }),
});

// Score calculation is now in @/lib/scoring.ts (shared with report generation)
