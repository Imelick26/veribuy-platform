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
  vehicleYear?: number,
): Promise<{ mileage: number | null; confidence: number }> {
  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a vehicle odometer reading specialist. Extract the current mileage/odometer reading from the provided photo of a vehicle's instrument cluster or digital display.

CRITICAL — READ EVERY DIGIT:
- Count every single digit carefully. Odometers can display 5, 6, or 7 digits.
- The most common mistake is DROPPING a digit (reading 154,845 as 15,484 or 15,845). Count digits twice.
- FIRST: count the total number of digit positions visible on the display (including leading zeros if present).
- THEN: read each digit left to right, one at a time.
- Report the "digitCount" (how many digit positions you see) in your response.
- Digital displays may use commas or periods as thousands separators — these are NOT decimal points.
- Analog/mechanical odometers: count ALL white number wheels, even partially turned ones. A partially turned wheel between 4 and 5 should be read as the lower number (4).

Reading tips:
- Distinguish between ODOMETER (total miles, usually the larger display) and TRIP meter (shorter number, often with a reset button nearby, usually fewer digits)
- If display shows both miles and kilometers, return MILES
- Ignore tenths digit if present (e.g., 123456.7 → return 123456) — the tenths digit is usually separated by a different color or smaller font
- On digital displays, the odometer label often says "ODO" or "ODOMETER" vs "TRIP A" / "TRIP B"

Return JSON: { "mileage": <integer miles or null if unreadable>, "digitCount": <number of digit positions visible>, "confidence": <0.0 to 1.0> }
- confidence 0.9+: clearly readable display, all digits certain
- confidence 0.6-0.9: readable but some digits uncertain
- confidence 0.3-0.6: partial read, some digits guessed
- Only return null if the odometer is not visible at all`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Read the odometer/mileage from this instrument cluster photo. Count every digit position carefully — do not skip or drop any digits." },
            { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return { mileage: null, confidence: 0 };

    const parsed = JSON.parse(raw);
    let mileage =
      typeof parsed.mileage === "number" && parsed.mileage > 0
        ? Math.round(parsed.mileage)
        : null;
    let confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;

    // Sanity check: digit count vs actual value
    // If the model reports seeing 6 digits but the value only has 5, it likely dropped a digit
    if (mileage && typeof parsed.digitCount === "number") {
      const valueDigits = String(mileage).length;
      if (parsed.digitCount > valueDigits) {
        console.warn(
          `[OdometerOCR] Digit mismatch: reported ${parsed.digitCount} digit positions but value ${mileage} has ${valueDigits} digits — requesting re-read`,
        );
        const reread = await rereadOdometer(openai, photoUrl, mileage, parsed.digitCount);
        if (reread) {
          mileage = reread.mileage;
          confidence = reread.confidence;
        }
      }
    }

    // Sanity check: if vehicle year is known, flag suspiciously low mileage
    if (mileage && vehicleYear) {
      const vehicleAge = new Date().getFullYear() - vehicleYear;
      const avgMilesPerYear = mileage / Math.max(vehicleAge, 1);
      // Average is ~12K miles/year. If reading suggests <2K/year on a vehicle 5+ years old,
      // it's likely a misread (dropped digit). Request a verification read.
      if (vehicleAge >= 5 && avgMilesPerYear < 2000) {
        console.warn(
          `[OdometerOCR] Suspiciously low: ${mileage.toLocaleString()} miles on a ${vehicleAge}-year-old vehicle (${Math.round(avgMilesPerYear).toLocaleString()} mi/yr) — requesting verification`,
        );
        const verification = await verifyLowMileage(openai, photoUrl, mileage, vehicleAge);
        if (verification) {
          mileage = verification.mileage;
          confidence = verification.confidence;
        }
      }
    }

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

/**
 * Re-read when digit count doesn't match value — the model likely dropped a digit.
 */
async function rereadOdometer(
  openai: ReturnType<typeof getOpenAI>,
  photoUrl: string,
  firstRead: number,
  reportedDigits: number,
): Promise<{ mileage: number; confidence: number } | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are re-reading a vehicle odometer because the first attempt may have dropped a digit. The first read was ${firstRead.toLocaleString()} miles, but ${reportedDigits} digit positions were visible on the display — that suggests the actual value should be a ${reportedDigits}-digit number.

Read the odometer again, very carefully. Count each digit position from left to right. Pay special attention to:
- Digits that may be partially obscured or low-contrast
- Leading digits that might have been missed
- Whether ${firstRead.toLocaleString()} or a ${reportedDigits}-digit version (like ${(firstRead * 10).toLocaleString()}) is correct

Return JSON: { "mileage": <integer>, "confidence": <0.0-1.0>, "reasoning": "brief explanation" }`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Re-read this odometer carefully. Is it ${firstRead.toLocaleString()} or could it be a ${reportedDigits}-digit number?` },
            { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (typeof parsed.mileage === "number" && parsed.mileage > 0) {
      console.log(`[OdometerOCR:reread] Corrected to ${Math.round(parsed.mileage).toLocaleString()} miles — ${parsed.reasoning || "no reason given"}`);
      return {
        mileage: Math.round(parsed.mileage),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verify when mileage seems implausibly low for vehicle age.
 * Asks GPT-4o to specifically re-examine whether a digit was dropped.
 */
async function verifyLowMileage(
  openai: ReturnType<typeof getOpenAI>,
  photoUrl: string,
  firstRead: number,
  vehicleAge: number,
): Promise<{ mileage: number; confidence: number } | null> {
  try {
    const expectedRange = `${(vehicleAge * 8000).toLocaleString()}-${(vehicleAge * 15000).toLocaleString()}`;
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are verifying an odometer reading that seems too low. The first read was ${firstRead.toLocaleString()} miles on a ${vehicleAge}-year-old vehicle. That's only ${Math.round(firstRead / vehicleAge).toLocaleString()} miles/year — well below the US average of 12,000 miles/year. The expected range for this vehicle is roughly ${expectedRange} miles.

This could mean:
1. The reading is correct (low-mileage vehicle — they exist but are uncommon)
2. A digit was DROPPED (e.g., 154,845 misread as 15,484 or 15,845) — this is the MOST COMMON OCR error

Look at the odometer photo again. Count every digit position from left to right. Could this actually be a higher number with an additional digit?

Return JSON: { "mileage": <your best reading as integer>, "confidence": <0.0-1.0>, "corrected": <true if different from first read>, "reasoning": "brief explanation" }`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: `The first read was ${firstRead.toLocaleString()} miles on a ${vehicleAge}-year-old vehicle. Re-examine — is a digit missing?` },
            { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (typeof parsed.mileage === "number" && parsed.mileage > 0 && parsed.corrected) {
      console.log(`[OdometerOCR:verify] Corrected ${firstRead.toLocaleString()} → ${Math.round(parsed.mileage).toLocaleString()} miles — ${parsed.reasoning || "digit was dropped"}`);
      return {
        mileage: Math.round(parsed.mileage),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      };
    }
    return null;
  } catch {
    return null;
  }
}
