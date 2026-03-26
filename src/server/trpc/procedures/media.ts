import { z } from "zod/v4";
import { router, protectedProcedure } from "../init";
import { supabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase";

export const mediaRouter = router({
  // Get a signed upload URL for direct client-to-Supabase upload
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        captureType: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        findingId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate inspection belongs to org
      const inspection = await ctx.db.inspection.findUnique({
        where: { id: input.inspectionId, orgId: ctx.orgId },
      });
      if (!inspection) throw new Error("Inspection not found");

      // Build storage path: orgId/inspectionId/captureType/timestamp-filename
      const timestamp = Date.now();
      const sanitizedName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${ctx.orgId}/${input.inspectionId}/${input.captureType}/${timestamp}-${sanitizedName}`;

      // Create signed upload URL
      const { data: uploadData, error: uploadError } =
        await supabaseAdmin.storage
          .from(MEDIA_BUCKET)
          .createSignedUploadUrl(storagePath);

      if (uploadError || !uploadData) {
        throw new Error(
          `Failed to create upload URL: ${uploadError?.message || "unknown error"}`
        );
      }

      // Determine media type from MIME
      const mediaType = input.mimeType.startsWith("video/")
        ? "VIDEO"
        : input.mimeType.startsWith("audio/")
          ? "AUDIO"
          : "PHOTO";

      // Build public URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`;

      // Map dynamic captureTypes (e.g. FINDING_EVIDENCE_abc123_0) to valid enum values.
      // The full captureType string is preserved in the storage path for traceability.
      const VALID_CAPTURE_TYPES = new Set([
        "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER", "DRIVER_SIDE",
        "REAR_34_DRIVER", "REAR_34_PASSENGER", "REAR_CENTER", "PASSENGER_SIDE",
        "ROOF", "DASHBOARD_DRIVER", "FRONT_SEATS", "REAR_SEATS", "CARGO_AREA",
        "ENGINE_BAY", "UNDERCARRIAGE", "TIRE_FRONT_DRIVER", "TIRE_REAR_DRIVER",
        "TIRE_FRONT_PASSENGER", "TIRE_REAR_PASSENGER", "UNDER_HOOD_LABEL",
        "VIN_PLATE", "DOOR_JAMB_DRIVER", "ODOMETER", "WALKAROUND_VIDEO",
        "ENGINE_AUDIO", "INTERIOR_WALKTHROUGH", "FINDING_EVIDENCE", "OTHER",
      ]);

      let dbCaptureType = input.captureType;
      if (!VALID_CAPTURE_TYPES.has(dbCaptureType)) {
        // Dynamic type like FINDING_EVIDENCE_riskId_0 or RISK_Q_riskId_qId
        if (dbCaptureType.startsWith("FINDING_EVIDENCE")) {
          dbCaptureType = "FINDING_EVIDENCE";
        } else {
          dbCaptureType = "OTHER";
        }
      }

      // Create pending MediaItem record
      const mediaItem = await ctx.db.mediaItem.create({
        data: {
          type: mediaType,
          captureType: dbCaptureType as never,
          s3Key: storagePath,  // Full original captureType preserved in path
          s3Bucket: MEDIA_BUCKET,
          url: publicUrl,
          mimeType: input.mimeType,
          sizeBytes: input.fileSize,
          inspectionId: input.inspectionId,
          findingId: input.findingId || null,
        },
      });

      return {
        uploadUrl: uploadData.signedUrl,
        token: uploadData.token,
        mediaItemId: mediaItem.id,
        publicUrl,
        storagePath,
      };
    }),

  // Confirm upload completed successfully
  confirmUpload: protectedProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mediaItem = await ctx.db.mediaItem.findUnique({
        where: { id: input.mediaItemId },
        include: { inspection: true },
      });

      if (!mediaItem) throw new Error("Media item not found");
      if (mediaItem.inspection.orgId !== ctx.orgId)
        throw new Error("Not authorized");

      // Update with dimensions if provided
      return ctx.db.mediaItem.update({
        where: { id: input.mediaItemId },
        data: {
          width: input.width,
          height: input.height,
        },
      });
    }),

  // Link a media item to a finding
  linkToFinding: protectedProcedure
    .input(
      z.object({
        mediaItemId: z.string(),
        findingId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mediaItem = await ctx.db.mediaItem.findUnique({
        where: { id: input.mediaItemId },
        include: { inspection: true },
      });

      if (!mediaItem) throw new Error("Media item not found");
      if (mediaItem.inspection.orgId !== ctx.orgId)
        throw new Error("Not authorized");

      return ctx.db.mediaItem.update({
        where: { id: input.mediaItemId },
        data: { findingId: input.findingId },
      });
    }),

  // List media items for an inspection
  list: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        captureType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.mediaItem.findMany({
        where: {
          inspectionId: input.inspectionId,
          inspection: { orgId: ctx.orgId },
          ...(input.captureType ? { captureType: input.captureType as never } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Delete a media item (removes from storage too)
  delete: protectedProcedure
    .input(z.object({ mediaItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mediaItem = await ctx.db.mediaItem.findUnique({
        where: { id: input.mediaItemId },
        include: { inspection: true },
      });

      if (!mediaItem) throw new Error("Media item not found");
      if (mediaItem.inspection.orgId !== ctx.orgId)
        throw new Error("Not authorized");

      // Delete from Supabase Storage
      if (mediaItem.s3Key) {
        await supabaseAdmin.storage
          .from(MEDIA_BUCKET)
          .remove([mediaItem.s3Key]);
      }

      // Delete from database
      return ctx.db.mediaItem.delete({
        where: { id: input.mediaItemId },
      });
    }),
});
