import { z } from "zod/v4";
import { router, protectedProcedure, publicProcedure } from "../init";
import crypto from "crypto";
import { generateReportPDF } from "@/lib/pdf/generate-report";
import { supabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase";
import type { ReportData } from "@/lib/pdf/report-template";
import type { RiskCheckStatus } from "@/types/risk";

export const reportRouter = router({
  // Generate report from completed inspection
  generate: protectedProcedure
    .input(z.object({ inspectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const isSuperAdmin = (ctx.session.user as Record<string, unknown>).role === "SUPER_ADMIN";
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, ...(isSuperAdmin ? {} : { orgId: ctx.orgId }) },
        include: {
          vehicle: true,
          findings: { include: { media: true } },
          media: true,
          inspector: { select: { name: true } },
          steps: true,
          marketAnalysis: true,
        },
      });

      if (!inspection) throw new Error("Inspection not found");

      // Condition scores are now set by AI condition assessment (independent of findings).

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.orgId },
        select: { name: true },
      });

      // Generate report number
      const year = new Date().getFullYear();
      const count = await ctx.db.report.count({
        where: { number: { startsWith: `RPT-${year}-` } },
      });
      const number = `RPT-${year}-${String(count + 1).padStart(5, "0")}`;

      // Generate share token
      const shareToken = crypto.randomBytes(16).toString("hex");

      // Extract risk data from RISK_INSPECTION step
      const riskStep = inspection.steps.find(
        (s) => s.step === "RISK_INSPECTION" || s.step === "RISK_REVIEW"
      );
      const riskStepData = riskStep?.data as {
        aggregatedRisks?: Array<{
          id: string; title: string; description?: string; severity: string; whyItMatters?: string;
        }>;
        checkStatuses?: Record<string, { status: string }>;
      } | null;

      let riskChecklist: ReportData["riskChecklist"] = undefined;
      let riskItems: ReportData["riskItems"] = undefined;
      if (riskStepData?.aggregatedRisks && riskStepData.checkStatuses) {
        const checks = riskStepData.checkStatuses;
        const checked = riskStepData.aggregatedRisks
          .filter((r) => checks[r.id] && (checks[r.id].status === "CONFIRMED" || checks[r.id].status === "NOT_FOUND"));
        riskItems = checked.map((r) => ({
          title: r.title,
          description: r.description,
          severity: r.severity,
          status: checks[r.id].status,
          whyItMatters: r.whyItMatters,
        }));
        riskChecklist = {
          total: checked.length,
          confirmed: checked.filter((r) => checks[r.id].status === "CONFIRMED").length,
          cleared: checked.filter((r) => checks[r.id].status === "NOT_FOUND").length,
          unableToInspect: 0,
        };
      }

      // Extract AI recon breakdown
      const reconLog = (inspection as { aiValuationLogs?: Array<{ output: unknown }> }).aiValuationLogs?.[0];
      const reconOutput = reconLog?.output as {
        totalReconCost?: number;
        itemizedCosts?: Array<{ finding: string; estimatedCostCents: number; laborHours?: number; partsEstimate?: number; reasoning?: string }>;
        laborRateContext?: string;
      } | null;
      const reconBreakdown: ReportData["reconBreakdown"] = reconOutput?.itemizedCosts
        ? { totalReconCost: reconOutput.totalReconCost || 0, itemizedCosts: reconOutput.itemizedCosts, laborRateContext: reconOutput.laborRateContext }
        : null;

      // Extract condition details for 9-area breakdown
      const conditionRaw = inspection.conditionRawData as Record<string, { summary?: string; concerns?: string[] }> | null;

      // Categorize media for the report
      const STANDARD_CAPTURES = new Set([
        "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER",
        "DRIVER_SIDE", "PASSENGER_SIDE", "REAR_34_DRIVER",
        "REAR_34_PASSENGER", "REAR_CENTER", "ROOF",
        "UNDERCARRIAGE", "ENGINE_BAY", "UNDER_HOOD_LABEL",
      ]);

      const standardPhotos = inspection.media
        .filter((m) => m.url && m.captureType && STANDARD_CAPTURES.has(m.captureType))
        .map((m) => ({ url: m.url!, captureType: m.captureType! }));

      const allMedia = inspection.media
        .filter((m) => m.url && m.type === "PHOTO")
        .map((m) => ({ url: m.url!, captureType: m.captureType || "OTHER" }));

      // Build report data for PDF
      const reportData: ReportData = {
        number,
        generatedAt: new Date(),
        orgName: org?.name,
        inspectorName: inspection.inspector?.name ?? undefined,
        vehicle: inspection.vehicle ? {
          year: inspection.vehicle.year,
          make: inspection.vehicle.make,
          model: inspection.vehicle.model,
          vin: inspection.vehicle.vin,
          trim: inspection.vehicle.trim,
          exteriorColor: inspection.vehicle.exteriorColor,
        } : {
          year: 0,
          make: "Unknown",
          model: "Unknown",
          vin: "N/A",
          trim: null,
          exteriorColor: null,
        },
        scores: {
          overall: inspection.overallScore,
          paintBody: inspection.paintBodyScore,
          panelAlignment: inspection.panelAlignmentScore,
          glassLighting: inspection.glassLightingScore,
          interiorSurfaces: inspection.interiorSurfacesScore,
          interiorControls: inspection.interiorControlsScore,
          engineBay: inspection.engineBayScore,
          tiresWheels: inspection.tiresWheelsScore,
          underbodyFrame: inspection.underbodyFrameScore,
          exhaust: inspection.exhaustScore,
          // Legacy
          exteriorBody: inspection.exteriorBodyScore,
          interior: inspection.interiorScore,
          mechanicalVisual: inspection.mechanicalVisualScore,
        },
        conditionDetails: conditionRaw ? {
          paintBody: conditionRaw.paintBody,
          panelAlignment: conditionRaw.panelAlignment,
          glassLighting: conditionRaw.glassLighting,
          interiorSurfaces: conditionRaw.interiorSurfaces,
          interiorControls: conditionRaw.interiorControls,
          engineBay: conditionRaw.engineBay,
          tiresWheels: conditionRaw.tiresWheels,
          underbodyFrame: conditionRaw.underbodyFrame,
          exhaust: conditionRaw.exhaust,
          // Legacy
          exteriorBody: conditionRaw.exteriorBody,
          interior: conditionRaw.interior,
          mechanicalVisual: conditionRaw.mechanicalVisual,
        } : null,
        findings: inspection.findings.map((f) => ({
          title: f.title,
          description: f.description || "",
          severity: f.severity,
          category: f.category,
          repairCostLow: f.repairCostLow,
          repairCostHigh: f.repairCostHigh,
          media: f.media
            ?.filter((m) => m.url)
            .map((m) => ({ url: m.url!, captureType: m.captureType || "FINDING_EVIDENCE" })),
        })),
        riskItems,
        reconBreakdown,
        riskChecklist,
        mediaCount: inspection.media.length,
        standardPhotos,
        allMedia,
        marketAnalysis: inspection.marketAnalysis
          ? {
              baselinePrice: inspection.marketAnalysis.baselinePrice,
              adjustedPrice: inspection.marketAnalysis.adjustedPrice,
              recommendation: inspection.marketAnalysis.recommendation,
              strongBuyMax: inspection.marketAnalysis.strongBuyMax,
              fairBuyMax: inspection.marketAnalysis.fairBuyMax,
              overpayingMax: inspection.marketAnalysis.overpayingMax,
              estRetailPrice: inspection.marketAnalysis.estRetailPrice,
              estReconCost: inspection.marketAnalysis.estReconCost,
              estGrossProfit: inspection.marketAnalysis.estGrossProfit,
              conditionScore: inspection.marketAnalysis.conditionScore,
              conditionMultiplier: inspection.marketAnalysis.conditionMultiplier,
              conditionGrade: inspection.marketAnalysis.conditionGrade,
              historyMultiplier: inspection.marketAnalysis.historyMultiplier,
              historyBreakdown: inspection.marketAnalysis.historyBreakdown as ReportData["marketAnalysis"] extends { historyBreakdown: infer T } ? T : never,
              fairValueAtBaseline: inspection.marketAnalysis.fairValueAtBaseline,
              adjustedValueBeforeRecon: inspection.marketAnalysis.adjustedValueBeforeRecon,
              priceBands: inspection.marketAnalysis.priceBands as ReportData["marketAnalysis"] extends { priceBands: infer T } ? T : never,
              comparables: inspection.marketAnalysis.comparables as Array<{ title: string; price: number; mileage: number; location: string; source: string }>,
              tradeInValue: inspection.marketAnalysis.tradeInValue,
              wholesaleValue: inspection.marketAnalysis.wholesaleValue,
              sourceCount: (inspection.marketAnalysis as Record<string, unknown>).sourceCount as number | null | undefined,
            }
          : undefined,
      };

      // Generate PDF
      let pdfS3Key: string | undefined;
      let pdfUrl: string | undefined;

      try {
        const pdfBuffer = await generateReportPDF(reportData);

        // Upload to Supabase Storage
        pdfS3Key = `${ctx.orgId}/reports/${number}.pdf`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(MEDIA_BUCKET)
          .upload(pdfS3Key, pdfBuffer, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError) {
          console.error("PDF upload error:", uploadError);
        } else {
          // Get public URL
          const { data: urlData } = supabaseAdmin.storage
            .from(MEDIA_BUCKET)
            .getPublicUrl(pdfS3Key);
          pdfUrl = urlData?.publicUrl;
        }
      } catch (err) {
        // PDF generation failure shouldn't block report creation
        console.error("PDF generation error:", err);
      }

      // Check if report already exists (regeneration)
      const existingReport = await ctx.db.report.findFirst({
        where: { inspectionId: input.inspectionId },
      });

      let report;
      if (existingReport) {
        // Regenerate: update PDF only, keep report number + share token
        report = await ctx.db.report.update({
          where: { id: existingReport.id },
          data: { pdfS3Key, pdfUrl, generatedAt: new Date() },
        });
      } else {
        // First generation
        report = await ctx.db.report.create({
          data: {
            number,
            shareToken,
            inspectionId: input.inspectionId,
            orgId: ctx.orgId,
            pdfS3Key,
            pdfUrl,
          },
        });
      }

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
              steps: true,
              marketAnalysis: true,
              vehicleHistory: true,
              inspector: { select: { name: true, email: true } },
              aiValuationLogs: {
                where: { module: "recon" },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      });
    }),

  // Download PDF (signed URL)
  downloadPDF: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const report = await ctx.db.report.findUnique({
        where: { id: input.id, orgId: ctx.orgId },
        select: { pdfS3Key: true, pdfUrl: true },
      });

      if (!report) throw new Error("Report not found");
      if (!report.pdfS3Key) throw new Error("No PDF available for this report");

      // Generate signed download URL (valid for 1 hour)
      const { data, error } = await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(report.pdfS3Key, 3600);

      if (error || !data?.signedUrl) {
        throw new Error("Failed to generate download URL");
      }

      return { url: data.signedUrl };
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
              aiValuationLogs: {
                where: { module: "recon" },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
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
