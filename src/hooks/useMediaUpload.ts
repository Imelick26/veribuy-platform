"use client";

import { useState, useCallback, useRef } from "react";
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

interface FailedUpload {
  captureType: string;
  mediaItemId: string;
  error: string;
  file: File;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

async function retryFetch(
  url: string,
  options: RequestInit,
  maxRetries: number,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Only retry on 5xx server errors, not 4xx client errors
      if (res.ok) return res;
      if (res.status >= 500 && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] ?? 4000));
        continue;
      }
      throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Retry on network errors (TypeError: Failed to fetch)
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] ?? 4000));
        continue;
      }
    }
  }
  throw lastError ?? new Error("Upload failed after retries");
}

export function useMediaUpload(inspectionId: string) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    currentCaptureType: null,
  });

  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  // Keep a ref to files for retry attempts
  const pendingFilesRef = useRef<Map<string, { file: File; mediaItemId: string; uploadUrl: string }>>(new Map());

  const utils = trpc.useUtils();

  const getUploadUrl = trpc.media.getUploadUrl.useMutation();
  const confirmUpload = trpc.media.confirmUpload.useMutation();
  const markFailed = trpc.media.markFailed.useMutation();

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
        // Step 1: Get signed upload URL from server (creates PENDING MediaItem)
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

        // Store file reference for potential retries
        pendingFilesRef.current.set(captureType, { file, mediaItemId, uploadUrl });

        // Step 2: Upload file to Supabase Storage with retry
        setState((s) => ({ ...s, progress: 40 }));
        await retryFetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "image/jpeg",
            "x-upsert": "true",
          },
          body: file,
        }, MAX_RETRIES);

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

        // Step 4: Confirm upload with server (verifies file exists, sets CONFIRMED)
        await confirmUpload.mutateAsync({
          mediaItemId,
          width,
          height,
        });

        // Clean up pending reference
        pendingFilesRef.current.delete(captureType);

        // Remove from failed uploads if it was a retry
        setFailedUploads((prev) => prev.filter((f) => f.captureType !== captureType));

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
        const pending = pendingFilesRef.current.get(captureType);

        // Mark as FAILED in the database if we have a mediaItemId
        if (pending?.mediaItemId) {
          markFailed.mutate({ mediaItemId: pending.mediaItemId });
        }

        // Track the failed upload for retry
        if (pending) {
          setFailedUploads((prev) => {
            // Replace existing entry for this captureType if any
            const filtered = prev.filter((f) => f.captureType !== captureType);
            return [...filtered, {
              captureType,
              mediaItemId: pending.mediaItemId,
              error: message,
              file: pending.file,
            }];
          });
        }

        pendingFilesRef.current.delete(captureType);

        setState({
          isUploading: false,
          progress: 0,
          error: message,
          currentCaptureType: null,
        });

        // Invalidate to reflect the FAILED status in UI
        utils.inspection.get.invalidate({ id: inspectionId });

        return null;
      }
    },
    [inspectionId, getUploadUrl, confirmUpload, markFailed, utils]
  );

  // Retry a failed upload — deletes the old FAILED record and starts fresh
  const retryUpload = useCallback(
    async (captureType: string): Promise<UploadResult | null> => {
      const failed = failedUploads.find((f) => f.captureType === captureType);
      if (!failed) return null;
      return upload(failed.file, captureType);
    },
    [failedUploads, upload]
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    upload,
    retryUpload,
    isUploading: state.isUploading,
    progress: state.progress,
    error: state.error,
    currentCaptureType: state.currentCaptureType,
    failedUploads,
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
