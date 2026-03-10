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
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
        include: {
          vehicle: true,
          findings: { include: { media: true } },
          media: true,
          inspector: { select: { name: true } },
          steps: true,
        },
      });

      if (!inspection) throw new Error("Inspection not found");

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

      // Extract risk checklist data from PHYSICAL_INSPECTION step
      const physicalStep = inspection.steps.find(
        (s) => s.step === "PHYSICAL_INSPECTION"
      );
      let riskChecklist: ReportData["riskChecklist"] = undefined;
      if (physicalStep?.data && typeof physicalStep.data === "object") {
        const stepData = physicalStep.data as Record<string, unknown>;
        const checkStatuses = stepData.checkStatuses as
          | Record<string, RiskCheckStatus>
          | undefined;
        if (checkStatuses) {
          const values = Object.values(checkStatuses);
          riskChecklist = {
            total: values.length,
            confirmed: values.filter((v) => v.status === "CONFIRMED").length,
            cleared: values.filter((v) => v.status === "NOT_FOUND").length,
            unableToInspect: values.filter(
              (v) => v.status === "UNABLE_TO_INSPECT"
            ).length,
          };
        }
      }

      // Build report data for PDF
      const reportData: ReportData = {
        number,
        generatedAt: new Date(),
        orgName: org?.name,
        inspectorName: inspection.inspector?.name ?? undefined,
        vehicle: {
          year: inspection.vehicle.year,
          make: inspection.vehicle.make,
          model: inspection.vehicle.model,
          vin: inspection.vehicle.vin,
          trim: inspection.vehicle.trim,
          exteriorColor: inspection.vehicle.exteriorColor,
        },
        scores: {
          overall: inspection.overallScore,
          structural: inspection.structuralScore,
          cosmetic: inspection.cosmeticScore,
          electronics: inspection.electronicsScore,
        },
        findings: inspection.findings.map((f) => ({
          title: f.title,
          description: f.description || "",
          severity: f.severity,
          category: f.category,
          repairCostLow: f.repairCostLow,
          repairCostHigh: f.repairCostHigh,
        })),
        riskChecklist,
        mediaCount: inspection.media.length,
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

      const report = await ctx.db.report.create({
        data: {
          number,
          shareToken,
          inspectionId: input.inspectionId,
          orgId: ctx.orgId,
          pdfS3Key,
          pdfUrl,
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
