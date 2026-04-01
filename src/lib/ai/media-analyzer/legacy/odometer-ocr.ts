/**
 * Odometer reading extraction from photo using GPT-4o Vision.
 * Moved from original media-analyzer.ts without changes.
 */

import { getOpenAI } from "@/lib/openai";

/**
 * Extract the odometer reading from an instrument cluster photo using GPT-4o Vision.
 * Returns the mileage as a number and confidence level.
 *
 * Cost: ~$0.03-0.05 per call (GPT-4o Vision, single image)
 */
export async function extractOdometerFromPhoto(
  photoUrl: string,
): Promise<{ mileage: number | null; confidence: number }> {
  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a vehicle odometer reading specialist. Extract the current mileage/odometer reading from the provided photo of a vehicle's instrument cluster or digital display.

Reading tips:
- Look for the largest number display, typically 5-6 digits
- Distinguish between ODOMETER (total miles) and TRIP meter (short distance)
- Digital displays: read the number directly
- Analog/mechanical: read the white number wheels, ignore partial digit
- If display shows both miles and kilometers, return MILES
- Ignore tenths digit if present (e.g., 123456.7 → return 123456)

Return JSON: { "mileage": <integer miles or null if unreadable>, "confidence": <0.0 to 1.0> }
- confidence 0.9+: clearly readable display
- confidence 0.6-0.9: readable but some digits uncertain
- confidence 0.3-0.6: partial read, some digits guessed
- Only return null if the odometer is not visible at all`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Read the odometer/mileage from this instrument cluster photo." },
            { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return { mileage: null, confidence: 0 };

    const parsed = JSON.parse(raw);
    const mileage =
      typeof parsed.mileage === "number" && parsed.mileage > 0
        ? Math.round(parsed.mileage)
        : null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;

    if (mileage) {
      console.log(
        `[OdometerOCR] Read ${mileage.toLocaleString()} miles (${(confidence * 100).toFixed(0)}% confidence)`,
      );
    }

    return { mileage, confidence };
  } catch (err) {
    console.error("[OdometerOCR] Failed:", err);
    return { mileage: null, confidence: 0 };
  }
}
