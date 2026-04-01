/**
 * Server-side image cropping for zone-level analysis.
 *
 * GPT-4o vision processes images holistically and can miss localized defects
 * (e.g., bald center tread with good edges). The fix: crop images into
 * zones before sending to the AI, so each zone gets dedicated attention.
 *
 * Uses sharp for server-side image processing if available, falls back to
 * canvas-based cropping. Returns base64 data URLs that can be sent directly
 * to the OpenAI vision API.
 */

// ---------------------------------------------------------------------------
//  Zone definitions
// ---------------------------------------------------------------------------

export interface CropZone {
  /** Descriptive label for the zone (included in the prompt) */
  label: string;
  /** Crop region as fractions of the image (0-1) */
  x: number;      // left edge fraction
  y: number;      // top edge fraction
  width: number;  // fraction of image width
  height: number; // fraction of image height
}

/**
 * Tire photo zones — splits the tire face into inner/center/outer strips
 * plus a sidewall zone. Assumes a standard close-up tire photo where
 * the tread face occupies roughly the center 60% of the image.
 */
export const TIRE_ZONES: CropZone[] = [
  { label: "INNER TREAD (closest to vehicle)", x: 0.05, y: 0.15, width: 0.25, height: 0.55 },
  { label: "CENTER TREAD (middle of tire face)", x: 0.30, y: 0.15, width: 0.30, height: 0.55 },
  { label: "OUTER TREAD (farthest from vehicle)", x: 0.60, y: 0.15, width: 0.25, height: 0.55 },
  { label: "SIDEWALL", x: 0.10, y: 0.65, width: 0.80, height: 0.30 },
];

/**
 * Body panel zones — splits a side/quarter photo into quadrants
 * for more granular defect detection on large panels.
 */
export const PANEL_ZONES: CropZone[] = [
  { label: "UPPER LEFT quadrant", x: 0.0, y: 0.0, width: 0.5, height: 0.5 },
  { label: "UPPER RIGHT quadrant", x: 0.5, y: 0.0, width: 0.5, height: 0.5 },
  { label: "LOWER LEFT quadrant", x: 0.0, y: 0.5, width: 0.5, height: 0.5 },
  { label: "LOWER RIGHT quadrant", x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
];

// ---------------------------------------------------------------------------
//  Image cropping
// ---------------------------------------------------------------------------

/**
 * Downloads an image from a URL and crops it into the specified zones.
 * Returns an array of { label, dataUrl } where dataUrl is a base64 JPEG
 * that can be passed directly to the OpenAI vision API.
 *
 * If cropping fails (e.g., sharp not available), returns null — the caller
 * should fall back to sending the full image.
 */
export async function cropImageIntoZones(
  imageUrl: string,
  zones: CropZone[],
): Promise<{ label: string; dataUrl: string }[] | null> {
  try {
    // Download the image
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());

    // Try to use sharp (available in Node.js server environments)
    let sharp: typeof import("sharp") | undefined;
    try {
      sharp = (await import("sharp")).default;
    } catch {
      // sharp not available — skip cropping
      console.warn("[image-crop] sharp not available, skipping crop");
      return null;
    }

    // Get image dimensions
    const metadata = await sharp(buffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;
    if (!imgWidth || !imgHeight) return null;

    // Crop each zone in parallel
    const crops = await Promise.all(
      zones.map(async (zone) => {
        const left = Math.round(zone.x * imgWidth);
        const top = Math.round(zone.y * imgHeight);
        const width = Math.round(zone.width * imgWidth);
        const height = Math.round(zone.height * imgHeight);

        // Ensure dimensions are valid
        const safeWidth = Math.min(width, imgWidth - left);
        const safeHeight = Math.min(height, imgHeight - top);
        if (safeWidth <= 0 || safeHeight <= 0) return null;

        const croppedBuffer = await sharp(buffer)
          .extract({ left, top, width: safeWidth, height: safeHeight })
          .jpeg({ quality: 90 })
          .toBuffer();

        const base64 = croppedBuffer.toString("base64");
        return {
          label: zone.label,
          dataUrl: `data:image/jpeg;base64,${base64}`,
        };
      }),
    );

    const validCrops = crops.filter((c): c is NonNullable<typeof c> => c !== null);
    if (validCrops.length === 0) return null;

    console.log(`[image-crop] Cropped ${validCrops.length} zones from ${imgWidth}x${imgHeight} image`);
    return validCrops;
  } catch (err) {
    console.warn("[image-crop] Failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
