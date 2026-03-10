import { z } from "zod/v4";
import { router, protectedProcedure } from "../init";

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
        include: { _count: { select: { inspections: true } } },
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

  // Fetch NHTSA recalls for a VIN
  recalls: protectedProcedure
    .input(z.object({ vin: z.string() }))
    .query(async ({ input }) => {
      const res = await fetch(
        `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${input.vin}`
      );
      const data = await res.json();
      return (data.results || []).map((r: Record<string, string>) => ({
        campaignNumber: r.NHTSACampaignNumber,
        component: r.Component,
        summary: r.Summary,
        consequence: r.Consequence,
        remedy: r.Remedy,
      }));
    }),
});
