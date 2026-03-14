"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  currentCaptureType: string | null;
}

interface UploadResult {
  mediaItemId: string;
  publicUrl: string;
}

export function useMediaUpload(inspectionId: string) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    currentCaptureType: null,
  });

  const utils = trpc.useUtils();

  const getUploadUrl = trpc.media.getUploadUrl.useMutation();
  const confirmUpload = trpc.media.confirmUpload.useMutation();

  const upload = useCallback(
    async (
      file: File,
      captureType: string,
      findingId?: string
    ): Promise<UploadResult | null> => {
      setState({
        isUploading: true,
        progress: 10,
        error: null,
        currentCaptureType: captureType,
      });

      try {
        // Step 1: Get signed upload URL from server
        setState((s) => ({ ...s, progress: 20 }));
        const { uploadUrl, token, mediaItemId, publicUrl } =
          await getUploadUrl.mutateAsync({
            inspectionId,
            captureType,
            mimeType: file.type || "image/jpeg",
            fileName: file.name,
            fileSize: file.size,
            findingId,
          });

        // Step 2: Upload file directly to Supabase Storage
        setState((s) => ({ ...s, progress: 40 }));
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "image/jpeg",
            "x-upsert": "true",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
        }

        setState((s) => ({ ...s, progress: 80 }));

        // Step 3: Get image dimensions if it's a photo
        let width: number | undefined;
        let height: number | undefined;
        if (file.type.startsWith("image/")) {
          try {
            const dimensions = await getImageDimensions(file);
            width = dimensions.width;
            height = dimensions.height;
          } catch {
            // Dimensions are optional, don't fail the upload
          }
        }

        // Step 4: Confirm upload with server
        await confirmUpload.mutateAsync({
          mediaItemId,
          width,
          height,
        });

        setState({
          isUploading: false,
          progress: 100,
          error: null,
          currentCaptureType: null,
        });

        // Invalidate queries to refresh media lists
        utils.inspection.get.invalidate({ id: inspectionId });
        utils.media.list.invalidate({ inspectionId });

        return { mediaItemId, publicUrl };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setState({
          isUploading: false,
          progress: 0,
          error: message,
          currentCaptureType: null,
        });
        return null;
      }
    },
    [inspectionId, getUploadUrl, confirmUpload, utils]
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    upload,
    isUploading: state.isUploading,
    progress: state.progress,
    error: state.error,
    currentCaptureType: state.currentCaptureType,
    clearError,
  };
}

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
