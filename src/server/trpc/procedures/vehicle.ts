import { z } from "zod/v4";
import { router, protectedProcedure } from "../init";
import { fetchComplaints, fetchRecalls, fetchInvestigations } from "@/lib/nhtsa";
import { buildRiskProfile } from "@/lib/risk-engine";
import { generateKnownIssues } from "@/lib/ai/risk-summarizer";
import type { AggregatedRiskProfile } from "@/types/risk";

// NHTSA API base URL
const NHTSA_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

export const vehicleRouter = router({
  // Decode a VIN using NHTSA API
  decode: protectedProcedure
    .input(z.object({ vin: z.string().length(17) }))
    .mutation(async ({ ctx, input }) => {
      const vin = input.vin.toUpperCase();

      // Check local cache first
      const cached = await ctx.db.vehicle.findUnique({
        where: { vin },
      });
      if (cached) return cached;

      // Call NHTSA vPIC API
      const res = await fetch(
        `${NHTSA_BASE}/DecodeVinValues/${vin}?format=json`
      );
      const data = await res.json();
      const r = data.Results?.[0];

      if (!r || !r.ModelYear) {
        throw new Error("Unable to decode VIN. Please check and try again.");
      }

      // Create vehicle record
      const vehicle = await ctx.db.vehicle.create({
        data: {
          vin,
          year: parseInt(r.ModelYear) || 0,
          make: r.Make || "Unknown",
          model: r.Model || "Unknown",
          trim: r.Trim || null,
          bodyStyle: r.BodyClass || null,
          drivetrain: r.DriveType || null,
          engine: [r.DisplacementL ? `${r.DisplacementL}L` : null, r.EngineConfiguration, r.FuelTypePrimary]
            .filter(Boolean)
            .join(" ") || null,
          transmission: r.TransmissionStyle || null,
          nhtsaData: r,
          orgId: ctx.orgId,
        },
      });

      return vehicle;
    }),

  // Look up existing vehicle by VIN
  lookup: protectedProcedure
    .input(z.object({ vin: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.vehicle.findUnique({
        where: { vin: input.vin.toUpperCase() },
        include: { inspections: { orderBy: { createdAt: "desc" }, take: 5 } },
      });
    }),

  // Get vehicle by ID
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.vehicle.findUnique({
        where: { id: input.id },
        include: { inspections: { orderBy: { createdAt: "desc" } } },
      });
    }),

  // Get vehicle with full inspection detail (for vehicle detail page)
  getDetail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.vehicle.findUnique({
        where: { id: input.id, orgId: ctx.orgId },
        include: {
          inspections: {
            where: { status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            include: {
              findings: { include: { media: true } },
              media: true,
              marketAnalysis: true,
              vehicleHistory: true,
              steps: true,
              report: { select: { id: true, number: true } },
              aiValuationLogs: {
                where: { module: "recon" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { output: true },
              },
            },
          },
        },
      });
    }),

  // List vehicles for the org
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const vehicles = await ctx.db.vehicle.findMany({
        where: {
          orgId: ctx.orgId,
          // Only show vehicles with at least one completed inspection
          inspections: { some: { status: "COMPLETED" } },
          ...(input.search
            ? {
                OR: [
                  { vin: { contains: input.search, mode: "insensitive" } },
                  { make: { contains: input.search, mode: "insensitive" } },
                  { model: { contains: input.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { inspections: true } },
          inspections: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, overallScore: true, number: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (vehicles.length > input.limit) {
        const next = vehicles.pop();
        nextCursor = next?.id;
      }

      return { vehicles, nextCursor };
    }),

  // Get risk profile for a vehicle (make/model/year)
  riskProfile: protectedProcedure
    .input(z.object({ make: z.string(), model: z.string(), year: z.number() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.riskProfile.findFirst({
        where: {
          make: { equals: input.make, mode: "insensitive" },
          model: { contains: input.model, mode: "insensitive" },
          yearFrom: { lte: input.year },
          yearTo: { gte: input.year },
        },
      });

      if (!profile) return null;

      return {
        id: profile.id,
        make: profile.make,
        model: profile.model,
        yearFrom: profile.yearFrom,
        yearTo: profile.yearTo,
        engine: profile.engine,
        risks: profile.risks as unknown as Array<{
          severity: string;
          title: string;
          description: string;
          cost: { low: number; high: number };
          source: string;
          position: { x: number; y: number; z: number };
          symptoms: string[];
          category: string;
        }>,
        source: profile.source,
      };
    }),

  // Fetch NHTSA recalls for a make/model/year
  recalls: protectedProcedure
    .input(z.object({ make: z.string(), model: z.string(), year: z.number() }))
    .query(async ({ input }) => {
      return fetchRecalls(input.make, input.model, input.year);
    }),

  // Enrich risk profile: generate AI-powered known issues + NHTSA data
  enrichRiskProfile: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get inspection with vehicle
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: { vehicle: true },
      });
      if (!inspection) throw new Error("Inspection not found");

      const { vehicle } = inspection;
      if (!vehicle) throw new Error("No vehicle linked — confirm VIN first");
      const { vin, make, model, year } = vehicle;

      // Fetch all NHTSA data in parallel (don't let one failure block others)
      const [complaintsResult, recallsResult, investigationsResult] =
        await Promise.allSettled([
          fetchComplaints(make, model, year),
          fetchRecalls(make, model, year),
          fetchInvestigations(make, model, year),
        ]);

      const complaints =
        complaintsResult.status === "fulfilled" ? complaintsResult.value : [];
      const recalls =
        recallsResult.status === "fulfilled" ? recallsResult.value : [];
      const investigations =
        investigationsResult.status === "fulfilled"
          ? investigationsResult.value
          : [];

      // Look up curated risk profile (used as seeds for AI generation)
      const curatedProfile = await ctx.db.riskProfile.findFirst({
        where: {
          make: { equals: make, mode: "insensitive" },
          model: { contains: model, mode: "insensitive" },
          yearFrom: { lte: year },
          yearTo: { gte: year },
        },
      });

      const curatedRisks = curatedProfile
        ? (curatedProfile.risks as unknown as Array<{
            severity: string;
            title: string;
            description: string;
            symptoms: string[];
            category: string;
          }>)
        : [];

      // AI generates the full known-issues checklist for this vehicle
      // NHTSA data + curated risks are fed as context, not as the foundation
      let knownIssues: Awaited<ReturnType<typeof generateKnownIssues>> = [];
      try {
        knownIssues = await generateKnownIssues({
          year,
          make,
          model,
          trim: vehicle.trim,
          engine: vehicle.engine,
          transmission: vehicle.transmission,
          drivetrain: vehicle.drivetrain,
          complaints,
          recalls,
          investigations,
          curatedRisks,
        });
      } catch (err) {
        console.error("[enrichRiskProfile] AI known issues generation failed:", err);
      }

      // Build unified risk profile: AI issues + recalls + investigations
      const profile = buildRiskProfile({
        vehicleId: vehicle.id,
        vin,
        make,
        model,
        year,
        knownIssues,
        recalls,
        investigations,
        complaintCount: complaints.length,
        curatedProfileId: curatedProfile?.id,
      });

      // Determine which step name to store the risk profile in.
      // New workflow uses RISK_INSPECTION; legacy uses RISK_REVIEW.
      const allSteps = await ctx.db.inspectionStep.findMany({
        where: { inspectionId: input.inspectionId },
        select: { step: true },
      });
      const stepNames = allSteps.map((s) => s.step);
      const riskStepName = stepNames.includes("RISK_INSPECTION")
        ? "RISK_INSPECTION"
        : "RISK_REVIEW";

      // Store in the risk step's data field
      await ctx.db.inspectionStep.update({
        where: {
          inspectionId_step: {
            inspectionId: input.inspectionId,
            step: riskStepName,
          },
        },
        data: {
          status: riskStepName === "RISK_REVIEW" ? "COMPLETED" : undefined,
          completedAt: riskStepName === "RISK_REVIEW" ? new Date() : undefined,
          enteredAt: new Date(),
          data: JSON.parse(JSON.stringify(profile)),
        },
      });

      // Advance inspection status (only for legacy workflow where risk review auto-completes)
      if (riskStepName === "RISK_REVIEW") {
        await ctx.db.inspection.update({
          where: { id: input.inspectionId },
          data: { status: "RISK_REVIEWED" },
        });
      }

      return profile as AggregatedRiskProfile;
    }),
});
