/**
 * VIN extraction from photo using GPT-4o Vision.
 * Moved from original media-analyzer.ts without changes.
 */

import { getOpenAI } from "@/lib/openai";

/**
 * Extracts VIN from a hood label / VIN plate photo using GPT-4o Vision.
 * Returns the detected VIN and confidence. Cost: ~$0.05 per call.
 */
export async function extractVinFromPhoto(
  photoUrl: string,
): Promise<{ vin: string | null; confidence: number }> {
  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a vehicle identification expert. Extract the 17-character VIN (Vehicle Identification Number) from the provided photo.

The VIN may appear on:
- A metal plate on the dashboard (viewed through the windshield)
- An embossed/stamped metal tag
- A hood label or emissions sticker
- A door jamb sticker
- Any label or plate on the vehicle

VIN format rules:
- Exactly 17 characters
- Only uses characters: A-H, J-N, P, R-Z, 0-9 (never uses I, O, or Q)
- First character is country of origin (1=USA, 2=Canada, 3=Mexico, J=Japan, etc.)
- Characters 4-8 describe vehicle attributes
- Character 9 is a check digit
- Character 10 is model year (T=1996, V=1997, W=1998, etc.)
- Characters 12-17 are sequential production number

IMPORTANT: Even if the image is slightly blurry, shot through glass, or has glare, try your best to read each character. Use context clues — for example, if the vehicle is a Ford F-250, the VIN likely starts with "1FTH" or "1FTN". Return your best reading even if uncertain about 1-2 characters.

Return JSON: { "vin": "<17 char VIN or null if truly unreadable>", "confidence": <0.0 to 1.0> }
- confidence 0.9+: clearly readable, high certainty on all characters
- confidence 0.6-0.9: readable but some characters uncertain (glare, blur, angle)
- confidence 0.3-0.6: partial read, several characters guessed
- Only return null if the image contains no VIN at all`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the VIN from this vehicle identification label photo." },
            { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return { vin: null, confidence: 0 };

    const parsed = JSON.parse(raw);
    const vin =
      typeof parsed.vin === "string" && parsed.vin.length === 17
        ? parsed.vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "")
        : null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;

    if (vin && vin.length !== 17) return { vin: null, confidence: 0 };

    return { vin, confidence };
  } catch (err) {
    console.error("[extractVinFromPhoto] Failed:", err);
    return { vin: null, confidence: 0 };
  }
}
